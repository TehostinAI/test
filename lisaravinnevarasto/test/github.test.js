import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, toBase64, fromBase64, SyncError, REPO } from '../github.js';

const TOKEN = 'github_pat_TESTI';
const state = { v: 1, updatedAt: '2026-10-17', items: [{ id: 'a', name: 'Kalaöljy Omega-3 Lysi', note: 'aamu+ilta' }] };

// Korvattu fetch: palauttaa ennalta määrätyt vastaukset ja tallentaa pyynnöt.
function fakeFetch(...responses) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, ...opts, body: opts.body ? JSON.parse(opts.body) : undefined });
    const r = responses.shift();
    if (r instanceof Error) throw r;
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: new Map(Object.entries(r.headers || {})),
      json: async () => r.body,
    };
  };
  fn.calls = calls;
  return fn;
}

async function rejectsKind(promise, kind) {
  await assert.rejects(promise, (e) => e instanceof SyncError && e.kind === kind);
}

/* ---------- base64 ---------- */

test('base64: ääkköset säilyvät edestakaisin', () => {
  const text = 'Kalaöljy, Ääkköset ÅÄÖ åäö – “lainausmerkit” 💊';
  assert.equal(fromBase64(toBase64(text)), text);
});

test('base64: pelkkä btoa ei kelpaisi (todistaa testin tarpeen)', () => {
  assert.throws(() => btoa('💊'));
});

test('base64: GitHubin rivinvaihdot sisällössä eivät haittaa', () => {
  const b64 = toBase64('x'.repeat(200));
  const wrapped = b64.replace(/(.{60})/g, '$1\n');
  assert.equal(fromBase64(wrapped), 'x'.repeat(200));
});

test('base64: iso tiedosto (yli 32 kt) toimii', () => {
  const big = 'ä'.repeat(50000);
  assert.equal(fromBase64(toBase64(big)), big);
});

/* ---------- get ---------- */

test('get: lukee tilan ja sha:n, oikeat otsakkeet ja välimuistin ohitus', async () => {
  const f = fakeFetch({ status: 200, body: { sha: 'abc', content: toBase64(JSON.stringify(state)) } });
  const r = await createClient({ token: TOKEN, fetch: f }).get();
  assert.deepEqual(r, { state, sha: 'abc' });
  const c = f.calls[0];
  assert.equal(c.url, 'https://api.github.com/repos/' + REPO + '/contents/varasto.json');
  assert.equal(c.method, 'GET');
  assert.equal(c.headers.Authorization, 'Bearer ' + TOKEN);
  assert.equal(c.headers['X-GitHub-Api-Version'], '2022-11-28');
  assert.equal(c.cache, 'no-store');
});

test('get: tiedostoa ei ole → null', async () => {
  const f = fakeFetch({ status: 404, body: {} });
  assert.equal(await createClient({ token: TOKEN, fetch: f }).get(), null);
});

test('get: rikkinäinen sisältö → corrupt', async () => {
  const f = fakeFetch({ status: 200, body: { sha: 'x', content: toBase64('{rikki') } });
  await rejectsKind(createClient({ token: TOKEN, fetch: f }).get(), 'corrupt');
});

test('get: väärän muotoinen JSON → corrupt', async () => {
  const f = fakeFetch({ status: 200, body: { sha: 'x', content: toBase64('{"items":5}') } });
  await rejectsKind(createClient({ token: TOKEN, fetch: f }).get(), 'corrupt');
});

/* ---------- put ---------- */

test('put: uusi tiedosto ilman sha:ta, sisältö ääkkösineen', async () => {
  const f = fakeFetch({ status: 201, body: { content: { sha: 'uusi' } } });
  const sha = await createClient({ token: TOKEN, fetch: f }).put(state, null);
  assert.equal(sha, 'uusi');
  const c = f.calls[0];
  assert.equal(c.method, 'PUT');
  assert.equal('sha' in c.body, false);
  assert.deepEqual(JSON.parse(fromBase64(c.body.content)), state);
  assert.match(c.body.message, /2026-10-17/);
});

test('put: päivitys lähettää sha:n', async () => {
  const f = fakeFetch({ status: 200, body: { content: { sha: 'v2' } } });
  assert.equal(await createClient({ token: TOKEN, fetch: f }).put(state, 'v1'), 'v2');
  assert.equal(f.calls[0].body.sha, 'v1');
});

test('put: 409 → conflict', async () => {
  const f = fakeFetch({ status: 409, body: {} });
  await rejectsKind(createClient({ token: TOKEN, fetch: f }).put(state, 'vanha'), 'conflict');
});

test('put: 422 → conflict (tiedosto ilmestyi väliin)', async () => {
  const f = fakeFetch({ status: 422, body: {} });
  await rejectsKind(createClient({ token: TOKEN, fetch: f }).put(state, null), 'conflict');
});

/* ---------- virheet ---------- */

test('verkkovirhe → offline', async () => {
  const f = fakeFetch(new TypeError('Failed to fetch'));
  await rejectsKind(createClient({ token: TOKEN, fetch: f }).get(), 'offline');
});

test('401 → auth', async () => {
  await rejectsKind(createClient({ token: TOKEN, fetch: fakeFetch({ status: 401 }) }).get(), 'auth');
});

test('403 → auth, mutta käyttöraja täynnä → ratelimit', async () => {
  await rejectsKind(createClient({ token: TOKEN, fetch: fakeFetch({ status: 403 }) }).get(), 'auth');
  const f = fakeFetch({ status: 403, headers: { 'x-ratelimit-remaining': '0' } });
  await rejectsKind(createClient({ token: TOKEN, fetch: f }).get(), 'ratelimit');
});

test('500 → http', async () => {
  await rejectsKind(createClient({ token: TOKEN, fetch: fakeFetch({ status: 500 }) }).get(), 'http');
});

test('virheilmoitus ei sisällä avainta', async () => {
  try {
    await createClient({ token: TOKEN, fetch: fakeFetch({ status: 401 }) }).get();
  } catch (e) {
    assert.equal(e.message.includes(TOKEN), false);
  }
});

/* ---------- check ---------- */

test('check: repo näkyy → true', async () => {
  const f = fakeFetch({ status: 200, body: { private: true } });
  assert.equal(await createClient({ token: TOKEN, fetch: f }).check(), true);
  assert.equal(f.calls[0].url, 'https://api.github.com/repos/' + REPO);
});

test('check: 404 (ei oikeutta yksityiseen repoon) → auth', async () => {
  await rejectsKind(createClient({ token: TOKEN, fetch: fakeFetch({ status: 404 }) }).check(), 'auth');
});

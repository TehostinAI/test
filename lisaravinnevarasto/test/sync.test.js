import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  syncNow, applyResult, loadMeta, saveMeta, markDirty, loadToken, saveToken, clearToken,
  SYNC_KEY, TOKEN_KEY,
} from '../sync.js';
import { SyncError } from '../github.js';

/* ---------- testiympäristö: yksi korvattu GitHub, monta laitetta ---------- */

function fakeStorage() {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
}

// Toimii kuten GitHubin Contents API: sha muuttuu joka tallennuksella,
// ja vanhalla sha:lla tallentaminen hylätään (409).
function fakeRemote() {
  let file = null, n = 0;
  const r = {
    gets: 0, puts: 0,
    fail: null,          // seuraavan kutsun virhe, esim. 'offline'
    beforePut: null,     // kutsutaan ennen tallennusta (simuloi toisen laitteen väliintuloa)
    peek: () => file && structuredClone(file.state),
    client: {
      async get() {
        r.gets++;
        if (r.fail) { const k = r.fail; r.fail = null; throw new SyncError(k); }
        return file && { state: structuredClone(file.state), sha: file.sha };
      },
      async put(state, sha) {
        r.puts++;
        if (r.beforePut) { const f = r.beforePut; r.beforePut = null; await f(); }
        if ((file ? file.sha : null) !== (sha || null)) throw new SyncError('conflict', 409);
        file = { state: structuredClone(state), sha: 'sha' + (++n) };
        return file.sha;
      },
    },
    // Suora kirjoitus (toinen laite ohi testattavan kulun)
    force(state) { file = { state: structuredClone(state), sha: 'sha' + (++n) }; },
    remove() { file = null; },
  };
  return r;
}

const item = (id, over = {}) => ({ id, name: 'Tuote ' + id, remaining: 100, asOf: '2026-10-01', ...over });
const st = (...items) => ({ v: 1, updatedAt: '2026-10-17', items });
const yes = async () => true;
const no = async () => false;

// Laite = oma storage + oma paikallinen tila. Muutos merkitsee dirtyn kuten sovellus.
function device(remote, initial) {
  const storage = fakeStorage();
  const d = {
    storage,
    local: structuredClone(initial),
    asked: [],
    edit(fn) { d.local = fn(structuredClone(d.local)); markDirty(storage); },
    async sync(confirm = yes) {
      const res = await syncNow({
        client: remote.client, storage, local: d.local,
        confirmReplace: async (s) => { d.asked.push(s); return confirm(s); },
      });
      d.local = res.state;
      return res;
    },
    get: (id) => d.local.items.find((x) => x.id === id),
  };
  return d;
}
const setRemaining = (id, v) => (s) => ({ ...s, items: s.items.map((x) => (x.id === id ? { ...x, remaining: v } : x)) });

/* ---------- ensimmäinen kytkentä ---------- */

test('iPhone kytketään ensin: tiedot lähtevät tyhjään repoon', async () => {
  const remote = fakeRemote();
  const iphone = device(remote, st(item('a'), item('b')));
  const res = await iphone.sync();
  assert.equal(res.status, 'synced');
  assert.deepEqual(remote.peek(), st(item('a'), item('b')));
  assert.equal(loadMeta(iphone.storage).dirty, false);
  assert.deepEqual(iphone.asked, [], 'tyhjän repon kanssa ei kysytä mitään');
});

test('iPad kytketään toisena: kysytään vahvistus ja pilven tiedot korvaavat seedin', async () => {
  const remote = fakeRemote();
  await device(remote, st(item('oma'))).sync();
  const ipad = device(remote, st(item('seed1'), item('seed2')));
  const res = await ipad.sync(yes);
  assert.equal(res.status, 'synced');
  assert.equal(ipad.asked.length, 1);
  assert.deepEqual(ipad.local, st(item('oma')));
});

test('ensimmäisen kytkennän vahvistukseen "ei" → mitään ei muuteta eikä kytketä', async () => {
  const remote = fakeRemote();
  await device(remote, st(item('oma'))).sync();
  const ipad = device(remote, st(item('seed')));
  const res = await ipad.sync(no);
  assert.equal(res.status, 'declined');
  assert.deepEqual(ipad.local, st(item('seed')));
  assert.equal(loadMeta(ipad.storage), null);
  assert.deepEqual(remote.peek(), st(item('oma')));
});

/* ---------- vision onnistumisehto ---------- */

test('VISIO: kirjaus iPhonella näkyy iPadilla – ja toiseen suuntaan', async () => {
  const remote = fakeRemote();
  const iphone = device(remote, st(item('kreatiini')));
  await iphone.sync();
  const ipad = device(remote, st());
  await ipad.sync();

  iphone.edit(setRemaining('kreatiini', 140));
  await iphone.sync();
  await ipad.sync();
  assert.equal(ipad.get('kreatiini').remaining, 140);

  ipad.edit(setRemaining('kreatiini', 120));
  await ipad.sync();
  await iphone.sync();
  assert.equal(iphone.get('kreatiini').remaining, 120);
});

test('ei muutoksia → ei tallennusta GitHubiin', async () => {
  const remote = fakeRemote();
  const iphone = device(remote, st(item('a')));
  await iphone.sync();
  const puts = remote.puts;
  const res = await iphone.sync();
  assert.equal(res.status, 'unchanged');
  assert.equal(remote.puts, puts);
});

test('toinen laite muutti, tämä ei → otetaan etäversio ilman tallennusta', async () => {
  const remote = fakeRemote();
  const iphone = device(remote, st(item('a')));
  await iphone.sync();
  remote.force(st(item('a', { remaining: 3 })));
  const puts = remote.puts;
  await iphone.sync();
  assert.equal(iphone.get('a').remaining, 3);
  assert.equal(remote.puts, puts);
});

/* ---------- ristiriidat ---------- */

test('molemmat muuttivat eri tuotteita ilman nettiä → kaikki muutokset molempiin', async () => {
  const remote = fakeRemote();
  const iphone = device(remote, st(item('kreatiini'), item('melatoniini')));
  await iphone.sync();
  const ipad = device(remote, st());
  await ipad.sync();

  ipad.edit(setRemaining('kreatiini', 140));
  iphone.edit(setRemaining('melatoniini', 7));
  const r1 = await ipad.sync();
  const r2 = await iphone.sync();
  await ipad.sync();

  assert.deepEqual([r1.conflicts, r2.conflicts], [[], []]);
  for (const d of [iphone, ipad]) {
    assert.equal(d.get('kreatiini').remaining, 140);
    assert.equal(d.get('melatoniini').remaining, 7);
  }
});

test('molemmat muuttivat samaa tuotetta → myöhemmin synkronoiva voittaa, ristiriita raportoidaan nimellä', async () => {
  const remote = fakeRemote();
  const iphone = device(remote, st(item('a')));
  await iphone.sync();
  const ipad = device(remote, st());
  await ipad.sync();

  ipad.edit(setRemaining('a', 50));
  iphone.edit(setRemaining('a', 90));
  await ipad.sync();
  const res = await iphone.sync();

  assert.deepEqual(res.conflicts, [{ id: 'a', name: 'Tuote a', kind: 'both-changed' }]);
  assert.equal(iphone.get('a').remaining, 90);
  await ipad.sync();
  assert.equal(ipad.get('a').remaining, 90, 'iPad saa voittaneen arvon seuraavalla kerralla');
});

test('toinen laite tallentaa haun ja lähetyksen väliin → haetaan uudelleen ja yhdistetään', async () => {
  const remote = fakeRemote();
  const iphone = device(remote, st(item('a'), item('b')));
  await iphone.sync();
  iphone.edit(setRemaining('a', 1));
  remote.beforePut = async () => remote.force(st(item('a'), item('b', { remaining: 2 })));
  const res = await iphone.sync();
  assert.equal(res.status, 'synced');
  assert.equal(iphone.get('a').remaining, 1);
  assert.equal(iphone.get('b').remaining, 2);
  assert.deepEqual(remote.peek().items.map((x) => x.remaining), [1, 2]);
});

test('ristiriita toistuu joka kerta → luovutetaan 3 yrityksen jälkeen, tiedot säilyvät', async () => {
  const remote = fakeRemote();
  const iphone = device(remote, st(item('a')));
  await iphone.sync();
  iphone.edit(setRemaining('a', 1));
  const always = { ...remote.client, put: async () => { throw new SyncError('conflict', 409); } };
  const res = await syncNow({ client: always, storage: iphone.storage, local: iphone.local, confirmReplace: yes });
  assert.equal(res.status, 'error');
  assert.equal(res.error, 'conflict');
  assert.equal(res.state.items[0].remaining, 1);
  assert.equal(loadMeta(iphone.storage).dirty, true);
});

/* ---------- virheet ---------- */

test('ei verkkoa → muutos säilyy ja lähtee seuraavalla kerralla', async () => {
  const remote = fakeRemote();
  const iphone = device(remote, st(item('a')));
  await iphone.sync();
  iphone.edit(setRemaining('a', 5));
  remote.fail = 'offline';
  const r1 = await iphone.sync();
  assert.deepEqual([r1.status, r1.error], ['error', 'offline']);
  assert.equal(iphone.get('a').remaining, 5);
  assert.equal(loadMeta(iphone.storage).dirty, true);

  const r2 = await iphone.sync();
  assert.equal(r2.status, 'synced');
  assert.equal(remote.peek().items[0].remaining, 5);
});

test('avain ei kelpaa → virhe, paikalliset tiedot ennallaan', async () => {
  const remote = fakeRemote();
  const iphone = device(remote, st(item('a')));
  remote.fail = 'auth';
  const res = await iphone.sync();
  assert.deepEqual([res.status, res.error], ['error', 'auth']);
  assert.deepEqual(iphone.local, st(item('a')));
});

test('pilven tiedosto rikki → virhe, ei korvata kumpaakaan', async () => {
  const remote = fakeRemote();
  const iphone = device(remote, st(item('a')));
  await iphone.sync();
  iphone.edit(setRemaining('a', 5));
  remote.fail = 'corrupt';
  const puts = remote.puts;
  const res = await iphone.sync();
  assert.deepEqual([res.status, res.error], ['error', 'corrupt']);
  assert.equal(remote.puts, puts);
  assert.equal(iphone.get('a').remaining, 5);
});

test('pilven tiedosto poistettu → luodaan uudelleen tämän laitteen tiedoista', async () => {
  const remote = fakeRemote();
  const iphone = device(remote, st(item('a')));
  await iphone.sync();
  remote.remove();
  const res = await iphone.sync();
  assert.equal(res.status, 'synced');
  assert.deepEqual(remote.peek(), st(item('a')));
});

test('tuntematon virhe muutetaan http-virheeksi', async () => {
  const broken = { get: async () => { throw new Error('jotain outoa'); }, put: async () => 'x' };
  const res = await syncNow({ client: broken, storage: fakeStorage(), local: st(), confirmReplace: yes });
  assert.deepEqual([res.status, res.error], ['error', 'http']);
});

/* ---------- muokkaus synkronoinnin aikana ---------- */

test('applyResult: ei muokkauksia synkronoinnin aikana → tulos sellaisenaan', () => {
  const snap = st(item('a'));
  const result = st(item('a'), item('b'));
  assert.deepEqual(applyResult(snap, structuredClone(snap), result), { state: result, dirty: false });
});

test('applyResult: käyttäjä muokkasi synkronoinnin aikana → muokkaus säilyy ja uusi synkronointi tarvitaan', () => {
  const snap = st(item('a'), item('b'));
  const current = st(item('a', { remaining: 1 }), item('b'));
  const result = st(item('a'), item('b', { remaining: 2 }));
  const r = applyResult(snap, current, result);
  assert.equal(r.dirty, true);
  assert.deepEqual(r.state.items.map((x) => x.remaining), [1, 2]);
});

/* ---------- avain ja tila ---------- */

test('avain: tallennus, välilyönnit pois, poisto katkaisee kytkennän', () => {
  const s = fakeStorage();
  assert.equal(loadToken(s), null);
  saveToken(s, '  github_pat_x \n');
  assert.equal(loadToken(s), 'github_pat_x');
  saveMeta(s, { sha: 'x', base: st(), dirty: false });
  clearToken(s);
  assert.equal(loadToken(s), null);
  assert.equal(s.data.has(TOKEN_KEY), false);
  assert.equal(s.data.has(SYNC_KEY), false);
});

test('markDirty ei tee mitään, jos laitetta ei ole kytketty', () => {
  const s = fakeStorage();
  markDirty(s);
  assert.equal(loadMeta(s), null);
});

test('rikkinäinen synkronointitila tulkitaan kytkemättömäksi', () => {
  const s = fakeStorage();
  s.setItem(SYNC_KEY, '{rikki');
  assert.equal(loadMeta(s), null);
  s.setItem(SYNC_KEY, '{"sha":"x"}');
  assert.equal(loadMeta(s), null);
});

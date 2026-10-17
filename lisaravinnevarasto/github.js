// GitHub Contents API: varasto.json:n luku ja kirjoitus. Testit: test/github.test.js
// fetch annetaan parametrina, jotta testit voivat korvata sen.

export const REPO = 'TehostinAI/lisaravinnedata';
export const FILE = 'varasto.json';
const API = 'https://api.github.com';

// kind: 'offline' | 'auth' | 'notfound' | 'conflict' | 'ratelimit' | 'corrupt' | 'http'
export class SyncError extends Error {
  constructor(kind, status = 0) {
    super('GitHub: ' + kind + (status ? ' (' + status + ')' : ''));
    this.kind = kind;
    this.status = status;
  }
}

/* ---------- UTF-8-turvallinen base64 (pelkkä btoa rikkoo ääkköset) ---------- */

export function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function fromBase64(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/* ---------- asiakas ---------- */

export function createClient({ token, fetch = globalThis.fetch, repo = REPO, file = FILE }) {
  const headers = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  async function call(method, url, body) {
    let res;
    try {
      res = await fetch(API + url, {
        method,
        headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      });
    } catch {
      throw new SyncError('offline');
    }
    if (res.ok) return res.json();

    const s = res.status;
    if (s === 401) throw new SyncError('auth', s);
    if (s === 403 || s === 429) {
      const left = res.headers && res.headers.get && res.headers.get('x-ratelimit-remaining');
      throw new SyncError(left === '0' || s === 429 ? 'ratelimit' : 'auth', s);
    }
    if (s === 404) throw new SyncError('notfound', s);
    // 409: sha ei täsmää. 422 PUTissa: tiedosto ilmestyi väliin eikä sha:ta annettu.
    if (s === 409 || (s === 422 && method === 'PUT')) throw new SyncError('conflict', s);
    throw new SyncError('http', s);
  }

  const contents = '/repos/' + repo + '/contents/' + encodeURIComponent(file);

  return {
    // Tarkistaa, että avain kelpaa ja repo näkyy. Yksityinen repo ilman oikeuksia
    // näyttää GitHubille 404:ltä, joten molemmat tulkitaan avainongelmaksi.
    async check() {
      try {
        await call('GET', '/repos/' + repo);
      } catch (e) {
        if (e.kind === 'notfound') throw new SyncError('auth', 404);
        throw e;
      }
      return true;
    },

    // Palauttaa { state, sha } tai null, jos tiedostoa ei vielä ole.
    async get() {
      let data;
      try {
        data = await call('GET', contents);
      } catch (e) {
        if (e.kind === 'notfound') return null;
        throw e;
      }
      let state;
      try {
        state = JSON.parse(fromBase64(data.content));
      } catch {
        throw new SyncError('corrupt');
      }
      if (!state || !Array.isArray(state.items)) throw new SyncError('corrupt');
      return { state, sha: data.sha };
    },

    // sha = null luo uuden tiedoston. Palauttaa uuden sha:n.
    async put(state, sha) {
      const body = {
        message: 'Päivitys ' + (state.updatedAt || ''),
        content: toBase64(JSON.stringify(state, null, 2) + '\n'),
      };
      if (sha) body.sha = sha;
      const data = await call('PUT', contents, body);
      return data.content.sha;
    },
  };
}

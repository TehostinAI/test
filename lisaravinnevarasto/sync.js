// Synkronoinnin kulku: hae → yhdistä → lähetä. Testit: test/sync.test.js
// Säännöt: CLAUDE.md, osio "Synkronointi". GitHub-asiakas ja storage annetaan
// parametrina, joten kulun voi testata ilman nettiä ja selainta.

import { merge } from './merge.js';
import { SyncError } from './github.js';

export const SYNC_KEY = 'lisaravinnevarasto.sync';
export const TOKEN_KEY = 'lisaravinnevarasto.token';
export const MAX_ATTEMPTS = 3;

/* ---------- tila localStoragessa ---------- */

function read(storage, key) {
  try { return storage.getItem(key); } catch { return null; }
}
function write(storage, key, value) {
  try { storage.setItem(key, value); return true; } catch { return false; }
}
function remove(storage, key) {
  try { storage.removeItem(key); } catch { /* ei voi mitään */ }
}

export function loadMeta(storage) {
  try {
    const m = JSON.parse(read(storage, SYNC_KEY));
    return m && typeof m.sha === 'string' && m.base && Array.isArray(m.base.items) ? m : null;
  } catch {
    return null;
  }
}

export function saveMeta(storage, meta) {
  return write(storage, SYNC_KEY, JSON.stringify(meta));
}

// Kutsutaan jokaisen paikallisen muutoksen jälkeen.
export function markDirty(storage) {
  const m = loadMeta(storage);
  if (m && !m.dirty) saveMeta(storage, { ...m, dirty: true });
}

export function loadToken(storage) {
  const t = read(storage, TOKEN_KEY);
  return t && t.trim() ? t.trim() : null;
}

export function saveToken(storage, token) {
  return write(storage, TOKEN_KEY, String(token).trim());
}

// Avaimen poisto katkaisee kytkennän: seuraava kytkentä on taas "ensimmäinen".
export function clearToken(storage) {
  remove(storage, TOKEN_KEY);
  remove(storage, SYNC_KEY);
}

/* ---------- synkronointi ---------- */

// Palauttaa { status, state, conflicts, error }
//   status: 'synced'    tiedot ajan tasalla, state = uusi paikallinen tila
//           'unchanged' mitään ei tarvinnut tehdä
//           'declined'  käyttäjä ei halunnut korvata laitteen tietoja
//           'error'     error = SyncError.kind; state = local ennallaan
// confirmReplace(remoteState) → Promise<boolean>: ensimmäisen kytkennän vahvistus.
export async function syncNow({ client, storage, local, confirmReplace, now = () => new Date() }) {
  const meta = loadMeta(storage);
  const done = (state, sha, conflicts = []) => {
    saveMeta(storage, { sha, base: state, dirty: false, syncedAt: now().toISOString() });
    return { status: 'synced', state, conflicts };
  };

  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const remote = await client.get();

        // Ensimmäinen kytkentä tällä laitteella.
        if (!meta) {
          if (!remote) return done(local, await client.put(local, null));
          if (!(await confirmReplace(remote.state))) return { status: 'declined', state: local, conflicts: [] };
          return done(remote.state, remote.sha);
        }

        // Etätiedosto on poistettu: luodaan uudelleen tämän laitteen tiedoista.
        if (!remote) return done(local, await client.put(local, null));

        if (remote.sha === meta.sha) {
          if (!meta.dirty) return { status: 'unchanged', state: local, conflicts: [] };
          return done(local, await client.put(local, meta.sha));
        }

        if (!meta.dirty) return done(remote.state, remote.sha);

        const m = merge(meta.base, local, remote.state);
        return done(m.state, await client.put(m.state, remote.sha), m.conflicts);
      } catch (e) {
        // Joku ehti tallentaa haun ja lähetyksen väliin: haetaan uudelleen.
        if (e instanceof SyncError && e.kind === 'conflict') continue;
        throw e;
      }
    }
    throw new SyncError('conflict');
  } catch (e) {
    return { status: 'error', state: local, conflicts: [], error: e instanceof SyncError ? e.kind : 'http' };
  }
}

// Jos käyttäjä muutti tietoja synkronoinnin aikana, muutokset yhdistetään
// synkronoinnin tulokseen eikä niitä korvata. snapshot = syncNow:lle annettu local.
// Palauttaa { state, dirty }: dirty = true → tarvitaan uusi synkronointi.
export function applyResult(snapshot, current, result) {
  if (JSON.stringify(snapshot) === JSON.stringify(current)) return { state: result, dirty: false };
  return { state: merge(snapshot, current, result).state, dirty: true };
}

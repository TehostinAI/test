// Lataus ja tallennus. storage = localStorage tai testin korvike, jolla on
// getItem/setItem. Testit: test/storage.test.js

import { iso, today } from './logic.js';

export const KEY = 'lisaravinnevarasto.v1';

function isValid(state) {
  return !!state && typeof state === 'object' && Array.isArray(state.items);
}

// Palauttaa { state, status }. status:
//   'ok'          tallennettu tila luettiin
//   'seeded'      avainta ei ollut: lähtödata otettiin käyttöön ja tallennettiin
//   'corrupt'     tallennettu tila oli rikki: se kopioitiin talteen, aloitetaan tyhjästä
//   'unavailable' selaimen tallennus ei toimi (esim. yksityinen selaus)
export function loadState(storage, seed, day = today()) {
  let raw;
  try {
    raw = storage.getItem(KEY);
  } catch {
    return { state: structuredClone(seed), status: 'unavailable' };
  }

  if (raw === null) {
    const state = structuredClone(seed);
    const ok = saveState(storage, state, day);
    return { state, status: ok ? 'seeded' : 'unavailable' };
  }

  let state = null;
  try { state = JSON.parse(raw); } catch { /* käsitellään alla */ }
  if (isValid(state)) return { state, status: 'ok' };

  try { storage.setItem(KEY + '.rikki-' + iso(day), raw); } catch { /* ei voi mitään */ }
  return { state: { v: 1, updatedAt: iso(day), items: [] }, status: 'corrupt' };
}

// Palauttaa true jos tallennus onnistui.
export function saveState(storage, state, day = today()) {
  state.updatedAt = iso(day);
  try {
    storage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// Pyytää selainta olemaan poistamatta tietoja. Palauttaa Promisen: true/false.
export function requestPersist(nav = globalThis.navigator) {
  try {
    if (nav && nav.storage && typeof nav.storage.persist === 'function') {
      return nav.storage.persist().catch(() => false);
    }
  } catch { /* vanha selain */ }
  return Promise.resolve(false);
}

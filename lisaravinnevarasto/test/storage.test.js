import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEY, loadState, saveState, requestPersist } from '../storage.js';
import { SEED } from '../seed.js';
import { parseISO } from '../logic.js';

const day = parseISO('2026-10-17');

// localStorage-korvike testejä varten
function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
  };
}
const brokenStorage = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('SecurityError'); },
};
const fullStorage = {
  getItem: () => null,
  setItem() { throw new Error('QuotaExceededError'); },
};

test('ensimmäinen käynnistys: lähtödata otetaan käyttöön ja tallennetaan', () => {
  const s = fakeStorage();
  const { state, status } = loadState(s, SEED, day);
  assert.equal(status, 'seeded');
  assert.equal(state.items.length, 10);
  assert.equal(JSON.parse(s.data.get(KEY)).items.length, 10);
});

test('lähtödataa ei muokata, kun tilaa muutetaan', () => {
  const { state } = loadState(fakeStorage(), SEED, day);
  state.items.pop();
  assert.equal(SEED.items.length, 10);
});

test('tallennettu tila luetaan sellaisenaan', () => {
  const saved = { v: 1, updatedAt: '2026-10-16', items: [{ id: 'a', name: 'Oma' }] };
  const { state, status } = loadState(fakeStorage({ [KEY]: JSON.stringify(saved) }), SEED, day);
  assert.equal(status, 'ok');
  assert.deepEqual(state, saved);
});

test('tyhjä lista EI tuo lähtödataa takaisin', () => {
  const s = fakeStorage({ [KEY]: JSON.stringify({ v: 1, items: [] }) });
  const { state, status } = loadState(s, SEED, day);
  assert.equal(status, 'ok');
  assert.equal(state.items.length, 0);
});

test('rikkinäinen tila kopioidaan talteen ja aloitetaan tyhjästä', () => {
  const s = fakeStorage({ [KEY]: '{rikki' });
  const { state, status } = loadState(s, SEED, day);
  assert.equal(status, 'corrupt');
  assert.equal(state.items.length, 0);
  assert.equal(s.data.get(KEY + '.rikki-2026-10-17'), '{rikki');
});

test('väärän muotoinen JSON tulkitaan rikkinäiseksi', () => {
  const { status } = loadState(fakeStorage({ [KEY]: '{"items":"ei lista"}' }), SEED, day);
  assert.equal(status, 'corrupt');
});

test('estetty tallennus: sovellus toimii lähtödatalla, status kertoo ongelmasta', () => {
  const { state, status } = loadState(brokenStorage, SEED, day);
  assert.equal(status, 'unavailable');
  assert.equal(state.items.length, 10);
});

test('täysi tallennustila ensimmäisellä käynnistyksellä', () => {
  assert.equal(loadState(fullStorage, SEED, day).status, 'unavailable');
});

test('saveState: tallentaa ja asettaa päivityspäivän', () => {
  const s = fakeStorage();
  const state = { v: 1, items: [] };
  assert.equal(saveState(s, state, day), true);
  assert.equal(JSON.parse(s.data.get(KEY)).updatedAt, '2026-10-17');
  assert.equal(saveState(brokenStorage, state, day), false);
});

test('requestPersist: kutsuu selainta tai palauttaa false', async () => {
  assert.equal(await requestPersist({ storage: { persist: async () => true } }), true);
  assert.equal(await requestPersist({ storage: { persist: async () => { throw new Error(); } } }), false);
  assert.equal(await requestPersist({}), false);
  assert.equal(await requestPersist(undefined), false);
});

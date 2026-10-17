import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  iso, parseISO, fiDate, num, perDay, left, daysLeft, runOutDate, statusOf,
  sortBySoonest, packsNeeded, withCount, withRefill, esc,
} from '../logic.js';

const d = (s) => parseISO(s);
const item = (over = {}) => ({
  id: 'x', name: 'Testi', form: 'kapselia', perDose: 2, timesPerDay: 1,
  packSize: 90, threshold: 14, remaining: 100, asOf: '2026-10-01', note: '', ...over,
});

test('päivämäärät: iso ja parseISO ovat toistensa käänteiset', () => {
  assert.equal(iso(d('2026-03-05')), '2026-03-05');
  assert.equal(fiDate(d('2026-03-05')), '5.3.2026');
});

test('parseISO: virheellinen arvo palauttaa varapäivän', () => {
  const fb = d('2026-01-01');
  assert.equal(parseISO('', fb), fb);
  assert.equal(parseISO('roskaa', fb), fb);
  assert.equal(parseISO(undefined, fb), fb);
});

test('num: hyväksyy pilkun desimaalierottimena', () => {
  assert.equal(num('1,5'), 1.5);
  assert.equal(num('abc'), 0);
  assert.equal(num(3), 3);
});

test('perDay: annos × kertaa päivässä', () => {
  assert.equal(perDay(item({ perDose: 2, timesPerDay: 2 })), 4);
  assert.equal(perDay(item({ perDose: 1.5, timesPerDay: 1 })), 1.5);
});

test('left: saldo vähenee päivittäin', () => {
  const it = item({ remaining: 100, perDose: 2, asOf: '2026-10-01' });
  assert.equal(left(it, d('2026-10-01')), 100);
  assert.equal(left(it, d('2026-10-11')), 80);
});

test('left: ei mene koskaan alle nollan', () => {
  assert.equal(left(item({ remaining: 10 }), d('2026-12-31')), 0);
});

test('left: tulevaisuuden asOf ei kasvata saldoa', () => {
  assert.equal(left(item({ asOf: '2026-10-20' }), d('2026-10-01')), 100);
});

test('left: kesäaikasiirtymä ei vääristä päivien määrää', () => {
  // Kesäaika päättyy 25.10.2026, jolloin päivässä on 25 tuntia.
  const it = item({ remaining: 100, perDose: 1, asOf: '2026-10-24' });
  assert.equal(left(it, d('2026-10-26')), 98);
});

test('daysLeft: pyöristää alaspäin', () => {
  assert.equal(daysLeft(item({ remaining: 7, perDose: 2 }), d('2026-10-01')), 3);
});

test('daysLeft: null jos kulutus on nolla', () => {
  assert.equal(daysLeft(item({ perDose: 0 }), d('2026-10-01')), null);
});

test('runOutDate: tämä päivä + päiviä jäljellä', () => {
  const it = item({ remaining: 20, perDose: 2, asOf: '2026-10-01' });
  assert.equal(iso(runOutDate(it, d('2026-10-01'))), '2026-10-11');
});

test('statusOf: ok, low ja out rajojen mukaan', () => {
  const day = d('2026-10-01');
  assert.equal(statusOf(item({ remaining: 30, perDose: 2, threshold: 14 }), day), 'ok');  // 15 pv
  assert.equal(statusOf(item({ remaining: 28, perDose: 2, threshold: 14 }), day), 'low'); // 14 pv
  assert.equal(statusOf(item({ remaining: 1, perDose: 2 }), day), 'out');                 // 0 pv
  assert.equal(statusOf(item({ perDose: 0 }), day), 'ok');
});

test('sortBySoonest: ensin loppuva ensin, nollakulutus viimeisenä', () => {
  const day = d('2026-10-01');
  const items = [
    item({ id: 'a', remaining: 100 }),
    item({ id: 'b', perDose: 0 }),
    item({ id: 'c', remaining: 10 }),
  ];
  assert.deepEqual(sortBySoonest(items, day).map((x) => x.id), ['c', 'a', 'b']);
  assert.deepEqual(items.map((x) => x.id), ['a', 'b', 'c'], 'alkuperäinen lista ei muutu');
});

test('packsNeeded: riittää 60 päivää, vähintään 1', () => {
  const day = d('2026-10-01');
  // tarve 60 × 2 = 120, jäljellä 10 → puuttuu 110 → 2 × 90
  assert.equal(packsNeeded(item({ remaining: 10, perDose: 2, packSize: 90 }), day), 2);
  assert.equal(packsNeeded(item({ remaining: 500 }), day), 1);
  assert.equal(packsNeeded(item({ packSize: 0, remaining: 0, perDose: 1 }), day), 60);
});

test('withCount ja withRefill: uusi saldo tälle päivälle, alkuperäinen ennallaan', () => {
  const day = d('2026-10-11');
  const it = item({ remaining: 100, perDose: 2, packSize: 90, asOf: '2026-10-01' });
  assert.deepEqual(
    [withCount(it, '42', day).remaining, withCount(it, '42', day).asOf], [42, '2026-10-11']);
  assert.equal(withRefill(it, day).remaining, 80 + 90);
  assert.equal(it.remaining, 100);
});

test('esc: estää HTML-injektion', () => {
  assert.equal(esc('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
  assert.equal(esc(null), '');
});

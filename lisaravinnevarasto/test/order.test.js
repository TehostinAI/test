import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderList, orderListText, formatEur, parseISO, FREE_SHIPPING_EUR } from '../logic.js';

const day = parseISO('2026-10-17');
// Oletuksena 1 kpl/pv, pakkaus 100 kpl, tilausraja 14 pv. remaining = päiviä jäljellä.
const it = (name, over = {}) => ({
  id: name, name, perDose: 1, timesPerDay: 1, packSize: 100, threshold: 14,
  remaining: 50, asOf: '2026-10-17', price: 20, ...over,
});
const names = (l) => l.lines.map((x) => x.item.name);

test('vakio: rahtivapaan raja on 89 €', () => {
  assert.equal(FREE_SHIPPING_EUR, 89);
});

test('1. ei tilausrajan alittaneita → ei listaa, vaikka arvo ylittäisi 89 €', () => {
  const items = [it('A', { remaining: 30, price: 200 }), it('B', { remaining: 40, price: 200 })];
  assert.equal(orderList(items, day), null);
});

test('1. tuote ilman kulutusta ei laukaise listaa', () => {
  assert.equal(orderList([it('A', { perDose: 0, remaining: 0 })], day), null);
});

test('2. purkkimäärä: 60 päivän tarve, kulutus ja pakkauskoko ratkaisevat', () => {
  // K2-tyyppinen: pakkaus 10 kpl, 1/pv, jäljellä 5 → (60 − 5) / 10 → 6 purkkia
  const l = orderList([it('K2', { packSize: 10, remaining: 5, price: 8 })], day);
  assert.equal(l.lines[0].packs, 6);
  assert.equal(l.lines[0].value, 48);
});

test('2. nopeasti kuluva pieni pakkaus nostaa tilauksen arvoa', () => {
  // 2 kpl/pv, pakkaus 30 → 15 pv purkki; jäljellä 10 kpl (5 pv) → (120 − 10) / 30 → 4 purkkia
  const l = orderList([it('Nopea', { perDose: 2, packSize: 30, remaining: 10, price: 25 })], day);
  assert.equal(l.lines[0].packs, 4);
  assert.equal(l.total, 100);
  assert.equal(l.freeShipping, true);
});

test('3. kaikki tilausrajan alittaneet tulevat listalle, vaikka ensimmäinen jo ylittäisi 89 €', () => {
  const items = [it('A', { remaining: 5, price: 95 }), it('B', { remaining: 10, price: 5 }), it('C', { remaining: 40 })];
  const l = orderList(items, day);
  assert.deepEqual(names(l), ['A', 'B']);
  assert.equal(l.lines.every((x) => !x.filler), true);
});

test('3. loppunut tuote (0 pv) on listalla', () => {
  const l = orderList([it('Loppu', { remaining: 0 })], day);
  assert.deepEqual(names(l), ['Loppu']);
});

test('4. täyttö: seuraavaksi loppuvat lisätään järjestyksessä, kunnes ≥ 89 €', () => {
  const items = [
    it('Kaukana', { remaining: 90, price: 30 }),
    it('Melatoniini', { remaining: 10, price: 15.9 }),
    it('Kreatiini', { remaining: 24, price: 24.9 }),
    it('Kalaöljy', { remaining: 18, price: 19.9 }),
    it('NAC', { remaining: 19, price: 29.9 }),
  ];
  const l = orderList(items, day);
  assert.deepEqual(names(l), ['Melatoniini', 'Kalaöljy', 'NAC', 'Kreatiini']);
  assert.deepEqual(l.lines.map((x) => x.filler), [false, true, true, true]);
  assert.equal(l.total, 90.6);
  assert.equal(l.freeShipping, true);
});

test('4. täyttö loppuu heti kun raja on saavutettu', () => {
  const items = [it('A', { remaining: 5, price: 50 }), it('B', { remaining: 20, price: 39 }), it('C', { remaining: 30, price: 10 })];
  const l = orderList(items, day);
  assert.deepEqual(names(l), ['A', 'B']);
  assert.equal(l.total, 89);
  assert.equal(l.missing, 0);
});

test('4. täytteeksi ei oteta hinnattomia eikä kulutuksettomia', () => {
  const items = [
    it('A', { remaining: 5, price: 50 }),
    it('Hinnaton', { remaining: 20, price: undefined }),
    it('Tauolla', { remaining: 21, perDose: 0 }),
    it('B', { remaining: 30, price: 40 }),
  ];
  assert.deepEqual(names(orderList(items, day)), ['A', 'B']);
});

test('5. pakollinen tuote ilman hintaa: listalla, ei summassa, unpriced lasketaan', () => {
  const items = [it('Hinnaton', { remaining: 5, price: '' }), it('B', { remaining: 30, price: 90 })];
  const l = orderList(items, day);
  assert.deepEqual(names(l), ['Hinnaton', 'B']);
  assert.equal(l.lines[0].value, null);
  assert.equal(l.unpriced, 1);
  assert.equal(l.total, 90);
});

test('5. rahat lasketaan senteillä: 3 × 19,90 = 59,70 tasan', () => {
  const l = orderList([it('A', { packSize: 20, remaining: 5, price: 19.9 })], day); // (60−5)/20 → 3
  assert.equal(l.lines[0].packs, 3);
  assert.equal(l.total, 59.7);
});

test('5. hinta pilkulla merkkijonona kelpaa', () => {
  const l = orderList([it('A', { remaining: 5, price: '24,90' })], day);
  assert.equal(l.total, 24.9);
});

test('6. kaikki lisätty ja silti alle 89 € → lista näytetään, puuttuva summa kerrotaan', () => {
  const items = [it('A', { remaining: 5, price: 15.9 }), it('B', { remaining: 40, price: 20 })];
  const l = orderList(items, day);
  assert.deepEqual(names(l), ['A', 'B']);
  assert.equal(l.freeShipping, false);
  assert.equal(l.missing, 53.1);
});

test('formatEur: suomalainen muoto', () => {
  assert.equal(formatEur(90.6), '90,60 €');
  assert.equal(formatEur(3.9), '3,90 €');
  assert.equal(formatEur(0), '0,00 €');
});

test('orderListText: rivit, summa ja rahtivapaus', () => {
  const l = orderList([it('A', { remaining: 5, price: 50, packSize: 60 }), it('B', { remaining: 30, price: 40 })], day);
  assert.equal(orderListText(l), [
    'A – 1 purkki (60 kpl) – 50,00 €',
    'B – 1 purkki (100 kpl) – 40,00 €',
    '',
    'Yhteensä 90,00 € – rahtivapaa',
  ].join('\n'));
});

test('orderListText: alle rajan ja hinnaton tuote', () => {
  const l = orderList([it('A', { remaining: 5, price: null, packSize: 60 })], day);
  assert.equal(orderListText(l), [
    'A – 1 purkki (60 kpl) – hinta puuttuu',
    '',
    'Yhteensä 0,00 € – rahtivapaaseen puuttuu 89,00 € (rahti 3,90 €)',
    'Hinta puuttuu 1 tuotteelta, eikä niitä ole laskettu summaan.',
  ].join('\n'));
  assert.equal(orderListText(null), '');
});

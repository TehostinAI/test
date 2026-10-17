import { test } from 'node:test';
import assert from 'node:assert/strict';
import { merge } from '../merge.js';

const it = (id, over = {}) => ({ id, name: 'Tuote ' + id, remaining: 100, asOf: '2026-10-01', ...over });
const st = (...items) => ({ v: 1, updatedAt: '2026-10-01', items });
const ids = (r) => r.state.items.map((x) => x.id);
const get = (r, id) => r.state.items.find((x) => x.id === id);

test('ei muutoksia kummallakaan: tulos on sama kuin pohja', () => {
  const b = st(it('a'), it('b'));
  const r = merge(b, b, b);
  assert.deepEqual(r.state.items, b.items);
  assert.deepEqual(r.conflicts, []);
});

test('muutos vain tällä laitteella → otetaan', () => {
  const r = merge(st(it('a')), st(it('a', { remaining: 50 })), st(it('a')));
  assert.equal(get(r, 'a').remaining, 50);
  assert.deepEqual(r.conflicts, []);
});

test('muutos vain toisella laitteella → otetaan', () => {
  const r = merge(st(it('a')), st(it('a')), st(it('a', { remaining: 70 })));
  assert.equal(get(r, 'a').remaining, 70);
  assert.deepEqual(r.conflicts, []);
});

test('eri tuotteiden muutokset yhdistyvät ilman ristiriitaa', () => {
  const b = st(it('kreatiini'), it('melatoniini'));
  const l = st(it('kreatiini'), it('melatoniini', { remaining: 7 }));
  const rem = st(it('kreatiini', { remaining: 140 }), it('melatoniini'));
  const r = merge(b, l, rem);
  assert.equal(get(r, 'kreatiini').remaining, 140);
  assert.equal(get(r, 'melatoniini').remaining, 7);
  assert.deepEqual(r.conflicts, []);
});

test('sama tuote muuttunut molemmilla eri tavalla → tämä laite voittaa ja ristiriita raportoidaan', () => {
  const r = merge(st(it('a')), st(it('a', { remaining: 50 })), st(it('a', { remaining: 90 })));
  assert.equal(get(r, 'a').remaining, 50);
  assert.deepEqual(r.conflicts, [{ id: 'a', name: 'Tuote a', kind: 'both-changed' }]);
});

test('sama tuote muuttunut molemmilla samalla tavalla → ei ristiriitaa', () => {
  const r = merge(st(it('a')), st(it('a', { remaining: 50 })), st(it('a', { remaining: 50 })));
  assert.equal(get(r, 'a').remaining, 50);
  assert.deepEqual(r.conflicts, []);
});

test('kenttien järjestys ei aiheuta ristiriitaa', () => {
  const l = st({ remaining: 100, asOf: '2026-10-01', name: 'Tuote a', id: 'a' });
  const r = merge(st(it('a')), l, st(it('a')));
  assert.deepEqual(r.conflicts, []);
});

test('lisätty tällä laitteella → mukaan', () => {
  const r = merge(st(it('a')), st(it('a'), it('uusi')), st(it('a')));
  assert.deepEqual(ids(r), ['a', 'uusi']);
});

test('lisätty toisella laitteella → mukaan', () => {
  const r = merge(st(it('a')), st(it('a')), st(it('a'), it('uusi')));
  assert.deepEqual(ids(r), ['a', 'uusi']);
});

test('lisätty molemmilla eri tuotteet → molemmat mukaan', () => {
  const r = merge(st(), st(it('x')), st(it('y')));
  assert.deepEqual(ids(r).sort(), ['x', 'y']);
  assert.deepEqual(r.conflicts, []);
});

test('poistettu tällä laitteella, toinen ei koskenut → poistuu', () => {
  const r = merge(st(it('a'), it('b')), st(it('a')), st(it('a'), it('b')));
  assert.deepEqual(ids(r), ['a']);
  assert.deepEqual(r.conflicts, []);
});

test('poistettu toisella laitteella, tämä ei koskenut → poistuu', () => {
  const r = merge(st(it('a'), it('b')), st(it('a'), it('b')), st(it('a')));
  assert.deepEqual(ids(r), ['a']);
  assert.deepEqual(r.conflicts, []);
});

test('poistettu molemmilla → poistuu ilman ristiriitaa', () => {
  const r = merge(st(it('a'), it('b')), st(it('a')), st(it('a')));
  assert.deepEqual(ids(r), ['a']);
  assert.deepEqual(r.conflicts, []);
});

test('poistettu tällä, muutettu toisella → muutettu säilyy ja raportoidaan', () => {
  const r = merge(st(it('a')), st(), st(it('a', { remaining: 5 })));
  assert.equal(get(r, 'a').remaining, 5);
  assert.deepEqual(r.conflicts, [{ id: 'a', name: 'Tuote a', kind: 'deleted-here-kept' }]);
});

test('poistettu toisella, muutettu tällä → muutettu säilyy ja raportoidaan', () => {
  const r = merge(st(it('a')), st(it('a', { remaining: 5 })), st());
  assert.equal(get(r, 'a').remaining, 5);
  assert.deepEqual(r.conflicts, [{ id: 'a', name: 'Tuote a', kind: 'deleted-there-kept' }]);
});

test('järjestys: tämän laitteen järjestys, toisen lisäykset perään', () => {
  const r = merge(st(it('a'), it('b')), st(it('b'), it('a')), st(it('a'), it('b'), it('c')));
  assert.deepEqual(ids(r), ['b', 'a', 'c']);
});

test('updatedAt on uudempi kahdesta', () => {
  const l = { ...st(it('a')), updatedAt: '2026-10-15' };
  const rem = { ...st(it('a')), updatedAt: '2026-10-17' };
  assert.equal(merge(st(it('a')), l, rem).state.updatedAt, '2026-10-17');
});

test('syötteitä ei muuteta', () => {
  const b = st(it('a')), l = st(it('a', { remaining: 1 })), rem = st(it('a', { remaining: 2 }));
  const copy = JSON.stringify([b, l, rem]);
  merge(b, l, rem);
  assert.equal(JSON.stringify([b, l, rem]), copy);
});

test('puuttuva pohja käsitellään tyhjänä', () => {
  const r = merge(null, st(it('a')), st(it('b')));
  assert.deepEqual(ids(r).sort(), ['a', 'b']);
});

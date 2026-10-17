// Puhtaat funktiot: ei DOMia, ei localStoragea. Testit: test/logic.test.js
// Funktiot ottavat "tämän päivän" parametrina, jotta testit voivat kiinnittää ajan.

export const DAY = 86400000;
export const REFILL_TARGET_DAYS = 60;
export const FREE_SHIPPING_EUR = 89;   // sinunapteekki.fi, noutopiste (tarkistettu 17.10.2026)
export const SHIPPING_EUR = 3.9;

/* ---------- päivämäärät (paikallista aikaa) ---------- */

export function today(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function iso(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

export function parseISO(s, fallback = today()) {
  const p = String(s || '').split('-').map(Number);
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return fallback;
  return new Date(p[0], p[1] - 1, p[2]);
}

export function fiDate(d) {
  return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear();
}

export function daysBetween(from, to) {
  // Math.round tasoittaa kesäaikasiirtymän 23/25 tunnin päivät.
  return Math.round((to - from) / DAY);
}

/* ---------- luvut ---------- */

export function num(v) {
  const n = Number(String(v).replace(',', '.'));
  return isFinite(n) ? n : 0;
}

/* ---------- saldo ja tila ---------- */

export function perDay(it) {
  return num(it.perDose) * num(it.timesPerDay);
}

export function left(it, day = today()) {
  const elapsed = Math.max(0, daysBetween(parseISO(it.asOf, day), day));
  return Math.max(0, num(it.remaining) - elapsed * perDay(it));
}

export function daysLeft(it, day = today()) {
  const d = perDay(it);
  return d > 0 ? Math.floor(left(it, day) / d) : null;
}

export function runOutDate(it, day = today()) {
  const d = daysLeft(it, day);
  return d === null ? null : new Date(day.getFullYear(), day.getMonth(), day.getDate() + d);
}

export function statusOf(it, day = today()) {
  const d = daysLeft(it, day);
  if (d === null) return 'ok';
  if (d <= 0) return 'out';
  if (d <= num(it.threshold)) return 'low';
  return 'ok';
}

export function sortBySoonest(items, day = today()) {
  return items.slice().sort((a, b) => {
    const da = daysLeft(a, day), db = daysLeft(b, day);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
}

/* ---------- ostoslista ---------- */

export function packsNeeded(it, day = today()) {
  const d = perDay(it);
  if (d <= 0) return 1;
  const target = REFILL_TARGET_DAYS * d;
  return Math.max(1, Math.ceil((target - left(it, day)) / Math.max(1, num(it.packSize))));
}

export function needsOrder(it, day = today()) {
  const s = statusOf(it, day);
  return s === 'low' || s === 'out';
}

export function shoppingList(items, day = today()) {
  return sortBySoonest(items, day)
    .filter((it) => needsOrder(it, day))
    .map((it) => ({ item: it, packs: packsNeeded(it, day) }));
}

export function packsLabel(n) {
  return n + ' purkki' + (n > 1 ? 'a' : '');
}

export function shoppingListText(items, day = today()) {
  return shoppingList(items, day)
    .map(({ item, packs }) => item.name + ' – ' + packsLabel(packs) + ' (' + num(item.packSize) + ' kpl)')
    .join('\n');
}

/* ---------- ostoslista rahtivapaaseen tilaukseen (CLAUDE.md, "Ostoslista") ---------- */

// Hinta sentteinä tai null. Sentit, jotta 3 × 19,90 on tasan 59,70.
function priceCents(it) {
  if (it.price == null || it.price === '') return null;
  const p = num(it.price);
  return p > 0 ? Math.round(p * 100) : null;
}

export function hasPrice(it) {
  return priceCents(it) !== null;
}

// Palauttaa null (ei listaa) tai
// { lines: [{ item, packs, value, filler }], total, missing, freeShipping, unpriced }
export function orderList(items, day = today()) {
  const free = Math.round(FREE_SHIPPING_EUR * 100);
  const sorted = sortBySoonest(items, day).filter((it) => perDay(it) > 0);
  if (!sorted.some((it) => needsOrder(it, day))) return null;

  const lines = [];
  let cents = 0;
  const add = (it, filler) => {
    const packs = packsNeeded(it, day);
    const p = priceCents(it);
    if (p !== null) cents += packs * p;
    lines.push({ item: it, packs, value: p === null ? null : (packs * p) / 100, filler });
  };

  for (const it of sorted) if (needsOrder(it, day)) add(it, false);
  for (const it of sorted) {
    if (cents >= free) break;
    if (!needsOrder(it, day) && hasPrice(it)) add(it, true);
  }

  return {
    lines,
    total: cents / 100,
    missing: Math.max(0, free - cents) / 100,
    freeShipping: cents >= free,
    unpriced: lines.filter((l) => l.value === null).length,
  };
}

export function formatEur(n) {
  return num(n).toFixed(2).replace('.', ',') + ' €';
}

export function orderListText(list) {
  if (!list) return '';
  const rows = list.lines.map(({ item, packs, value }) =>
    item.name + ' – ' + packsLabel(packs) + ' (' + num(item.packSize) + ' kpl) – '
    + (value === null ? 'hinta puuttuu' : formatEur(value)));
  rows.push('');
  rows.push('Yhteensä ' + formatEur(list.total) + (list.freeShipping
    ? ' – rahtivapaa'
    : ' – rahtivapaaseen puuttuu ' + formatEur(list.missing) + ' (rahti ' + formatEur(SHIPPING_EUR) + ')'));
  if (list.unpriced) rows.push('Hinta puuttuu ' + list.unpriced + ' tuotteelta, eikä niitä ole laskettu summaan.');
  return rows.join('\n');
}

/* ---------- kirjaukset (palauttavat uuden tuotteen, eivät muuta vanhaa) ---------- */

export function withCount(it, remaining, day = today()) {
  return { ...it, remaining: num(remaining), asOf: iso(day) };
}

export function withRefill(it, day = today()) {
  return withCount(it, Math.round(left(it, day)) + num(it.packSize), day);
}

/* ---------- apufunktiot ---------- */

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function uid() {
  return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

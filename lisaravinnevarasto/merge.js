// Kolmitieyhdistäminen tuote kerrallaan. Puhdas funktio. Testit: test/merge.test.js
// Säännöt: CLAUDE.md, osio "Synkronointi".

// Vertailu ilman, että kenttien järjestys vaikuttaa.
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}
const same = (a, b) => stable(a) === stable(b);

function byId(state) {
  const m = new Map();
  for (const it of (state && state.items) || []) m.set(it.id, it);
  return m;
}

// Palauttaa { state, conflicts }.
// conflicts: [{ id, name, kind }], kind:
//   'both-changed'          molemmat muuttivat, tämän laitteen versio jäi voimaan
//   'deleted-here-kept'     poistettiin tällä laitteella, mutta toinen muutti → säilytettiin
//   'deleted-there-kept'    poistettiin toisella laitteella, mutta tämä muutti → säilytettiin
export function merge(base, local, remote) {
  const B = byId(base), L = byId(local), R = byId(remote);
  const out = new Map();
  const conflicts = [];

  const ids = [...L.keys(), ...[...R.keys()].filter((id) => !L.has(id)), ...[...B.keys()].filter((id) => !L.has(id) && !R.has(id))];

  for (const id of ids) {
    const b = B.get(id), l = L.get(id), r = R.get(id);
    const lChanged = !same(b, l), rChanged = !same(b, r);

    if (!lChanged) { if (r) out.set(id, r); continue; }
    if (!rChanged) { if (l) out.set(id, l); continue; }
    if (same(l, r)) { if (l) out.set(id, l); continue; }

    // Molemmat muuttivat eri tavalla.
    if (l && r) {
      out.set(id, l);
      conflicts.push({ id, name: l.name, kind: 'both-changed' });
    } else if (!l) {
      out.set(id, r);
      conflicts.push({ id, name: r.name, kind: 'deleted-here-kept' });
    } else {
      out.set(id, l);
      conflicts.push({ id, name: l.name, kind: 'deleted-there-kept' });
    }
  }

  const updated = [local && local.updatedAt, remote && remote.updatedAt].filter(Boolean).sort().pop();
  const state = { v: (local && local.v) || 1, updatedAt: updated, items: [...out.values()] };
  if (!state.updatedAt) delete state.updatedAt;
  return { state, conflicts };
}

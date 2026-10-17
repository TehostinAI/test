// Käyttöliittymä. Laskenta: logic.js, tallennus: storage.js.

import {
  today, iso, fiDate, num, perDay, left, daysLeft, runOutDate, statusOf,
  sortBySoonest, shoppingList, shoppingListText, packsLabel, withCount, withRefill, esc, uid,
} from './logic.js';
import { loadState, saveState, requestPersist } from './storage.js';
import { SEED } from './seed.js';

const app = document.getElementById('app');

function getStorage() {
  try { return window.localStorage; } catch { return null; }
}
const storage = getStorage() || { getItem() { throw new Error(); }, setItem() { throw new Error(); } };

const loaded = loadState(storage, SEED);
let state = loaded.state;
let saveStatus = loaded.status === 'unavailable' ? 'unavailable' : 'idle';
const corrupt = loaded.status === 'corrupt';

/* ---------- render ---------- */

function render() {
  const day = today();
  const items = sortBySoonest(state.items, day);
  const buy = shoppingList(state.items, day);
  const soonest = items.length ? daysLeft(items[0], day) : null;

  let h = '<div class="wrap">';

  h += '<header class="head">'
     + '<span class="eyebrow">Varastosaldo</span>'
     + '<h1>Lisäravinnevarasto</h1>'
     + '<p class="lede">Saldo vähenee itsestään päivittäisen annostuksen mukaan. Kirjaa vain kun avaat uuden purkin tai lasket saldon.</p>'
     + '<div class="savebar"><span class="dot" id="savedot"></span><span id="savetext"></span></div>'
     + '</header>';

  if (corrupt) {
    h += '<p class="alert">Tallennetut tiedot olivat vioittuneet, joten lista aloitettiin tyhjästä. '
       + 'Vanhat tiedot on kopioitu talteen selaimen muistiin.</p>';
  }

  h += '<dl class="summary">'
     + '<div><dt>Tuotteita</dt><dd>' + state.items.length + '</dd></div>'
     + '<div><dt>Tilattavaa</dt><dd>' + buy.length + '</dd></div>'
     + '<div><dt>Loppuu ensin</dt><dd>' + (soonest === null ? '–' : soonest + '<small>pv</small>') + '</dd></div>'
     + '</dl>';

  if (buy.length) {
    h += '<section class="buy"><h2>Ostoslista</h2><ul>';
    buy.forEach(({ item, packs }) => {
      h += '<li><b>' + esc(item.name) + '</b><span>' + packsLabel(packs)
         + ' · ' + num(item.packSize) + ' kpl</span></li>';
    });
    h += '</ul><footer>'
       + '<button class="btn sm" data-act="copy">Kopioi lista</button>'
       + '<p>Tilaa itse, esim. sinunapteekki.fi</p>'
       + '</footer></section>';
  }

  if (!items.length) {
    h += '<p class="empty">Ei vielä yhtään lisäravinnetta.<br>Lisää ensimmäinen alta.</p>';
  }

  h += '<div class="list">';
  items.forEach((it) => {
    const st = statusOf(it, day), d = daysLeft(it, day), pd = perDay(it);
    const rem = Math.round(left(it, day));
    const thr = Math.max(1, num(it.threshold));
    const pct = d === null ? 100 : Math.max(2, Math.min(100, (d / (thr * 3)) * 100));
    const end = runOutDate(it, day);
    const label = st === 'out' ? 'Loppunut' : (st === 'low' ? 'Tilaa pian' : 'Riittää');

    h += '<article class="item ' + st + '">'
       + '<div class="itop">'
       + '<div class="iname"><h3>' + esc(it.name) + '</h3>'
       + '<span class="meta">' + (pd % 1 === 0 ? pd : pd.toFixed(1)) + ' ' + esc(it.form || 'kpl') + ' / pv'
       + (it.note ? ' · ' + esc(it.note) : '') + '</span></div>'
       + '<div class="count"><b>' + (d === null ? '–' : d) + '</b><small>PÄIVÄÄ</small></div>'
       + '</div>'
       + '<div class="mwrap"><div class="meter"><i style="width:' + pct.toFixed(1) + '%"></i><u title="tilausraja"></u></div>'
       + '<div class="mlabels"><span>≈ ' + rem + ' kpl jäljellä</span><span>'
       + (st === 'out' ? 'loppui' : 'tyhjä ' + (end ? fiDate(end) : '–')) + '</span></div></div>'
       + '<div class="chips"><span class="chip ' + st + '">' + label + '</span>'
       + '<span class="chip">tilausraja ' + num(it.threshold) + ' pv</span></div>'
       + '<div class="acts">'
       + '<button class="btn grow" data-act="refill" data-id="' + esc(it.id) + '">+ Uusi purkki</button>'
       + '<button class="btn grow" data-act="count" data-id="' + esc(it.id) + '">Laskin saldon</button>'
       + '<button class="btn ghost" data-act="edit" data-id="' + esc(it.id) + '">Muokkaa</button>'
       + '</div>'
       + '</article>';
  });
  h += '</div>';

  h += '<div class="addrow"><button class="btn primary grow" data-act="add">+ Lisää lisäravinne</button></div>';

  h += '<p class="note">Jäljellä oleva määrä on arvio: se lasketaan viimeksi kirjaamastasi saldosta '
     + 'ja päivittäisestä annostuksesta. Tarkista silloin tällöin purkista todellinen määrä ja korjaa se '
     + '“Laskin saldon” -painikkeella.</p>';

  h += '</div><dialog id="dlg"></dialog>';
  app.innerHTML = h;
  paintSave();
}

/* ---------- tallennus ---------- */

function paintSave() {
  const dot = document.getElementById('savedot'), txt = document.getElementById('savetext');
  if (!dot || !txt) return;
  const map = {
    idle:        ['', 'Päivitetty ' + (state.updatedAt ? fiDate(new Date(state.updatedAt + 'T00:00')) : '–')],
    saved:       ['ok', 'Tallennettu puhelimeen'],
    unavailable: ['bad', 'Ei tallennu: selain estää tallennuksen (yksityinen selaus?)'],
  };
  const m = map[saveStatus] || map.idle;
  dot.className = 'dot ' + m[0];
  txt.textContent = m[1];
}

function commit() {
  saveStatus = saveState(storage, state) ? 'saved' : 'unavailable';
  render();
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

/* ---------- dialogit ---------- */

function field(name, label, value, type, extra) {
  return '<label>' + esc(label) + '<input name="' + name + '" type="' + (type || 'text') + '" '
    + (type === 'number' ? 'inputmode="decimal" step="any" min="0" ' : '')
    + (extra || '') + ' value="' + esc(value) + '"></label>';
}

function openForm(item) {
  const isNew = !item;
  const it = item || { id: uid(), name: '', form: 'kapselia', perDose: 1, timesPerDay: 1, packSize: 90,
                       remaining: 0, asOf: iso(today()), threshold: 14, note: '' };
  const body = '<form method="dialog" class="dlg" id="frm">'
    + '<h2>' + (isNew ? 'Uusi lisäravinne' : 'Muokkaa') + '</h2>'
    + '<div class="fields">'
    + field('name', 'Nimi ja vahvuus', it.name, 'text', 'required placeholder="esim. Sinkki 25 mg"')
    + '<div class="f two">' + field('perDose', 'Annos kerrallaan', it.perDose, 'number')
    + field('timesPerDay', 'Kertaa päivässä', it.timesPerDay, 'number') + '</div>'
    + '<div class="f two">' + field('packSize', 'Pakkauskoko (kpl)', it.packSize, 'number')
    + field('threshold', 'Tilausraja (pv)', it.threshold, 'number') + '</div>'
    + '<div class="f two">' + field('remaining', 'Jäljellä nyt (kpl)', Math.round(left(it)), 'number')
    + field('form', 'Yksikkö', it.form, 'text', 'placeholder="kapselia"') + '</div>'
    + field('note', 'Muistiinpano', it.note, 'text', 'placeholder="esim. aamu + ilta"')
    + '</div>'
    + '<p class="hint">Tallennus asettaa saldon tälle päivälle ja alkaa laskea siitä eteenpäin.</p>'
    + '<div class="dlgacts">'
    + (isNew ? '' : '<button type="button" class="btn del" data-x="del">Poista</button>')
    + '<button type="button" class="btn" data-x="cancel">Peruuta</button>'
    + '<button type="submit" class="btn primary">Tallenna</button>'
    + '</div></form>';

  showDialog(body, (dlg) => {
    dlg.querySelector('#frm').addEventListener('submit', (e) => {
      const f = e.target.elements;
      const next = {
        id: it.id,
        name: f.name.value.trim() || 'Nimetön',
        form: f.form.value.trim() || 'kpl',
        perDose: num(f.perDose.value) || 1,
        timesPerDay: num(f.timesPerDay.value) || 1,
        packSize: num(f.packSize.value) || 0,
        threshold: num(f.threshold.value) || 14,
        remaining: num(f.remaining.value),
        asOf: iso(today()),
        note: f.note.value.trim(),
      };
      state.items = isNew ? [...state.items, next] : state.items.map((x) => (x.id === it.id ? next : x));
      dlg.close();
      commit();
    });
    const del = dlg.querySelector('[data-x="del"]');
    if (del) del.addEventListener('click', () => {
      if (!confirm('Poistetaanko ' + it.name + '?')) return;
      state.items = state.items.filter((x) => x.id !== it.id);
      dlg.close();
      commit();
    });
  });
}

function openCount(it) {
  const now = Math.round(left(it));
  const body = '<form method="dialog" class="dlg" id="frm">'
    + '<h2>' + esc(it.name) + '</h2>'
    + '<div class="fields">'
    + field('remaining', 'Montako kpl purkissa on nyt?', now, 'number', 'required autofocus')
    + '</div>'
    + '<p class="hint">Arvio tällä hetkellä: ' + now + ' kpl · kulutus ' + perDay(it) + ' kpl/pv</p>'
    + '<div class="dlgacts">'
    + '<button type="button" class="btn" data-x="cancel">Peruuta</button>'
    + '<button type="submit" class="btn primary">Tallenna saldo</button>'
    + '</div></form>';

  showDialog(body, (dlg) => {
    dlg.querySelector('#frm').addEventListener('submit', (e) => {
      const v = e.target.elements.remaining.value;
      state.items = state.items.map((x) => (x.id === it.id ? withCount(x, v) : x));
      dlg.close();
      commit();
    });
  });
}

function showDialog(html, wire) {
  const dlg = document.getElementById('dlg');
  if (!dlg) return;
  dlg.innerHTML = html;
  dlg.querySelectorAll('[data-x="cancel"]').forEach((b) => b.addEventListener('click', () => dlg.close()));
  wire(dlg);
  dlg.showModal();
}

/* ---------- toiminnot ---------- */

const byId = (id) => state.items.find((x) => x.id === id);

app.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.getAttribute('data-act');
  const it = byId(b.getAttribute('data-id'));

  if (act === 'add') return openForm(null);
  if (act === 'edit' && it) return openForm(it);
  if (act === 'count' && it) return openCount(it);

  if (act === 'refill' && it) {
    state.items = state.items.map((x) => (x.id === it.id ? withRefill(x) : x));
    commit();
    toast('Lisätty ' + num(it.packSize) + ' kpl');
    return;
  }

  if (act === 'copy') {
    const text = shoppingListText(state.items);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast('Ostoslista kopioitu'),
        () => toast('Kopiointi ei onnistunut'));
    } else {
      toast('Kopiointi ei onnistunut');
    }
  }
});

// Päivä vaihtuu, kun sovellus on auki taustalla: piirretään uudelleen palatessa.
let renderedDay = iso(today());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && iso(today()) !== renderedDay) {
    renderedDay = iso(today());
    render();
  }
});

render();
requestPersist();

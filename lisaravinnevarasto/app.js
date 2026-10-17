// Käyttöliittymä. Laskenta: logic.js, tallennus: storage.js, synkronointi: sync.js.

import {
  today, iso, fiDate, num, perDay, left, daysLeft, runOutDate, statusOf,
  sortBySoonest, orderList, orderListText, formatEur, hasPrice, packsLabel, withCount, withRefill, esc, uid,
} from './logic.js';
import { loadState, saveState, requestPersist } from './storage.js';
import { SEED } from './seed.js';
import { createClient, REPO } from './github.js';
import { syncNow, applyResult, markDirty, loadToken, saveToken, clearToken } from './sync.js';

const app = document.getElementById('app');

function getStorage() {
  try { return window.localStorage; } catch { return null; }
}
const storage = getStorage()
  || { getItem() { throw new Error(); }, setItem() { throw new Error(); }, removeItem() { throw new Error(); } };

const loaded = loadState(storage, SEED);
let state = loaded.state;
let saveStatus = loaded.status === 'unavailable' ? 'unavailable' : 'idle';
const corrupt = loaded.status === 'corrupt';

// Synkronoinnin tila: off | syncing | ok | offline | auth | ratelimit | corrupt | error
let sync = { status: loadToken(storage) ? 'syncing' : 'off', at: null };
let conflicts = [];

/* ---------- render ---------- */

function render() {
  const day = today();
  const items = sortBySoonest(state.items, day);
  const order = orderList(state.items, day);
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

  if (conflicts.length) {
    h += '<div class="alert" role="alert"><b>Kaikki toisen laitteen muutokset eivät mahtuneet mukaan</b><ul>'
       + conflicts.map((c) => '<li>' + esc(conflictText(c)) + '</li>').join('')
       + '</ul><button class="btn sm" data-act="dismiss-conflicts">Selvä</button></div>';
  }

  h += '<dl class="summary">'
     + '<div><dt>Tuotteita</dt><dd>' + state.items.length + '</dd></div>'
     + '<div><dt>Tilattavaa</dt><dd>' + (order ? order.lines.length : 0) + '</dd></div>'
     + '<div><dt>Loppuu ensin</dt><dd>' + (soonest === null ? '–' : soonest + '<small>pv</small>') + '</dd></div>'
     + '</dl>';

  if (order) {
    h += '<section class="buy"><h2>Ostoslista</h2><ul>';
    order.lines.forEach(({ item, packs, value, filler }) => {
      h += '<li><b>' + esc(item.name) + (filler ? ' <small class="fill">täyte</small>' : '') + '</b>'
         + '<span>' + packsLabel(packs) + ' · ' + (value === null ? 'hinta puuttuu' : formatEur(value)) + '</span></li>';
    });
    h += '</ul><div class="total"><b>Yhteensä ' + formatEur(order.total) + '</b>'
       + (order.freeShipping
         ? '<span class="free">Rahtivapaa ✓</span>'
         : '<span class="short">Rahtivapaaseen puuttuu ' + formatEur(order.missing) + '</span>')
       + '</div>';
    if (order.lines.some((l) => l.filler)) {
      h += '<p>Täyte = seuraavaksi loppuva tuote, joka on lisätty, jotta tilaus on rahtivapaa.</p>';
    }
    if (order.unpriced) {
      h += '<p>Hinta puuttuu ' + order.unpriced + ' tuotteelta. Lisää hinnat sinunapteekki.fi:stä Muokkaa-kohdasta.</p>';
    }
    h += '<footer>'
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
       + '<span class="chip">tilausraja ' + num(it.threshold) + ' pv</span>'
       + (hasPrice(it) ? '<span class="chip">' + formatEur(it.price) + ' / purkki</span>' : '')
       + '</div>'
       + '<div class="acts">'
       + '<button class="btn grow" data-act="refill" data-id="' + esc(it.id) + '">+ Uusi purkki</button>'
       + '<button class="btn grow" data-act="count" data-id="' + esc(it.id) + '">Laskin saldon</button>'
       + '<button class="btn ghost" data-act="edit" data-id="' + esc(it.id) + '">Muokkaa</button>'
       + '</div>'
       + '</article>';
  });
  h += '</div>';

  h += '<div class="addrow"><button class="btn primary grow" data-act="add">+ Lisää lisäravinne</button></div>';

  h += '<section class="sync"><h2>Synkronointi</h2>';
  if (!loadToken(storage)) {
    h += '<p>Pidä samat tiedot puhelimessa ja iPadissa.</p>'
       + '<div class="acts"><button class="btn" data-act="sync-setup">Ota käyttöön</button></div>';
  } else {
    h += '<p>Tiedot synkronoidaan yksityiseen repoon ' + esc(REPO) + '.</p>'
       + '<div class="acts"><button class="btn" data-act="sync-now">Synkronoi nyt</button>'
       + '<button class="btn ghost" data-act="sync-remove">Poista avain tästä laitteesta</button></div>';
  }
  h += '</section>';

  h += '<p class="note">Jäljellä oleva määrä on arvio: se lasketaan viimeksi kirjaamastasi saldosta '
     + 'ja päivittäisestä annostuksesta. Tarkista silloin tällöin purkista todellinen määrä ja korjaa se '
     + '“Laskin saldon” -painikkeella.</p>';

  h += '</div>';
  app.innerHTML = h;
  paintSave();
}

/* ---------- tallennus ---------- */

function paintSave() {
  const dot = document.getElementById('savedot'), txt = document.getElementById('savetext');
  if (!dot || !txt) return;
  const map = {
    idle:        ['', 'Päivitetty ' + (state.updatedAt ? fiDate(new Date(state.updatedAt + 'T00:00')) : '–')],
    saved:       ['ok', 'Tallennettu laitteelle'],
    unavailable: ['bad', 'Ei tallennu: selain estää tallennuksen (yksityinen selaus?)'],
  };
  const syncMap = {
    syncing:   ['busy', 'Synkronoidaan…'],
    ok:        ['ok', 'Synkronoitu ' + clock(sync.at)],
    offline:   ['busy', 'Ei yhteyttä – muutokset lähtevät, kun yhteys palaa'],
    auth:      ['bad', 'Avain ei kelpaa – tarkista synkronointi'],
    ratelimit: ['busy', 'GitHub ruuhkautunut – yritetään myöhemmin'],
    corrupt:   ['bad', 'Pilven tiedosto on vioittunut – synkronointi pysäytetty'],
    error:     ['bad', 'Synkronointi epäonnistui – yritetään myöhemmin'],
  };
  const m = saveStatus === 'unavailable' ? map.unavailable
    : (syncMap[sync.status] || map[saveStatus] || map.idle);
  dot.className = 'dot ' + m[0];
  txt.textContent = m[1];
}

function commit() {
  saveStatus = saveState(storage, state) ? 'saved' : 'unavailable';
  markDirty(storage);
  render();
  scheduleSync(2000);
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

/* ---------- synkronointi ---------- */

let syncing = false, again = false, syncTimer = null;

function clock(d) {
  if (!d) return '';
  const hm = 'klo ' + d.getHours() + '.' + String(d.getMinutes()).padStart(2, '0');
  return iso(d) === iso(today()) ? hm : fiDate(d) + ' ' + hm;
}

function conflictText(c) {
  if (c.kind === 'deleted-here-kept') return c.name + ': poistit tuotteen tällä laitteella, mutta sitä muutettiin toisella. Tuote palautettiin.';
  if (c.kind === 'deleted-there-kept') return c.name + ': tuote oli poistettu toisella laitteella, mutta muutit sitä täällä. Tuote säilytettiin.';
  return c.name + ': molemmilla laitteilla oli muutos. Tämän laitteen muutos jäi voimaan, toisen laitteen muutos jäi pois.';
}

function scheduleSync(ms) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => runSync(), ms);
}

// force: käyttäjä painoi "Synkronoi nyt". Avainvirheen jälkeen automaattiset
// yritykset pysähtyvät, kunnes avain vaihdetaan tai käyttäjä yrittää itse.
async function runSync(force = false) {
  const token = loadToken(storage);
  if (!token) { sync = { status: 'off', at: null }; paintSave(); return; }
  if (!force && (sync.status === 'auth' || sync.status === 'corrupt')) return;
  if (syncing) { again = true; return; }

  syncing = true;
  sync = { ...sync, status: 'syncing' };
  paintSave();
  const snapshot = structuredClone(state);
  const res = await syncNow({ client: createClient({ token }), storage, local: snapshot, confirmReplace });
  syncing = false;

  if (res.status === 'synced') {
    const r = applyResult(snapshot, state, res.state);
    state = r.state;
    saveState(storage, state);
    if (r.dirty) { markDirty(storage); again = true; }
    conflicts = conflicts.concat(res.conflicts);
    sync = { status: 'ok', at: new Date() };
    render();
  } else if (res.status === 'unchanged') {
    sync = { status: 'ok', at: new Date() };
    paintSave();
  } else if (res.status === 'declined') {
    clearToken(storage);
    sync = { status: 'off', at: null };
    render();
    toast('Synkronointia ei otettu käyttöön');
  } else {
    sync = { status: ['offline', 'auth', 'ratelimit', 'corrupt'].includes(res.error) ? res.error : 'error', at: sync.at };
    paintSave();
  }

  if (again) { again = false; scheduleSync(500); }
}

function confirmReplace(remote) {
  return new Promise((resolve) => {
    const when = remote.updatedAt ? fiDate(new Date(remote.updatedAt + 'T00:00')) : '–';
    const body = '<form method="dialog" class="dlg" id="frm">'
      + '<h2>Pilvessä on jo tiedot</h2>'
      + '<p class="hint">Pilvessä on ' + remote.items.length + ' tuotetta (päivitetty ' + esc(when) + '). '
      + 'Korvataanko tämän laitteen ' + state.items.length + ' tuotetta niillä?</p>'
      + '<div class="dlgacts">'
      + '<button type="button" class="btn" data-x="cancel">Ei, peruuta</button>'
      + '<button type="submit" class="btn primary">Korvaa</button>'
      + '</div></form>';
    // Ei kuunnella 'close'-tapahtumaa: edellisen dialogin sulkeminen jonottaa
    // sellaisen, ja se tulkittaisiin heti vastaukseksi "ei".
    showDialog(body, (dlg) => {
      let answered = false;
      const ac = new AbortController();
      const answer = (v) => { if (!answered) { answered = true; ac.abort(); resolve(v); } };
      dlg.querySelector('#frm').addEventListener('submit', () => answer(true));
      dlg.querySelector('[data-x="cancel"]').addEventListener('click', () => answer(false));
      dlg.addEventListener('cancel', () => answer(false), { signal: ac.signal });
    });
  });
}

function openSyncSetup() {
  const body = '<form method="dialog" class="dlg" id="frm">'
    + '<h2>Synkronointi</h2>'
    + '<p class="hint">Liitä GitHubissa luomasi avain (alkaa <code>github_pat_</code>). '
    + 'Avain tallentuu vain tälle laitteelle, ja se toimii vain repoon ' + esc(REPO) + '.</p>'
    + '<div class="fields">'
    + field('token', 'Avain', '', 'password', 'required autocomplete="off" autocapitalize="off" spellcheck="false"')
    + '</div>'
    + '<p class="err" id="tokerr" hidden></p>'
    + '<div class="dlgacts">'
    + '<button type="button" class="btn" data-x="cancel">Peruuta</button>'
    + '<button type="submit" class="btn primary" id="tokok">Yhdistä</button>'
    + '</div></form>';

  showDialog(body, (dlg) => {
    dlg.querySelector('#frm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = e.target.elements.token.value.trim();
      const btn = dlg.querySelector('#tokok'), err = dlg.querySelector('#tokerr');
      btn.disabled = true;
      btn.textContent = 'Tarkistetaan…';
      err.hidden = true;
      try {
        await createClient({ token }).check();
      } catch (ex) {
        err.textContent = ex.kind === 'offline' ? 'Ei yhteyttä. Yritä uudelleen.'
          : ex.kind === 'auth' ? 'Avain ei kelpaa tai sillä ei ole pääsyä repoon ' + REPO + '.'
          : 'Tarkistus epäonnistui (' + (ex.kind || 'tuntematon virhe') + ').';
        err.hidden = false;
        btn.disabled = false;
        btn.textContent = 'Yhdistä';
        return;
      }
      saveToken(storage, token);
      dlg.close();
      render();
      runSync(true);
    });
  });
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
    + field('form', 'Yksikkö', it.form, 'text', 'placeholder="kapselia"') + '</div>'
    + '<div class="f two">' + field('remaining', 'Jäljellä nyt (kpl)', Math.round(left(it)), 'number')
    + field('threshold', 'Tilausraja (pv)', it.threshold, 'number') + '</div>'
    // type="text": iPhonen numerokenttä ei aina hyväksy pilkkua (24,90).
    + field('price', 'Hinta / purkki (€), sinunapteekki.fi',
      hasPrice(it) ? num(it.price).toFixed(2).replace('.', ',') : '', 'text', 'inputmode="decimal" placeholder="esim. 24,90"')
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
      const price = num(f.price.value);
      if (f.price.value.trim() && price > 0) next.price = Math.round(price * 100) / 100;
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
  if (dlg.open) dlg.close();
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

  if (act === 'sync-setup') return openSyncSetup();
  if (act === 'sync-now') return runSync(true);
  if (act === 'dismiss-conflicts') { conflicts = []; render(); return; }
  if (act === 'sync-remove') {
    if (!confirm('Poistetaanko avain tästä laitteesta? Tiedot säilyvät laitteella, mutta ne eivät enää synkronoidu.')) return;
    clearToken(storage);
    sync = { status: 'off', at: null };
    render();
    return;
  }

  if (act === 'copy') {
    const text = orderListText(orderList(state.items));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast('Ostoslista kopioitu'),
        () => toast('Kopiointi ei onnistunut'));
    } else {
      toast('Kopiointi ei onnistunut');
    }
  }
});

// Palattaessa sovellukseen: synkronoidaan, ja jos päivä vaihtui, piirretään uudelleen.
let renderedDay = iso(today());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (iso(today()) !== renderedDay) {
    renderedDay = iso(today());
    render();
  }
  runSync();
});
window.addEventListener('online', () => runSync());

render();
requestPersist();
runSync();

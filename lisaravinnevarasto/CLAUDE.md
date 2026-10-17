# Lisäravinnevarasto – arkkitehtuuri

Lue ensin `VISION.md`. Se kertoo MITÄ ja MIKSI. Tämä tiedosto kertoo MITEN.
Jos pyyntö on ristiriidassa vision kanssa, kysy ennen kuin teet mitään.

## Yhdellä silmäyksellä

Staattinen web-sovellus ilman palvelinta. Tiedot ovat puhelimen selaimessa
(localStorage). Sovellus julkaistaan ilmaiseksi GitHub Pagesissa ja lisätään
puhelimen kotinäytölle.

```
Puhelin
 └─ Selain / kotinäytön kuvake
     ├─ index.html, style.css, app.js, logic.js, storage.js, seed.js  ← GitHub Pages
     └─ localStorage: "lisaravinnevarasto.v1"                  ← kaikki data
```

## Päätökset ja perustelut

| Päätös | Miksi | Hylätyt vaihtoehdot |
|---|---|---|
| Pelkkä HTML, CSS ja JavaScript, ei frameworkia | Visio: nolla ylläpitoa. Ei riippuvuuksia, jotka vanhenevat. Prototyyppi on jo kirjoitettu näin. | React, Vue (vaativat build-vaiheen ja npm-paketit) |
| Ei build-vaihetta | Tiedostot julkaistaan sellaisenaan. Mikään ei voi hajota buildissa. | Vite, webpack |
| localStorage | Visio: yksi puhelin, ei synkronointia, ei kirjautumista. Ilmainen ja toimii ilman nettiä. | Supabase, Firebase (kirjautuminen, palvelu voi muuttua), IndexedDB (turhan monimutkainen 10 tuotteelle) |
| GitHub Pages | Repo on julkinen, joten Pages on ilmainen. Ei uutta palvelua tai tunnusta. | Netlify, Cloudflare Pages (toimisivat, mutta vaativat uuden tilin) |
| Lähtödata koodissa (`seed.js`) | Käyttäjän päätös: julkisuus on ok. | Tuontilinkki, käsin syöttö |
| Laskentalogiikka omassa tiedostossa (`logic.js`) | Puhtaat funktiot voi testata ilman selainta. Laskenta on sovelluksen tärkein osa. | Kaikki yhdessä tiedostossa kuten prototyypissä |
| Tallennus omassa tiedostossa (`storage.js`), localStorage annetaan parametrina | Lataussäännöt (seed, rikkinäinen data, estetty tallennus) voi testata ilman selainta. Lisätty vaiheessa 2. | Tallennus `app.js`:ssä (ei testattavissa) |
| Ei service workeria | Visio ei vaadi offline-käyttöä. Service worker tuo välimuistiongelmia ("miksi päivitys ei näy?"). | Täysi PWA |
| Ulkoasu kopioidaan prototyypistä | Visio: näyttää samalta kuin nyt. | Uusi design |

## Tiedostorakenne

```
lisaravinnevarasto/
├─ VISION.md            visio, ei muuteta ilman käyttäjää
├─ CLAUDE.md            tämä tiedosto
├─ index.html           sivun runko, lataa muut tiedostot
├─ style.css            ulkoasu (prototyypin CSS)
├─ logic.js             puhtaat funktiot: päivämäärät, saldo, tila, ostoslista
├─ storage.js           lataus ja tallennus localStorageen
├─ app.js               käyttöliittymä: renderöinti, dialogit
├─ seed.js              prototyypin 10 tuotetta lähtödatana
├─ manifest.webmanifest kotinäytön nimi, väri ja kuvake
├─ icon.svg             kuvakkeen lähdekuva ja selaimen välilehden kuvake
├─ icon-192.png, icon-512.png, apple-touch-icon.png   luotu icon.svg:stä
└─ test/               logic.test.js, storage.test.js
```

Kaikki JS-tiedostot ovat ES-moduuleja (`<script type="module">`, `import`/`export`).

## Tietomalli

localStorage-avain `lisaravinnevarasto.v1`, arvo JSON:

```json
{
  "v": 1,
  "updatedAt": "2026-10-17",
  "items": [
    {
      "id": "imtvo7031zklu",
      "name": "Tripla Magnesium Puhdistamo",
      "form": "kapselia",
      "perDose": 2,
      "timesPerDay": 1,
      "packSize": 240,
      "threshold": 14,
      "remaining": 243,
      "asOf": "2026-09-10",
      "note": "aamu"
    }
  ]
}
```

- `remaining` on saldo päivänä `asOf`. Nykyinen saldo lasketaan aina:
  `remaining - kuluneet päivät × perDose × timesPerDay`, ei koskaan alle nollan.
- Kun käyttäjä kirjaa saldon tai uuden purkin, `remaining` päivitetään ja `asOf` = tänään.
- Päivämäärät ovat paikallista aikaa muodossa `YYYY-MM-DD`. Ei UTC-muunnoksia.
- Tila: `out` jos päiviä ≤ 0, `low` jos päiviä ≤ `threshold`, muuten `ok`.
- Ostoslista: purkkeja niin monta, että saldo riittää 60 päivää, vähintään 1.

## Lähtödata

- Jos avainta `lisaravinnevarasto.v1` ei ole, tallennetaan `seed.js`:n data.
- Jos avain on olemassa (myös tyhjällä listalla), seediä EI käytetä. Muuten
  käyttäjän poistamat tuotteet palaisivat.
- Jos tallennettu data on rikki, se kopioidaan avaimeen
  `lisaravinnevarasto.v1.rikki-YYYY-MM-DD` ja aloitetaan tyhjästä listasta.
- Jos localStorage ei toimi, sovellus näyttää lähtödatan, mutta muutokset
  eivät tallennu. Käyttöliittymä kertoo tästä selvästi.

## Säännöt

- Ei npm-paketteja, CDN-kirjastoja eikä build-työkaluja. Ainoa ulkoinen
  resurssi on Google Fonts, kuten prototyypissä.
- Kaikki käyttöliittymän tekstit suomeksi.
- Tuotteen poisto kysyy aina vahvistuksen (käyttäjän päätös vaiheessa 3).
- Kotinäytön nimi on "Lisäravinteet": iPhone katkaisee yli ~12 merkin nimet.
- Käyttäjän syöte escapetaan aina ennen HTML:ään lisäämistä (`esc()`).
- Muutos `logic.js`:ään tai `storage.js`:ään → lisää tai päivitä testi.
- Älä lisää ominaisuuksia, joita VISION.md ei mainitse. Ehdota ne käyttäjälle.
- Jos tietomalli muuttuu, nosta versiota (`v2`) ja kirjoita siirto vanhasta.
- Selaimen tallennus voi epäonnistua (yksityinen selaus). Kääri
  localStorage-kutsut try/catchiin ja näytä käyttäjälle selkeä viesti.

## Komennot

```bash
# Paikallinen esikatselu: http://localhost:8000
python3 -m http.server 8000 --directory lisaravinnevarasto

# Testit (Node 22+, ei riippuvuuksia). Aja myös Suomen ajassa kesäaikatestien takia.
node --test 'lisaravinnevarasto/test/*.test.js'
TZ=Europe/Helsinki node --test 'lisaravinnevarasto/test/*.test.js'
```

## Kuvakkeet

PNG-kuvakkeet luodaan `icon.svg`:stä renderöimällä se selaimessa kokoihin
180 (`apple-touch-icon.png`), 192 ja 512. iPhone ei tue SVG-kotinäyttökuvaketta.
Jos `icon.svg` muuttuu, luo PNG:t uudelleen.

## Julkaisu

- GitHub Pages: repo `TehostinAI/test` → Settings → Pages → Deploy from branch,
  kansio `/ (root)`.
- Osoite: `https://tehostinai.github.io/test/lisaravinnevarasto/`
- Julkaisu tapahtuu pushaamalla. Muutos näkyy noin minuutin päästä.

## Tunnetut riskit

Käyttäjällä on iPhone, joten testaa ja ohjeista ensisijaisesti Safarille.

- **Safari voi poistaa localStorage-tiedot**, jos sivulla ei käydä 7 päivään.
  Kotinäytölle lisätty sovellus ei kuulu tämän säännön piiriin. Käyttäjää
  ohjeistetaan lisäämään sovellus kotinäytölle. Lisäksi kutsutaan
  `navigator.storage.persist()`.
- Selaimen tietojen tyhjennys poistaa varaston. Visio hyväksyy tämän.

# Lisäravinnevarasto – arkkitehtuuri

Lue ensin `VISION.md`. Se kertoo MITÄ ja MIKSI. Tämä tiedosto kertoo MITEN.
Jos pyyntö on ristiriidassa vision kanssa, kysy ennen kuin teet mitään.

## Yhdellä silmäyksellä

Staattinen web-sovellus ilman omaa palvelinta. Jokaisella laitteella on oma
kopio tiedoista selaimessa (localStorage), ja laitteet synkronoivat sen
yksityiseen GitHub-repoon GitHubin rajapinnan kautta. Sovellus julkaistaan
ilmaiseksi GitHub Pagesissa ja lisätään iPhonen ja iPadin kotinäytölle.

```
iPhone / iPad (kotinäytön sovellus)
 ├─ sovelluksen tiedostot              ← GitHub Pages (julkinen repo TehostinAI/test)
 ├─ localStorage
 │   ├─ "lisaravinnevarasto.v1"        tiedot (paikallinen kopio)
 │   ├─ "lisaravinnevarasto.sync"      synkronoinnin tila: sha, base, dirty
 │   └─ "lisaravinnevarasto.token"     laitteen GitHub-avain
 └─ fetch → api.github.com
             └─ TehostinAI/lisaravinnedata (YKSITYINEN) / varasto.json
```

Synkronointi on lisäosa. Ilman avainta sovellus toimii kuten ennenkin, vain paikallisesti.

## Päätökset ja perustelut

| Päätös | Miksi | Hylätyt vaihtoehdot |
|---|---|---|
| Pelkkä HTML, CSS ja JavaScript, ei frameworkia | Visio: nolla ylläpitoa. Ei riippuvuuksia, jotka vanhenevat. Prototyyppi on jo kirjoitettu näin. | React, Vue (vaativat build-vaiheen ja npm-paketit) |
| Ei build-vaihetta | Tiedostot julkaistaan sellaisenaan. Mikään ei voi hajota buildissa. | Vite, webpack |
| localStorage paikallisena kopiona | Sovellus aukeaa heti ja toimii ilman nettiä (visio). Synkronointi rakentuu sen päälle. | Pelkkä etätallennus (ei toimi ilman nettiä, hidas avautuminen) |
| Synkronointi yksityiseen GitHub-repoon (`TehostinAI/lisaravinnedata`) | Visio: ilmainen, ei uusia tilejä, tuotelista ei julkinen. Jokainen tallennus on commit, joten versiohistoria toimii samalla varmuuskopiona. Lisätty synkronoinnin yhteydessä. | Supabase, Firebase (uusi tili), gist (vain "salainen linkki", ei yksityinen, eikä rajattu avain toimi gisteille), sama julkinen repo (tiedot julkisia) |
| Fine-grained-avain, joka toimii vain data-repoon (Contents: read/write) | Jos avain vuotaa, vahinko rajoittuu tähän yhteen repoon. Käyttäjä valitsi "avain kerran per laite". | Classic token (pääsy kaikkiin repoihin), avain koodissa (julkinen → GitHub mitätöi sen) |
| Ristiriidat yhdistetään tuote kerrallaan (kolmitie) | Visio: mikään kirjaus ei saa kadota huomaamatta. Eri tuotteiden muutokset yhdistyvät automaattisesti. Saman tuotteen ristiriidassa tämän laitteen muutos voittaa, ja käyttäjälle kerrotaan, mikä toisen laitteen muutos jäi pois. | "Viimeisin voittaa" koko tiedostolle (hävittää hiljaa), aikaleimat per tuote (laitteiden kellot voivat erota) |
| GitHub Pages | Repo on julkinen, joten Pages on ilmainen. Ei uutta palvelua tai tunnusta. | Netlify, Cloudflare Pages (toimisivat, mutta vaativat uuden tilin) |
| Lähtödata koodissa (`seed.js`) | Käyttäjän päätös: julkisuus on ok. | Tuontilinkki, käsin syöttö |
| Laskentalogiikka omassa tiedostossa (`logic.js`) | Puhtaat funktiot voi testata ilman selainta. Laskenta on sovelluksen tärkein osa. | Kaikki yhdessä tiedostossa kuten prototyypissä |
| Tallennus omassa tiedostossa (`storage.js`), localStorage annetaan parametrina | Lataussäännöt (seed, rikkinäinen data, estetty tallennus) voi testata ilman selainta. | Tallennus `app.js`:ssä (ei testattavissa) |
| Synkronointi kolmessa tiedostossa: `merge.js`, `github.js`, `sync.js` | Yhdistäminen on puhdas funktio. GitHub-kutsut saavat `fetch`in parametrina, joten molemmat voi testata ilman nettiä. | Kaikki `app.js`:ssä |
| Ei service workeria | Service worker tuo välimuistiongelmia ("miksi päivitys ei näy?"). localStorage riittää offline-käyttöön, kun sovellus on kerran latautunut. | Täysi PWA |
| Ulkoasu kopioidaan prototyypistä | Visio: näyttää samalta kuin nyt. | Uusi design |

## Tiedostorakenne

```
lisaravinnevarasto/
├─ VISION.md            visio, ei muuteta ilman käyttäjää
├─ CLAUDE.md            tämä tiedosto
├─ PLAN.md              toteutusvaiheet
├─ index.html           sivun runko, lataa muut tiedostot
├─ style.css            ulkoasu (prototyypin CSS)
├─ logic.js             puhtaat funktiot: päivämäärät, saldo, tila, ostoslista
├─ storage.js           lataus ja tallennus localStorageen
├─ merge.js             kolmitieyhdistäminen (puhdas funktio)
├─ github.js            GitHub Contents API: lue ja kirjoita varasto.json
├─ sync.js              synkronoinnin kulku: hae → yhdistä → lähetä
├─ app.js               käyttöliittymä: renderöinti, dialogit, synkronoinnin käynnistys
├─ seed.js              prototyypin 10 tuotetta lähtödatana
├─ manifest.webmanifest kotinäytön nimi, väri ja kuvake
├─ icon.svg             kuvakkeen lähdekuva ja selaimen välilehden kuvake
├─ icon-192.png, icon-512.png, apple-touch-icon.png   luotu icon.svg:stä
└─ test/               logic, storage, merge, github, sync -testit
```

Kaikki JS-tiedostot ovat ES-moduuleja (`<script type="module">`, `import`/`export`).

## Tietomalli

localStorage-avain `lisaravinnevarasto.v1`, arvo JSON. Sama muoto on
data-repon tiedostossa `varasto.json`.

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

Synkronoinnin tila, avain `lisaravinnevarasto.sync`:

```json
{ "sha": "…", "base": { "v": 1, "items": [] }, "dirty": false, "syncedAt": "2026-10-17T14:05:00Z" }
```

- `sha`: data-repon `varasto.json`:n versio, johon tämän laitteen tiedot perustuvat.
- `base`: tuon version sisältö. Tarvitaan kolmitieyhdistämiseen.
- `dirty`: laitteella on muutoksia, joita ei ole vielä lähetetty.

## Lähtödata

- Jos avainta `lisaravinnevarasto.v1` ei ole, tallennetaan `seed.js`:n data.
- Jos avain on olemassa (myös tyhjällä listalla), seediä EI käytetä. Muuten
  käyttäjän poistamat tuotteet palaisivat.
- Jos tallennettu data on rikki, se kopioidaan avaimeen
  `lisaravinnevarasto.v1.rikki-YYYY-MM-DD` ja aloitetaan tyhjästä listasta.
- Jos localStorage ei toimi, sovellus näyttää lähtödatan, mutta muutokset
  eivät tallennu. Käyttöliittymä kertoo tästä selvästi.

## Synkronointi

Milloin: sovellus avataan, sovellus palaa näkyviin (`visibilitychange`), netti
palaa (`online`) ja 2 s viimeisen muutoksen jälkeen. Synkronointeja on
käynnissä vain yksi kerrallaan.

Kulku:
1. Jokainen muutos tallennetaan heti localStorageen ja `dirty = true`.
2. Hae `varasto.json` (GET, `cache: 'no-store'`).
3. Jos etäversion `sha` on sama kuin oma `sha`: lähetä, jos `dirty`.
4. Jos `sha` on eri ja `!dirty`: ota etäversio sellaisenaan.
5. Jos `sha` on eri ja `dirty`: yhdistä `merge(base, local, remote)` ja lähetä tulos.
6. Lähetys: PUT, mukana luettu `sha`. Jos vastaus on 409 (joku ehti väliin),
   aloita kohdasta 2. Enintään 3 yritystä.
7. Onnistumisen jälkeen `sha` ja `base` päivitetään, ja `dirty = false`.

Yhdistäminen (`merge.js`), tuote kerrallaan `id`:n perusteella:
- Muuttunut vain toisella puolella → otetaan se.
- Muuttunut molemmilla eri tavalla → tämä laite voittaa, ja ristiriita raportoidaan.
- Poistettu toisella ja muutettu toisella → muutettu säilyy, ja asia raportoidaan.
- Lisätty jommallakummalla → mukaan.
- Raportoidut ristiriidat näytetään käyttäjälle tuotteen nimellä.

Ensimmäinen kytkentä laitteella (ei `sha`:ta):
- Etätiedostoa ei ole (404) → lähetetään laitteen tiedot. Tehdään iPhonella ensin.
- Etätiedosto on olemassa → kysytään vahvistus: "Pilvessä on N tuotetta
  (päivitetty X). Korvataanko tämän laitteen tiedot?" Ei = ei kytketä.

Muokkaus synkronoinnin aikana: synkronoinnille annetaan kopio tilasta. Jos
käyttäjä muutti tietoja sillä välin, `applyResult(kopio, nykyinen, tulos)`
yhdistää muutokset tulokseen (`merge`), ja uusi synkronointi ajastetaan.

Virheet:
- Ei verkkoa → `dirty` säilyy, yritetään seuraavalla kerralla (`online`, `visibilitychange`).
- 401/403/404 repoon → "Avain ei kelpaa tai repoa ei löydy". Synkronointi
  pysähtyy, kunnes avain vaihdetaan. Paikalliset tiedot säilyvät.

GitHub-rajapinta: `GET/PUT https://api.github.com/repos/TehostinAI/lisaravinnedata/contents/varasto.json`,
otsakkeet `Authorization: Bearer <avain>`, `Accept: application/vnd.github+json`,
`X-GitHub-Api-Version: 2022-11-28`. Sisältö on base64-muodossa, ja ääkkösten takia
UTF-8 koodataan erikseen (`TextEncoder`), ei pelkällä `btoa`:lla.

## Säännöt

- Ei npm-paketteja, CDN-kirjastoja eikä build-työkaluja. Ainoat ulkoiset
  resurssit ovat Google Fonts (CSS) ja api.github.com.
- Kaikki käyttöliittymän tekstit suomeksi.
- Tuotteen poisto kysyy aina vahvistuksen (käyttäjän päätös vaiheessa 3).
- Kotinäytön nimi on "Lisäravinteet": iPhone katkaisee yli ~12 merkin nimet.
- `<dialog id="dlg">` on `index.html`:ssä eikä `render()`:in piirtämässä alueessa.
  Taustasynkronointi kutsuu `render()`:iä, eikä se saa sulkea auki olevaa dialogia.
- Dialogin vastausta ei päätellä `close`-tapahtumasta: edellisen dialogin
  sulkeminen jonottaa sellaisen, ja se tulkittaisiin seuraavan dialogin vastaukseksi.
  Kuuntele omia painikkeita ja `cancel`-tapahtumaa (Esc).
- Käyttäjän syöte escapetaan aina ennen HTML:ään lisäämistä (`esc()`).
  Tämä on nyt tietoturvakriittistä, koska XSS voisi lukea avaimen.
- Avainta ei koskaan lokiteta, näytetä kokonaan eikä lähetetä muualle kuin api.github.com:iin.
- Muutos `logic.js`:ään, `storage.js`:ään, `merge.js`:ään, `github.js`:ään tai
  `sync.js`:ään → lisää tai päivitä testi.
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

- GitHub Pages: repo `TehostinAI/test` → Settings → Pages → Deploy from branch
  `claude/lisaravinnevarasto`, kansio `/ (root)`. Otettu käyttöön 17.10.2026.
- Julkaisun tilan voi tarkistaa GitHub Actionsin ajosta "pages build and deployment".
- Osoite: `https://tehostinai.github.io/test/lisaravinnevarasto/`
- Julkaisu tapahtuu pushaamalla. Muutos näkyy noin minuutin päästä.

## Synkronoinnin käyttöönotto (käyttäjä tekee)

1. Luo yksityinen repo `TehostinAI/lisaravinnedata` (tyhjä, Private).
2. GitHub → Settings → Developer settings → Fine-grained tokens → Generate:
   Repository access: Only select → `lisaravinnedata`;
   Permissions: Contents = Read and write. Ei muita oikeuksia.
3. iPhone ensin: sovelluksen asetukset → liitä avain → tiedot lähtevät repoon.
4. iPad: lisää sovellus kotinäytölle → liitä sama avain → vahvista tietojen haku.

Otettu käyttöön 17.10.2026 iPhonella ja iPadilla. Käyttäjän avain ei vanhene
("never expire", käyttäjän tietoinen valinta). Jos avain vuotaa, se poistetaan GitHubista
(Settings → Developer settings → Fine-grained tokens) ja tehdään uusi.

## Tunnetut riskit

Käyttäjällä on iPhone ja iPad, joten testaa ja ohjeista ensisijaisesti Safarille.

- **Kaikki `tehostinai.github.io`-sivut jakavat saman localStoragen.** Mikä
  tahansa muu käyttäjän Pages-sivu (esim. repon juuren `index.html`) voisi
  lukea avaimen. Älä julkaise käyttäjän Pagesissa vierasta tai epäluotettavaa koodia.
- **Avain voi vanhentua** (käyttäjä valitsee voimassaolon). Silloin sovellus
  näyttää "Avain ei kelpaa", ja käyttäjä tekee uuden avaimen kohdan 2 mukaan.
- **Safari voi poistaa localStorage-tiedot**, jos sivulla ei käydä 7 päivään.
  Kotinäytölle lisätty sovellus ei kuulu tämän säännön piiriin. Lisäksi
  kutsutaan `navigator.storage.persist()`. Synkronoinnin kanssa tiedot
  palautuvat repoon tallennetusta versiosta, mutta avain on liitettävä uudelleen.
- iOS:ssä kotinäytön sovelluksella ja Safarin välilehdellä on erilliset
  localStoraget. Käyttäjä käyttää vain kotinäytön sovellusta.
- GitHubin rajapinnan vastauksia voi jäädä selaimen välimuistiin (max-age=60).
  Haut tehdään aina `cache: 'no-store'`.

# Toteutussuunnitelma

Jokainen vaihe on pieni, testataan ja commitoidaan erikseen.
Merkitse vaihe valmiiksi `[x]`, kun käyttäjä on hyväksynyt sen.

## [x] Vaihe 1: Laskentalogiikka
- `logic.js`: päivämäärät, nykyinen saldo, päiviä jäljellä, tila,
  järjestys, ostoslista ja sen tekstimuoto, `esc()`, `uid()`
- `test/logic.test.js`: testit kaikille laskennan säännöille
- Valmis kun: testit menevät läpi (UTC ja Europe/Helsinki)

## [x] Vaihe 2: Tallennus ja lähtödata
- `seed.js`: prototyypin 10 tuotetta
- `storage.js`: lataus/tallennus localStorageen CLAUDE.md:n sääntöjen mukaan
  (seed vain kun avainta ei ole, try/catch, `navigator.storage.persist()`)
- Testit lataussäännöille (localStorage korvataan testissä)
- Valmis kun: testit menevät läpi

## [x] Vaihe 3: Käyttöliittymä
- `index.html`, `style.css`, `app.js` prototyypin pohjalta
- Kaikki 7 ydinominaisuutta toimivat
- Valmis kun: sovellus toimii paikallisesti selaimessa ja näyttää samalta
  kuin prototyyppi (kuvakaappaus)

## [x] Vaihe 4: Kotinäyttö
- `manifest.webmanifest`, kuvakkeet, iPhonen meta-tagit
- Valmis kun: tiedostot ovat paikallaan ja sivu latautuu ilman virheitä

## [x] Vaihe 5: Julkaisu
- Käyttäjä laittaa GitHub Pagesin päälle
- Käyttäjä avaa osoitteen iPhonella ja lisää sen kotinäytölle
- Valmis kun: VISION.md:n "Onnistuminen" toteutuu

---

# Ominaisuus: synkronointi iPhonen ja iPadin välillä

Visio ja arkkitehtuuri päivitetty 17.10.2026. Ks. CLAUDE.md, osio "Synkronointi".

## [x] Vaihe 6: Yhdistäminen
- `merge.js`: `merge(base, local, remote)` → `{ state, conflicts }`
- Testit: jokainen CLAUDE.md:n yhdistämissääntö omana testinään
- Valmis kun: testit menevät läpi

## [x] Vaihe 7: GitHub-yhteys
- `github.js`: hae ja tallenna `varasto.json`, UTF-8-base64, virhetyypit
  (ei verkkoa, avain ei kelpaa, ristiriita 409, tiedostoa ei ole)
- Testit korvatulla `fetch`illä, ääkköset mukana
- Valmis kun: testit menevät läpi
- Huom: GET:n CORS todennettu (Access-Control-Allow-Origin: *). PUT:n preflightia ei
  voitu todentaa pilviympäristön välityspalvelimen takia → varmistetaan vaiheessa 10.

## [x] Vaihe 8: Synkronoinnin kulku
- `sync.js`: CLAUDE.md:n kulku kohdat 1–7, ensimmäinen kytkentä, uudelleenyritykset
- Synkronoinnin tila localStorageen (`lisaravinnevarasto.sync`)
- Testit korvatulla GitHubilla: kaksi "laitetta" samaa etärepoa vasten
- Valmis kun: testit menevät läpi, mukaan lukien ristiriita- ja offline-tapaukset

## [ ] Vaihe 9: Käyttöliittymä
- Asetukset: avaimen liittäminen ja poisto, yhteyden testaus
- Tilarivi: synkronoitu / odottaa verkkoa / avain ei kelpaa
- Ristiriitailmoitus tuotteen nimellä, ensimmäisen kytkennän vahvistus
- Selaintesti, jossa GitHubin rajapinta on korvattu
- Valmis kun: selaintesti menee läpi ja kuvakaappaukset on tarkistettu

## [ ] Vaihe 10: Käyttöönotto
- Käyttäjä luo yksityisen repon ja avaimen (CLAUDE.md:n ohje)
- iPhone ensin, sitten iPad
- Valmis kun: VISION.md:n onnistumisehto toteutuu molempiin suuntiin

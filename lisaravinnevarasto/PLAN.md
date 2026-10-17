# Toteutussuunnitelma

Jokainen vaihe on pieni, testataan ja commitoidaan erikseen.
Merkitse vaihe valmiiksi `[x]`, kun käyttäjä on hyväksynyt sen.

## [x] Vaihe 1: Laskentalogiikka
- `logic.js`: päivämäärät, nykyinen saldo, päiviä jäljellä, tila,
  järjestys, ostoslista ja sen tekstimuoto, `esc()`, `uid()`
- `test/logic.test.js`: testit kaikille laskennan säännöille
- Valmis kun: testit menevät läpi (UTC ja Europe/Helsinki)

## [ ] Vaihe 2: Tallennus ja lähtödata
- `seed.js`: prototyypin 10 tuotetta
- `storage.js`: lataus/tallennus localStorageen CLAUDE.md:n sääntöjen mukaan
  (seed vain kun avainta ei ole, try/catch, `navigator.storage.persist()`)
- Testit lataussäännöille (localStorage korvataan testissä)
- Valmis kun: testit menevät läpi

## [ ] Vaihe 3: Käyttöliittymä
- `index.html`, `style.css`, `app.js` prototyypin pohjalta
- Kaikki 7 ydinominaisuutta toimivat
- Valmis kun: sovellus toimii paikallisesti selaimessa ja näyttää samalta
  kuin prototyyppi (kuvakaappaus)

## [ ] Vaihe 4: Kotinäyttö
- `manifest.webmanifest`, kuvakkeet, iPhonen meta-tagit
- Valmis kun: tiedostot ovat paikallaan ja sivu latautuu ilman virheitä

## [ ] Vaihe 5: Julkaisu
- Käyttäjä laittaa GitHub Pagesin päälle
- Käyttäjä avaa osoitteen iPhonella ja lisää sen kotinäytölle
- Valmis kun: VISION.md:n "Onnistuminen" toteutuu

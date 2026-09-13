# app

Vite + TypeScript -projektipohja, jossa on valmiina testit, linttaus ja
tyyppitarkistus. Mukana on pieni esimerkkisovellus (tehtävälista), joka näyttää
miten pohja on tarkoitettu käytettäväksi — sen voi poistaa ja korvata omalla
koodilla.

## Vaatimukset

- Node.js 20.19+ (kehitetty versiolla 22)
- npm 10+

## Aloitus

```bash
cd app
npm install
npm run dev
```

Kehityspalvelin käynnistyy osoitteeseen http://localhost:5173.

## Komennot

| Komento                 | Kuvaus                                                   |
| ----------------------- | -------------------------------------------------------- |
| `npm run dev`           | Kehityspalvelin, jossa on hot reload                      |
| `npm run build`         | Tyyppitarkistus ja tuotantokäännös kansioon `dist/`       |
| `npm run preview`       | Tarjoilee käännetyn `dist/`-kansion paikallisesti         |
| `npm test`              | Ajaa testit kerran                                        |
| `npm run test:watch`    | Ajaa testit jatkuvassa tarkkailutilassa                   |
| `npm run test:coverage` | Testit + kattavuusraportti                                |
| `npm run lint`          | ESLint                                                    |
| `npm run lint:fix`      | ESLint korjaa automaattisesti korjattavat asiat           |
| `npm run typecheck`     | TypeScript-tyyppitarkistus ilman käännöstä                |
| `npm run check`         | Lint + tyyppitarkistus + testit (aja tämä ennen committia)|

## Rakenne

```
app/
├── index.html            # Vite-sovelluksen HTML-runko
├── src/
│   ├── main.ts           # Käynnistyspiste: kytkee logiikan DOM:iin
│   ├── main.test.ts      # Käyttöliittymän integraatiotestit (jsdom)
│   ├── style.css         # Tyylit, tukee vaaleaa ja tummaa teemaa
│   └── lib/
│       ├── tasks.ts      # Puhdas tilalogiikka (ei DOM-riippuvuuksia)
│       ├── tasks.test.ts
│       ├── storage.ts    # localStorage-tallennus virheenkäsittelyllä
│       └── storage.test.ts
├── eslint.config.js      # ESLint flat config
├── tsconfig.json         # TypeScript strict-asetuksilla
└── vite.config.ts        # Vite- ja Vitest-asetukset
```

Periaate: liiketoimintalogiikka `src/lib/`-kansioon puhtaina funktioina, jotka
ovat testattavissa ilman selainta. `main.ts` hoitaa vain DOM-kytkennät.

## Asetukset

- **TypeScript** on `strict`-tilassa, ja lisäksi päällä ovat mm.
  `noUncheckedIndexedAccess` ja `exactOptionalPropertyTypes`. Taulukkohaut
  palauttavat siis `T | undefined`, mikä pakottaa tarkistamaan arvot.
- **Vitest** ajaa testit `jsdom`-ympäristössä, joten DOM-koodia voi testata
  ilman selainta. Testitiedostot ovat lähdekoodin vieressä (`*.test.ts`).
- **ESLint** käyttää flat configia: `@eslint/js` + `typescript-eslint`
  suositusasetuksilla. `console.log` antaa varoituksen.

## Käyttöönotto omaan projektiin

1. Vaihda `package.json`-tiedoston `name` ja `description`.
2. Poista esimerkkisovellus: `src/lib/tasks.*`, `src/lib/storage.*`,
   `src/main.test.ts` sekä `index.html`-tiedoston sisältö ja `main.ts`:n koodi.
3. Aja `npm run check` ja varmista, että kaikki menee läpi.

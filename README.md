# Koppen met Korting

Een statische prijsvergelijker voor opzetborstels van elektrische tandenborstels,
voor de Nederlandse markt. De site verzamelt aanbiedingen uit affiliate-feeds,
rekent ze om naar **prijs per opzetborstel ("prijs per kop")**, en laat
bezoekers sorteren en filteren om de goedkoopste optie te vinden.

Gebouwd met Astro (`output: 'static'`), TypeScript, platte CSS. Geen
server, geen database, geen accounts. Draait gratis op Cloudflare Pages.

## Snel starten

```bash
npm install
npm run build:data   # leest de sample-feeds in data/sample/, schrijft src/data/products.json
npm run dev           # http://localhost:4321
```

Zonder credentials draait de site direct tegen de meegeleverde sample-data
(zie `data/sample/bol-sample.csv` en `data/sample/drogist-sample.csv`).

```bash
npm test               # vitest: packSize-extractie en prijs-per-kop
npm run build           # build:data + astro build -> dist/
```

## Hoe het werkt

### 1. Adapters (`src/adapters/`)

Elke databron heeft een adapter die voldoet aan `SourceAdapter`
(`src/lib/types.ts`): `fetch()` haalt de ruwe feed op, `map()` zet één rij om
naar het genormaliseerde `Product`-type. De rest van de app kent alleen
`Product` -- niemand buiten de adapter weet hoe een specifieke feed eruitziet.

- **`bol.ts`** -- Bol.com affiliate-productfeed (CSV). Schema is een
  aanname (zie NOTES.md), bevestig tegen de echte feed zodra je toegang hebt.
- **`affiliate-feed.ts`** -- generieke, config-gedreven CSV-adapter voor
  affiliate-netwerk-feeds (TradeTracker/Daisycon/Awin), zoals Nederlandse
  drogisterijen (Kruidvat, Etos) die meestal leveren. Een nieuwe drogist
  toevoegen = één entry in `FEED_CONFIGS`, geen nieuwe code.
- **`amazon.ts`** -- stub voor de Amazon PA-API 5.0. Volledig uitgebouwd,
  maar **niet** actief in de registry (`src/adapters/index.ts`) tot je
  kwalificerende sales hebt (PA-API-vereiste, zie SETUP.md).

Adapters die kunnen lezen van een lokaal pad of een HTTP(S)-URL
(`src/lib/fetch-source.ts`): zo werkt dezelfde code voor de sample-CSV's,
een door een refresh-script gedownloade feed, of een live feed-URL.

### 2. Parser (`src/lib/parse.ts`)

- `extractPackSize` haalt het aantal opzetborstels uit rommelige titels
  ("8 stuks", "8-pack", "4 + 4", "set van 6", "(x8)", ...). Lukt dat niet,
  dan is `packSize = null` en wordt het product uitgesloten van de
  prijs-per-kop-ranking (nooit gokken).
- `calculatePricePerHead` rekent `price / packSize` af op 2 decimalen.
- `normalizeBrand` / `detectFitType` / `detectIsOEM` normaliseren merk,
  aansluittype en OEM-vs-compatible.
- `groupProducts` matcht hetzelfde product over winkels heen: op EAN waar
  aanwezig, anders op een genormaliseerde `brand|line|packSize`-key.

Zie `tests/parse.test.ts` voor de dekking, inclusief de lastige titel-cases.

### 3. Build-pipeline (`scripts/build-data.ts`)

`npm run build:data` doorloopt elke actieve adapter, mapt en groepeert de
producten, en schrijft:

- `src/data/products.json` -- array van `ProductGroup` (één per unieke kop,
  met alle winkel-listings en de goedkoopste uitgelicht).
- `src/data/meta.json` -- aantallen + generatie-timestamp.

Astro consumeert deze JSON-bestanden tijdens de build (`src/lib/data.ts`).
De hele site is daarna 100% statisch -- geen runtime-afhankelijkheid van de
adapters of de databronnen.

**Let op:** `src/data/products.json` en `meta.json` worden gecommit naar
git (niet in `.gitignore`). Dat is bewust: de refresh-pipeline (zie hieronder)
regenereert ze en commit + pusht het resultaat, wat Cloudflare Pages
triggert om opnieuw te deployen.

### 4. Pagina's

- `/` -- alle koppen, gesorteerd op prijs per kop, met merk/type-filter en
  sorteer-toggle (klein inline script, geen framework).
- `/merk/[brand]/` en `/type/[fitType]/` -- gefilterde archief-routes
  (statisch gegenereerd via `getStaticPaths`).
- `/product/[id]/` -- detail per product: alle winkels, goedkoopste
  uitgelicht, affiliate-knoppen.

## Productdata verversen (live feeds)

`.github/workflows/refresh-data.yml`: draait dagelijks (cron) of handmatig
(`workflow_dispatch`), leest secrets uit GitHub Settings, draait
`npm run build:data`, en commit + pusht `src/data/products.json`/`meta.json`
als er iets gewijzigd is. Cloudflare Pages pikt die push vanzelf op en
deployt opnieuw.

Geschikt voor alle feeds in dit project: de Bol Marketing API (OAuth over
HTTPS) en de TradeTracker/Daisycon/Awin-feeds van de drogisterijen werken
allemaal zonder vast IP. (Bol biedt de productfeed ook via FTP aan, maar
dat vereist een gewhitelist vast IP-adres -- niet geschikt voor GitHub
Actions-runners, dus gebruik de Marketing API in plaats daarvan.)

Zie **SETUP.md** voor de volledige, stap-voor-stap-instructies (accounts
aanmaken, secrets plaatsen, Cloudflare Pages koppelen).

## Env-vars

Zie `.env.example` voor de volledige lijst, gegroepeerd per bron (Bol,
affiliate-netwerk-feeds, Amazon). Nooit credentials hardcoden -- alles komt
uit env-vars, lokaal via `.env` (gitignored), in CI via GitHub Secrets, en
in productie via Cloudflare Pages environment variables.

## Belangrijke documenten

- **SETUP.md** -- wat je morgen moet doen: accounts, credentials, Cloudflare
  Pages-koppeling, sample -> live feed-swap.
- **NOTES.md** -- aannames (vooral het Bol-feed-schema), beslissingen, en
  wat je moet dubbelchecken.

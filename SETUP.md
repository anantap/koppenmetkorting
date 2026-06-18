# SETUP — wat je morgen moet doen

Genummerde, copy-paste-vriendelijke stappen om van sample-data naar een
live, automatisch verversende site te gaan. Volg ze in volgorde; elke stap
is optioneel uit te stellen behalve stap 6 (Cloudflare Pages koppelen),
die je nodig hebt om de site überhaupt live te zetten.

## 1. Bol.com affiliate-account aanmaken

1. Ga naar https://partnerprogramma.bol.com/ en maak een account aan.
2. Vraag toegang aan tot de **Marketing/Catalog API** (OAuth client
   credentials) via https://api.bol.com/marketing/docs/.
3. Noteer je `Client ID` en `Client Secret`.
4. Noteer je **Site ID** (te vinden in je partnerprogramma-dashboard, nodig
   voor affiliate-deeplinks).

## 2. Bol productfeed-toegang regelen

Je hebt twee opties (de adapter in `src/adapters/bol.ts` leest in beide
gevallen gewoon een CSV-bestand of URL, dus dit bepaalt alleen hoe dat
bestand bij je komt):

**Optie A — Marketing API (aanbevolen, geen IP-whitelist nodig)**
1. Gebruik de OAuth client credentials uit stap 1 om een feed/export te
   downloaden via de Marketing Catalog API.
2. Zet de gedownloade CSV ergens neer (lokaal pad, of een URL die je zelf
   host) en wijs `BOL_FEED_PATH` daar naartoe.

**Optie B — FTP-productfeed (vereist vast IP)**
1. Vraag bij Bol de FTP-toegang voor de productfeed aan.
2. Bol vraagt om een vast IP-adres te whitelisten. Gebruik hiervoor het
   (vaste of statisch toegewezen) IP van je thuis-PC-stick -- **niet** een
   GitHub Actions-runner, die heeft geen vast IP.
3. Noteer host/gebruikersnaam/wachtwoord voor `BOL_FTP_HOST`,
   `BOL_FTP_USER`, `BOL_FTP_PASSWORD`.
4. Gebruik in dat geval optie B (lokale cron/systemd-timer) voor de refresh,
   zie stap 8.

## 3. Affiliate-netwerk-feeds voor drogisterijen (Kruidvat, Etos, ...)

1. Maak een account aan bij het affiliate-netwerk dat de drogist gebruikt
   (meestal TradeTracker, Daisycon, of Awin -- check de footer/voorwaarden
   van het partnerprogramma van de drogist zelf).
2. Meld je aan voor het partnerprogramma van elke drogist.
3. Vraag de productfeed-URL op (vaak een directe CSV/XML-link met een
   token erin) en eventueel een subId/tracking-token voor attributie.
4. Zet de feed-URL in `FEED_DROGIST_URL` (en het subId in
   `FEED_DROGIST_SUBID`).
5. Komt de kolomstructuur niet overeen met de aannames in
   `src/adapters/affiliate-feed.ts` (`FEED_CONFIGS`)? Pas de
   `columns`-mapping aan -- dat is de enige plek die moet veranderen.
6. Voeg je een tweede drogist toe met een eigen, losse feed-URL? Voeg een
   nieuwe entry toe aan `FEED_CONFIGS` (voorbeeld staat als commentaar in
   het bestand). Geen nieuwe code nodig.

## 4. Amazon PA-API (later, optioneel)

PA-API 5.0-toegang krijg je pas nadat je account binnen 180 dagen een
kwalificerend aantal sales heeft gerealiseerd via Amazon-affiliate-links.
Tot die tijd hoef je niets te doen. Zodra je toegang hebt:

1. Maak Access Key, Secret Key en Partner Tag aan in je Amazon Associates-
   account.
2. Zet ze in `AMAZON_ACCESS_KEY`, `AMAZON_SECRET_KEY`, `AMAZON_PARTNER_TAG`.
3. Implementeer de gesigneerde PA-API-call in `src/adapters/amazon.ts`
   (`fetch()` is nu een stub die een duidelijke error gooit).
4. Voeg `amazonAdapter` toe aan `src/adapters/index.ts` (`adapters`-array).

## 5. Lokale `.env` aanmaken

```bash
cp .env.example .env
```

Vul de variabelen in die je al hebt (laat de rest leeg -- de build valt dan
terug op sample-data voor die bron). `.env` wordt nooit gecommit.

## 6. Cloudflare Pages-project aanmaken

1. Log in op https://dash.cloudflare.com/ -> Workers & Pages -> Create ->
   Pages -> Connect to Git.
2. Selecteer deze GitHub-repository.
3. Build-instellingen:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `/` (tenzij je de repo verplaatst)
4. Voeg environment variables toe (Settings -> Environment variables),
   dezelfde namen als in `.env.example`: `BOL_SITE_ID`, `BOL_FEED_PATH`
   (of laat leeg voor sample-data), `FEED_DROGIST_URL`,
   `FEED_DROGIST_SUBID`, etc. **Nooit** `BOL_CLIENT_SECRET` of
   FTP-wachtwoorden hier zetten als je de FTP-route gebruikt -- Cloudflare's
   build-runners hebben geen vast IP, dus FTP-fetch tijdens de Cloudflare
   build werkt niet. Gebruik in dat geval optie B (stap 8) om
   `src/data/products.json` al gevuld te laten zijn vóór Cloudflare bouwt.
5. Deploy. Cloudflare geeft je een `*.pages.dev`-domein; koppel later een
   eigen domein via Settings -> Custom domains.

## 7. Secrets plaatsen: waar wat hoort

| Secret | Lokale build (`.env`) | GitHub Actions (Settings -> Secrets) | Cloudflare Pages (env vars) |
|---|---|---|---|
| `BOL_CLIENT_ID` / `BOL_CLIENT_SECRET` | ja | ja (als je optie A gebruikt) | alleen als je de Marketing API rechtstreeks vanuit de Cloudflare build wilt aanroepen (niet nodig als `BOL_FEED_PATH` al naar een gecommit bestand wijst) |
| `BOL_SITE_ID` | ja | ja | ja (nodig voor affiliate-links in elke build) |
| `BOL_FTP_HOST/USER/PASSWORD` | ja | nee (geen vast IP) | nee (geen vast IP) |
| `BOL_FEED_PATH` | optioneel | optioneel | optioneel -- wijs naar een gecommit live-feed-bestand als je optie B gebruikt |
| `FEED_DROGIST_URL` / `_SUBID` | ja | ja | ja |
| `AMAZON_*` | later | later | later |

## 8. Sample -> echte feed swap en opnieuw draaien

1. Vul de relevante env-vars in (lokaal `.env`, of GitHub Secrets, of
   Cloudflare env vars -- afhankelijk van waar je build draait).
2. Draai opnieuw:
   ```bash
   npm run build:data
   npm run dev      # of: npm run build && npm run preview
   ```
3. Check `src/data/meta.json` -- `sources` en `totalListings` moeten
   overeenkomen met je echte feeds, niet meer met de sample-aantallen.
4. Gebruik je de Bol FTP-route? Zet dan `scripts/refresh.sh` en
   `deploy/koppenmetkorting-refresh.{service,timer}` op je thuis-PC-stick
   (zie README.md "Optie B"). Dat script haalt de FTP-feed op, regenereert
   de data, en commit + pusht -- waarna Cloudflare automatisch opnieuw
   deployt.
5. Gebruik je alleen HTTP(S)-feeds (Marketing API + affiliate-netwerken)?
   Dan is `.github/workflows/refresh-data.yml` (GitHub Actions cron)
   voldoende; zet de bijbehorende secrets in GitHub Settings -> Secrets and
   variables -> Actions.

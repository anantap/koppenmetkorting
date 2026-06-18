# NOTES — aannames, beslissingen, dubbelchecken

Geschreven tijdens een autonome bouw-sessie zonder echte credentials. Alles
hieronder is wat ik zelf besliste; check vooral de Bol-feed-aannames voordat
je live gaat.

## Bol-feed-schema (BELANGRIJKSTE AANNAME)

`https://api.bol.com/marketing/docs/product-feed/index.html` gaf een
**403 Forbidden** bij het ophalen tijdens het bouwen (waarschijnlijk
auth-gated of bot-geblokkeerd). Ik kon dus de exacte kolomnamen niet
bevestigen. Via een websearch vond ik bevestiging dat de Bol-feed via
FTP als CSV/XML beschikbaar is, met kolommen zoals `ean`,
`OfferNL.sellerType`/`OfferBE.sellerType`, bol product-ID en bol product-URL
-- maar geen volledige, exacte kolomlijst.

**Aanname in `src/adapters/bol.ts`:** kolommen `ean`, `title`, `brand`,
`price`, `productUrl`, `imageUrl`, `packSize` (laatste waarschijnlijk niet
aanwezig in de echte feed -- de parser valt dan terug op titel-parsing,
wat ook de bedoeling is). Elke regel met een aanname is gemarkeerd met
`// TODO: bevestig tegen echte Bol-feed`.

**Dubbelchecken zodra je toegang hebt:**
- Exacte kolomnamen en casing (mogelijk `EAN`, `Ean`, of een ander veld dan
  `ean`).
- Of `price` de consumentenprijs is, of dat er een apart `priceNL`/
  `offerPrice`-veld is.
- Of `productUrl` al een kale bol.com-link is (dan moet de affiliate-tag
  er via een netwerk-wrapper bovenop, niet als simpele querystring-param --
  zie de `buildAffiliateUrl`-aanname hieronder).
- Of er een apart aantal-veld is (packSize), of dat je altijd op de titel
  moet parsen.

**Affiliate-deeplink-aanname:** `buildAffiliateUrl` in `bol.ts` plakt nu
`?utm_source=affiliate&site_id=...` aan de URL. In de praktijk loopt Bol-
affiliate-tracking vaak via een netwerk (TradeTracker/Daisycon) met een
deeplink-wrapper, niet via een simpele querystring op de bol.com-URL zelf.
Bevestig het echte formaat in de Bol-partnerdocumentatie zodra je
ingelogd bent.

## Drogist-/affiliate-netwerk-feed

Geen specifieke feed gefetcht (geen account). De generieke adapter
(`affiliate-feed.ts`) is config-gedreven zodat de kolomnaam-aannames
(`productnaam`, `prijs`, `ean_code`, `deeplink`, `afbeelding_url`, `merk`,
`aantal`) makkelijk te vervangen zijn per echte feed, zonder code-
wijzigingen elders. Gemarkeerd met `// TODO: bevestig tegen echte feed`.

**Beslissing:** de sample-drogist-feed bundelt Kruidvat én Etos in één
CSV met een `winkel`-kolom (in plaats van twee apart te downloaden
bestanden). Dit is realistisch voor affiliate-aggregator-feeds, maar in de
praktijk heeft elke drogist meestal een eigen feed-URL via zijn eigen
netwerk-aanmelding. `FEED_CONFIGS` ondersteunt beide: een `columns.shop`-
kolom (huidige sample) of losse `FeedConfig`-entries per drogist (voorbeeld
staat als commentaar in het bestand).

## packSize-parsing

- Bij twijfel (titel zonder herkenbaar aantal) kiest de parser voor `null` +
  uitsluiten van de ranking, NOOIT gokken. Dit raakte 6 van de 76
  sample-listings.
- Volgorde van patroon-matching in `extractPackSize`: "N + M" (som) ->
  "set van N" -> "(xN)" -> "N-pack" -> "N stuks" -> "N opzetborstels/koppen".
  Bij een titel die toevallig meerdere patronen matcht, wint de eerste in
  deze volgorde. Dit is niet uitvoerig getest tegen alle denkbare edge
  cases -- de meegeleverde tests dekken de in de opdracht genoemde
  voorbeelden.

## EAN-aanname in sample-data

Elke (productlijn, pakgrootte)-combinatie krijgt een EIGEN EAN in de
sample-data (`/tmp/gen-samples.cjs`, niet in de repo -- eenmalig
gebruikt om de CSV's te genereren). Dit is expres: een EAN identificeert
een exacte verpakkingseenheid, dus twee pakgroottes van dezelfde lijn
horen verschillende EAN's te hebben. Eerdere versie van het script
gebruikte per ongeluk dezelfde EAN voor alle pakgroottes van een lijn,
wat productgroepen met vermengde pakgroottes opleverde -- gefixt voor de
uiteindelijke sample-CSV's in `data/sample/`.

## Merk-normalisatie

`normalizeBrand` geeft voorrang aan het opgegeven merk-veld uit de feed
boven tekst in de titel. Reden: titels van compatible/huismerk-producten
noemen vaak het originele merk ("opzetborstels geschikt voor Oral-B"),
wat zonder deze voorrang het generieke product ten onrechte als brand
"Oral-B" zou classificeren (terwijl `isOEM` correct op `false` stond).
`fitType` gebruikt nog wel de titel-tekst, want fitType beschrijft "past op
welk handvat", niet "wie maakt het" -- een compatible opzetborstel voor
Oral-B-handvatten hoort terecht `fitType: oral-b-click`.

## src/data/products.json en meta.json worden gecommit

Bewuste keuze, afwijkend van de typische "build-artifacten niet committen"-
regel: de refresh-pipeline (GitHub Actions + lokale cron) is ontworpen om
deze bestanden te regenereren en de wijziging te committen + pushen, wat
Cloudflare Pages' git-push-trigger gebruikt om een nieuwe deploy te
starten. Zonder deze commit-stap is er geen signaal voor Cloudflare om
opnieuw te bouwen op een schema (Cloudflare Pages heeft geen ingebouwde
cron-rebuild). Cloudflare's eigen `npm run build` regenereert de data
sowieso opnieuw uit de op dat moment geconfigureerde env-vars/bestanden,
dus de gecommitte JSON is vooral een fallback/trigger, niet de enige bron
van waarheid.

## CSV-parser zonder dependency

`src/lib/csv.ts` is een kleine, zelfgeschreven RFC4180-achtige parser
(quoted fields, escaped quotes, komma's binnen velden) in plaats van een
package zoals `csv-parse`, om dependencies minimaal te houden zoals
gevraagd. Niet getest tegen extreem grote bestanden (>10k rijen) -- voor
de verwachte schaal van een paar honderd tot een paar duizend opzetborstel-
listings per feed zou dit geen probleem moeten zijn, maar bij twijfel
even profilen voordat je een feed met >50k rijen erdoorheen haalt.

## Niet gebouwd / bewust weggelaten

- Geen cookiebanner, nieuwsbrief, blog -- expliciet niet gevraagd.
- Geen paginering op `/` -- bij een paar duizend producten kan dat nodig
  worden, nu niet relevant voor 58 sample-groepen.
- Geen retry/backoff-logica in `readFeedSource` voor HTTP-fetches -- als
  een live feed-URL tijdelijk niet bereikbaar is, faalt `build:data` hard.
  Voor een dagelijkse cron-job is dat acceptabel (volgende run lost het op);
  health-monitoring zou je zelf moeten toevoegen als dat belangrijk is.

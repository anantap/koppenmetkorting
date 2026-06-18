import { parseCSV } from '../lib/csv.js';
import { readFeedSource } from '../lib/fetch-source.js';
import {
  calculatePricePerHead,
  detectFitType,
  detectIsOEM,
  normalizeBrand,
  resolvePackSize,
} from '../lib/parse.js';
import type { Product, RawRow, SourceAdapter } from '../lib/types.js';

/**
 * Generieke, config-gedreven CSV-adapter voor affiliate-netwerk-feeds
 * (TradeTracker, Daisycon, Awin e.d.). Nederlandse drogisterijen (Kruidvat,
 * Etos, deonlinedrogist) leveren zo hun productfeeds. Elke advertiser heeft
 * eigen kolomnamen, dus de mapping zit in een config-object per feed.
 *
 * Een nieuwe drogist toevoegen = een nieuwe entry in FEED_CONFIGS, geen
 * nieuwe code.
 */

export interface FeedColumnMap {
  title: string;
  price: string;
  ean?: string;
  url: string;
  image?: string;
  brand?: string;
  packSize?: string;
  /**
   * Optionele kolom met de winkelnaam per rij. Sommige affiliate-netwerk-feeds
   * (bv. een aggregator die meerdere drogisterijen in één feed levert) zetten
   * de advertiser/winkelnaam per rij; als deze kolom aanwezig is heeft de
   * waarde voorrang boven het vaste `FeedConfig.shop`-veld.
   */
  shop?: string;
  /** Optionele subId/tracking-token query-param naam voor de deeplink. */
  subIdParam?: string;
}

export interface FeedConfig {
  shop: string;
  /** Lokaal pad (sample) of URL naar de live feed. */
  feedPath: string;
  /** CSV-scheidingsteken; sommige netwerken (TradeTracker/Daisycon) gebruiken ';'. */
  delimiter?: string;
  columns: FeedColumnMap;
  /** Naam van de env-var met het subId/tracking-token voor deze feed, indien van toepassing. */
  subIdEnvVar?: string;
}

// TODO: bevestig tegen echte feed — kolomnamen verschillen per netwerk/advertiser.
// Kruidvat en Etos lopen doorgaans via TradeTracker of Daisycon. In de praktijk
// heeft elke drogist meestal een EIGEN feed-URL (eigen FeedConfig-entry, zie
// commentaar onderaan voor dat scenario). De sample-feed hier bundelt beide
// drogisten in één bestand met een 'winkel'-kolom, wat ook voorkomt bij
// affiliate-aggregator-feeds die meerdere advertisers in één export leveren.
export const FEED_CONFIGS: FeedConfig[] = [
  {
    shop: 'Drogist (NL)',
    feedPath: process.env.FEED_DROGIST_URL ?? 'data/sample/drogist-sample.csv',
    delimiter: ';',
    columns: {
      title: 'productnaam',
      price: 'prijs',
      ean: 'ean_code',
      url: 'deeplink',
      image: 'afbeelding_url',
      brand: 'merk',
      packSize: 'aantal',
      shop: 'winkel',
      subIdParam: 'sub_id',
    },
    subIdEnvVar: 'FEED_DROGIST_SUBID',
  },
  // Voorbeeld voor een drogist met een eigen, losse feed-URL (1 nieuwe regel,
  // geen nieuwe code):
  // {
  //   shop: 'Trekpleister',
  //   feedPath: process.env.FEED_TREKPLEISTER_URL ?? '',
  //   delimiter: ',',
  //   columns: { title: 'name', price: 'price', ean: 'gtin', url: 'link', image: 'image_link' },
  //   subIdEnvVar: 'FEED_TREKPLEISTER_SUBID',
  // },
];

function buildAffiliateUrl(rawUrl: string, config: FeedConfig): string {
  if (!rawUrl) return '#';
  const subIdParam = config.columns.subIdParam;
  const subId = config.subIdEnvVar ? process.env[config.subIdEnvVar] : undefined;
  if (!subIdParam || !subId) return rawUrl;
  const separator = rawUrl.includes('?') ? '&' : '?';
  return `${rawUrl}${separator}${subIdParam}=${encodeURIComponent(subId)}`;
}

function makeAdapterForConfig(config: FeedConfig): SourceAdapter {
  return {
    name: config.shop,

    async fetch(): Promise<RawRow[]> {
      const csv = await readFeedSource(config.feedPath);
      return parseCSV(csv, config.delimiter ?? ',');
    },

    map(row: RawRow): Product | null {
      const { columns } = config;
      const title = row[columns.title]?.trim();
      const priceRaw = row[columns.price]?.trim();
      if (!title || !priceRaw) return null;

      const price = parseFloat(priceRaw.replace(',', '.'));
      if (!Number.isFinite(price)) return null;

      const rawBrand = (columns.brand && row[columns.brand]?.trim()) ?? '';
      const brand = normalizeBrand(rawBrand, title);
      const fitType = detectFitType(brand, title);
      const isOEM = detectIsOEM(brand, title);
      const packSize = resolvePackSize(
        columns.packSize ? row[columns.packSize] : undefined,
        title
      );
      const pricePerHead = calculatePricePerHead(price, packSize);
      const ean = (columns.ean && row[columns.ean]?.trim()) || null;
      const shop = (columns.shop && row[columns.shop]?.trim()) || config.shop;
      const id = ean ?? `${shop}-${title}`.toLowerCase().replace(/\s+/g, '-');

      return {
        id,
        ean,
        brand,
        line: null,
        title,
        fitType,
        isOEM,
        shop,
        price,
        packSize,
        pricePerHead,
        url: buildAffiliateUrl(row[columns.url]?.trim() ?? '', config),
        imageUrl: (columns.image && row[columns.image]?.trim()) || null,
        lastSeen: new Date().toISOString().slice(0, 10),
        packSizeUnknown: packSize === null,
      };
    },
  };
}

/** Eén SourceAdapter per geconfigureerde feed. */
export const affiliateFeedAdapters: SourceAdapter[] = FEED_CONFIGS.map(makeAdapterForConfig);

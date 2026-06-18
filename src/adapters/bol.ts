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
 * Adapter voor de Bol.com affiliate productfeed.
 *
 * AANGENOMEN SCHEMA — de officiele Marketing Catalog API / productfeed-docs
 * (https://api.bol.com/marketing/docs/product-feed/index.html) gaven een
 * 403 bij het ophalen tijdens het bouwen van deze adapter. Het schema hieronder
 * is gebaseerd op publiek beschikbare beschrijvingen van de Bol CSV/XML-feed
 * (kolommen als ean, title, price, productUrl, imageUrl, brand, sellerType).
 * Elke kolomnaam-aanname is hieronder gemarkeerd.
 *
 * TODO: bevestig tegen echte Bol-feed — exacte kolomnamen, casing en
 * aanwezigheid van onderstaande velden zodra een Bol-account met
 * productfeed-toegang beschikbaar is (zie SETUP.md).
 */

const SHOP_NAME = 'Bol.com';

interface BolColumns {
  ean: string;
  title: string;
  brand: string;
  price: string;
  productUrl: string;
  imageUrl: string;
  packSize: string;
}

// TODO: bevestig tegen echte Bol-feed — exacte kolomnamen.
const COLUMNS: BolColumns = {
  ean: 'ean',
  title: 'title',
  brand: 'brand',
  price: 'price', // TODO: bevestig of dit "price" of "priceNL"/"offerPrice" heet.
  productUrl: 'productUrl', // TODO: bevestig of dit al een affiliate deeplink is of een kale bol.com URL.
  imageUrl: 'imageUrl',
  packSize: 'packSize', // TODO: bevestig of de feed een apart aantal-veld heeft; anders enkel uit titel parsen.
};

/** Site-ID die geinjecteerd wordt in affiliate-deeplinks, zie .env.example BOL_SITE_ID. */
function buildAffiliateUrl(rawUrl: string): string {
  const siteId = process.env.BOL_SITE_ID;
  if (!siteId) {
    return `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}affiliate=PLAATS_BOL_SITE_ID_IN_ENV`;
  }
  // TODO: bevestig tegen echte Bol-feed — het exacte affiliate-querystring-format
  // (Bol gebruikt doorgaans ?Referrer=TRADETRACKER of een Daisycon/TradeTracker
  // deeplink-wrapper i.p.v. een directe querystring-param op de productURL).
  return `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}utm_source=affiliate&site_id=${siteId}`;
}

export const bolAdapter: SourceAdapter = {
  name: SHOP_NAME,

  async fetch(): Promise<RawRow[]> {
    const feedPath = process.env.BOL_FEED_PATH ?? 'data/sample/bol-sample.csv';
    const csv = await readFeedSource(feedPath);
    return parseCSV(csv);
  },

  map(row: RawRow): Product | null {
    const title = row[COLUMNS.title]?.trim();
    const priceRaw = row[COLUMNS.price]?.trim();
    if (!title || !priceRaw) return null;

    const price = parseFloat(priceRaw.replace(',', '.'));
    if (!Number.isFinite(price)) return null;

    const rawBrand = row[COLUMNS.brand]?.trim() ?? '';
    const brand = normalizeBrand(rawBrand, title);
    const fitType = detectFitType(brand, title);
    const isOEM = detectIsOEM(brand, title);
    const packSize = resolvePackSize(row[COLUMNS.packSize], title);
    const pricePerHead = calculatePricePerHead(price, packSize);
    const ean = row[COLUMNS.ean]?.trim() || null;

    const id = ean ?? `${SHOP_NAME}-${title}`.toLowerCase().replace(/\s+/g, '-');

    return {
      id,
      ean,
      brand,
      line: null,
      title,
      fitType,
      isOEM,
      shop: SHOP_NAME,
      price,
      packSize,
      pricePerHead,
      url: buildAffiliateUrl(row[COLUMNS.productUrl]?.trim() ?? '#'),
      imageUrl: row[COLUMNS.imageUrl]?.trim() || null,
      lastSeen: new Date().toISOString().slice(0, 10),
      packSizeUnknown: packSize === null,
    };
  },
};

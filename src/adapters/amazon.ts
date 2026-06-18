import {
  calculatePricePerHead,
  detectFitType,
  detectIsOEM,
  normalizeBrand,
  resolvePackSize,
} from '../lib/parse.js';
import type { Product, RawRow, SourceAdapter } from '../lib/types.js';

/**
 * STUB/OPTIONEEL — Amazon Product Advertising API (PA-API 5.0).
 *
 * Amazon geeft pas echte PA-API-toegang nadat het account binnen 180 dagen
 * een kwalificerend aantal sales heeft gerealiseerd via affiliate-links.
 * Deze adapter is daarom volledig uitgebouwd tegen het PA-API-responseformaat,
 * maar NIET opgenomen in de actieve registry (src/adapters/index.ts) totdat
 * er echte toegang is. Zet 'm pas aan zodra AMAZON_ACCESS_KEY/SECRET/PARTNER_TAG
 * beschikbaar zijn en de account-kwalificatie behaald is (zie SETUP.md).
 *
 * TODO: vervang door echte PA-API SDK-call (signed request, GetItems operation)
 * zodra credentials beschikbaar zijn. Hieronder een minimale, illustratieve
 * mapping tegen de gedocumenteerde PA-API 5.0 item-velden.
 */

const SHOP_NAME = 'Amazon.nl';

export const amazonAdapter: SourceAdapter = {
  name: SHOP_NAME,

  async fetch(): Promise<RawRow[]> {
    const accessKey = process.env.AMAZON_ACCESS_KEY;
    const secretKey = process.env.AMAZON_SECRET_KEY;
    const partnerTag = process.env.AMAZON_PARTNER_TAG;

    if (!accessKey || !secretKey || !partnerTag) {
      // Geen credentials -> geen data. De adapter faalt niet hard zodat de
      // build-pipeline gewoon doorloopt als deze adapter per ongeluk actief staat.
      return [];
    }

    // TODO: implementeer echte signed PA-API 5.0 request (GetItems/SearchItems)
    // met AMAZON_HOST/AMAZON_REGION, en parse de JSON-response naar RawRow[].
    throw new Error(
      'amazonAdapter.fetch() is een stub: implementeer de PA-API-call zodra credentials gekwalificeerd zijn.'
    );
  },

  map(row: RawRow): Product | null {
    // Illustratieve mapping tegen PA-API 5.0 "Items[].ItemInfo"/"Offers"-velden.
    const title = row['title']?.trim();
    const priceRaw = row['price']?.trim();
    if (!title || !priceRaw) return null;

    const price = parseFloat(priceRaw.replace(',', '.'));
    if (!Number.isFinite(price)) return null;

    const rawBrand = row['brand']?.trim() ?? '';
    const brand = normalizeBrand(rawBrand, title);
    const fitType = detectFitType(brand, title);
    const isOEM = detectIsOEM(brand, title);
    const packSize = resolvePackSize(row['packSize'], title);
    const pricePerHead = calculatePricePerHead(price, packSize);
    const ean = row['ean']?.trim() || null;

    return {
      id: ean ?? `${SHOP_NAME}-${title}`.toLowerCase().replace(/\s+/g, '-'),
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
      url: row['detailPageURL']?.trim() || '#',
      imageUrl: row['imageUrl']?.trim() || null,
      lastSeen: new Date().toISOString().slice(0, 10),
      packSizeUnknown: packSize === null,
    };
  },
};

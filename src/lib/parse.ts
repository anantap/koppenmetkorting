import type { FitType, Product, ProductGroup } from './types.js';

const OEM_BRANDS = ['Oral-B', 'Philips Sonicare', 'Jordan'];

const COMPATIBLE_KEYWORDS = [
  'geschikt voor',
  'compatible',
  'vervangende',
  'huismerk',
  'alternatief voor',
];

/**
 * Haalt het aantal opzetborstels uit een rommelige titel/veld.
 * Geeft null terug als er geen betrouwbaar aantal te bepalen is —
 * de caller moet dit dan flaggen en uitsluiten van prijs-per-kop-ranking.
 */
export function extractPackSize(text: string): number | null {
  const normalized = text.toLowerCase();

  // "4 + 4", "4+4" -> som van de delen
  const plusMatch = normalized.match(/(\d+)\s*\+\s*(\d+)(?:\s*\+\s*(\d+))?/);
  if (plusMatch) {
    const sum = plusMatch
      .slice(1)
      .filter(Boolean)
      .reduce((acc, n) => acc + parseInt(n, 10), 0);
    if (sum > 0) return sum;
  }

  // "set van 6"
  const setMatch = normalized.match(/set van (\d+)/);
  if (setMatch) return parseInt(setMatch[1], 10);

  // "(x8)" / "(x 8)" / "x8"
  const xMatch = normalized.match(/\(?\s*x\s*(\d+)\s*\)?/);
  if (xMatch) return parseInt(xMatch[1], 10);

  // "8-pack" / "8 pack" / "8pack"
  const packMatch = normalized.match(/(\d+)[\s-]*pack/);
  if (packMatch) return parseInt(packMatch[1], 10);

  // "8 stuks" / "8 stuk" / "8st" / "8 st."
  const stuksMatch = normalized.match(/(\d+)\s*(?:stuks?|st\.?)\b/);
  if (stuksMatch) return parseInt(stuksMatch[1], 10);

  // "8 opzetborstels" / "8 opzetborstel" / "8 koppen" / "8 kop"
  const koppenMatch = normalized.match(
    /(\d+)\s*(?:opzetborstels?|koppen|kop)\b/
  );
  if (koppenMatch) return parseInt(koppenMatch[1], 10);

  return null;
}

/** Bepaalt packSize: geeft voorrang aan een expliciet numeriek veld boven titel-parsing. */
export function resolvePackSize(
  explicit: string | number | null | undefined,
  title: string
): number | null {
  if (explicit !== null && explicit !== undefined && explicit !== '') {
    const n = typeof explicit === 'number' ? explicit : parseInt(explicit, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return extractPackSize(title);
}

export function calculatePricePerHead(
  price: number,
  packSize: number | null
): number | null {
  if (!packSize || packSize <= 0) return null;
  return Math.round((price / packSize) * 100) / 100;
}

export function normalizeBrand(rawBrand: string, title: string): string {
  // Een opgegeven merk-veld krijgt voorrang boven titel-tekst: titels van
  // compatible producten noemen vaak het originele merk ("geschikt voor
  // Oral-B"), wat een generiek product anders ten onrechte als Oral-B zou
  // classificeren.
  const brandLower = rawBrand.trim().toLowerCase();
  if (brandLower.includes('oral-b') || brandLower.includes('oral b')) return 'Oral-B';
  if (brandLower.includes('sonicare') || brandLower.includes('philips')) {
    return 'Philips Sonicare';
  }
  if (brandLower.includes('jordan')) return 'Jordan';
  if (brandLower) return rawBrand.trim();

  const titleLower = title.toLowerCase();
  if (titleLower.includes('oral-b') || titleLower.includes('oral b')) return 'Oral-B';
  if (titleLower.includes('sonicare') || titleLower.includes('philips')) {
    return 'Philips Sonicare';
  }
  if (titleLower.includes('jordan')) return 'Jordan';
  return 'Generiek';
}

export function detectFitType(brand: string, title: string): FitType {
  const haystack = title.toLowerCase();
  if (brand === 'Oral-B' || haystack.includes('oral-b') || haystack.includes('oral b')) {
    return 'oral-b-click';
  }
  if (brand === 'Philips Sonicare' || haystack.includes('sonicare')) {
    return 'sonicare-click';
  }
  if (haystack.includes('geschikt voor oral-b') || haystack.includes('geschikt voor sonicare')) {
    return haystack.includes('sonicare') ? 'sonicare-click' : 'oral-b-click';
  }
  return 'generic';
}

export function detectIsOEM(brand: string, title: string): boolean {
  const haystack = title.toLowerCase();
  if (COMPATIBLE_KEYWORDS.some((kw) => haystack.includes(kw))) return false;
  return OEM_BRANDS.includes(brand);
}

/** Genormaliseerde matching-key voor producten zonder (betrouwbare) EAN. */
export function fallbackMatchKey(
  brand: string,
  line: string | null,
  packSize: number | null
): string {
  return [brand, line ?? '', packSize ?? '']
    .join('|')
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/** Groepeert listings van verschillende winkels die hetzelfde product zijn. */
export function groupProducts(products: Product[]): ProductGroup[] {
  const groups = new Map<string, Product[]>();

  for (const product of products) {
    const key =
      product.ean ?? fallbackMatchKey(product.brand, product.line, product.packSize);
    const existing = groups.get(key);
    if (existing) {
      existing.push(product);
    } else {
      groups.set(key, [product]);
    }
  }

  const result: ProductGroup[] = [];
  for (const [groupId, listings] of groups) {
    const sorted = [...listings].sort((a, b) => {
      if (a.pricePerHead === null) return 1;
      if (b.pricePerHead === null) return -1;
      return a.pricePerHead - b.pricePerHead;
    });
    const cheapest = sorted.find((p) => p.pricePerHead !== null) ?? null;
    const representative = cheapest ?? sorted[0];

    result.push({
      groupId,
      brand: representative.brand,
      line: representative.line,
      fitType: representative.fitType,
      isOEM: representative.isOEM,
      packSize: representative.packSize,
      title: representative.title,
      imageUrl: representative.imageUrl,
      listings: sorted,
      cheapest,
    });
  }

  return result;
}

/**
 * Genormaliseerd interne product-representatie. Elke adapter mapt zijn
 * brongegevens naar dit type; de rest van de app kent alleen dit type.
 */
export interface Product {
  /** Stabiele interne id, afgeleid van EAN of (brand+line+packSize) als EAN ontbreekt. */
  id: string;
  /** EAN-13/EAN-8 barcode, indien bekend. */
  ean: string | null;
  /** Genormaliseerd merk, bv. "Oral-B", "Philips Sonicare", "Jordan", "Generiek". */
  brand: string;
  /** Productlijn/serie, bv. "CrossAction", "DiamondClean", "EB20". */
  line: string | null;
  /** Originele titel zoals aangeboden door de winkel. */
  title: string;
  /** Genormaliseerd aansluittype, bv. "oral-b-click", "sonicare-click", "generic". */
  fitType: FitType;
  /** true = merkeigen (OEM) opzetborstel, false = compatible/huismerk. */
  isOEM: boolean;
  /** Winkelnaam, bv. "Bol.com", "Kruidvat". */
  shop: string;
  /** Prijs in EUR voor de hele verpakking. */
  price: number;
  /** Aantal opzetborstels in de verpakking. null = niet te bepalen (uitgesloten van ranking). */
  packSize: number | null;
  /** price / packSize, afgerond op 2 decimalen. null als packSize null is. */
  pricePerHead: number | null;
  /** Affiliate deeplink naar de winkel. */
  url: string;
  /** Productafbeelding. */
  imageUrl: string | null;
  /** ISO-datum waarop dit listing voor het laatst gezien is in de feed. */
  lastSeen: string;
  /** true als packSize niet betrouwbaar bepaald kon worden (geflagged, niet gegokt). */
  packSizeUnknown: boolean;
}

export type FitType =
  | 'oral-b-click'
  | 'sonicare-click'
  | 'generic'
  | 'unknown';

/** Eén rij ruwe brondata, vóór mapping naar Product. Vorm verschilt per adapter. */
export type RawRow = Record<string, string>;

export interface SourceAdapter {
  /** Naam van de bron, gebruikt als shop-naam fallback en in logging. */
  name: string;
  /** Haalt de ruwe feed op (CSV/XML/API) en geeft rijen terug. */
  fetch(): Promise<RawRow[]>;
  /** Mapt één ruwe rij naar het genormaliseerde Product-type. */
  map(row: RawRow): Product | null;
}

/** Eén unieke "kop" (opzetborstel) met alle winkels die hem aanbieden. */
export interface ProductGroup {
  /** Groep-id: EAN indien beschikbaar, anders brand+line+packSize key. */
  groupId: string;
  brand: string;
  line: string | null;
  fitType: FitType;
  isOEM: boolean;
  packSize: number | null;
  /** Representatieve titel (van de listing met de laagste prijs per kop). */
  title: string;
  imageUrl: string | null;
  /** Alle listings voor dit product, gesorteerd op pricePerHead oplopend. */
  listings: Product[];
  /** Goedkoopste listing (listings[0]), of null als alle packSize onbekend zijn. */
  cheapest: Product | null;
}

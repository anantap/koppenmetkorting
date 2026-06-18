import groupsJson from '../data/products.json';
import metaJson from '../data/meta.json';
import type { ProductGroup } from './types.js';

export const groups = groupsJson as unknown as ProductGroup[];
export const meta = metaJson as {
  generatedAt: string;
  totalListings: number;
  totalGroups: number;
  flaggedPackSizeUnknown: number;
  sources: string[];
};

/** Groepen met een bekende prijs-per-kop, gesorteerd oplopend — de basis voor de ranking. */
export function rankedGroups(): ProductGroup[] {
  return groups
    .filter((g) => g.cheapest !== null)
    .sort((a, b) => (a.cheapest!.pricePerHead! - b.cheapest!.pricePerHead!));
}

/** Groepen waarvan de pakgrootte niet bepaald kon worden — uitgesloten van de ranking. */
export function flaggedGroups(): ProductGroup[] {
  return groups.filter((g) => g.cheapest === null);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** URL-veilige slug voor een groupId (EAN of fallback-key). */
export function groupSlug(groupId: string): string {
  return groupId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function allBrands(): string[] {
  return [...new Set(groups.map((g) => g.brand))].sort();
}

export function allFitTypes(): string[] {
  return [...new Set(groups.map((g) => g.fitType))].sort();
}

import { describe, expect, it } from 'vitest';
import {
  calculatePricePerHead,
  detectFitType,
  detectIsOEM,
  extractPackSize,
  fallbackMatchKey,
  groupProducts,
  normalizeBrand,
  resolvePackSize,
} from '../src/lib/parse.js';
import type { Product } from '../src/lib/types.js';

describe('extractPackSize', () => {
  it('herkent "8 stuks"', () => {
    expect(extractPackSize('Oral-B EB20 opzetborstels 8 stuks')).toBe(8);
  });

  it('herkent "8-pack"', () => {
    expect(extractPackSize('Sonicare ProResults 8-pack')).toBe(8);
  });

  it('herkent "8 opzetborstels"', () => {
    expect(extractPackSize('Set van 8 opzetborstels voor Oral-B')).toBe(8);
  });

  it('herkent "4 + 4" als som', () => {
    expect(extractPackSize('Oral-B CrossAction 4 + 4')).toBe(8);
  });

  it('herkent "set van 6"', () => {
    expect(extractPackSize('Jordan opzetborstels set van 6')).toBe(6);
  });

  it('herkent "(x8)"', () => {
    expect(extractPackSize('Philips Sonicare opzetborstels (x8)')).toBe(8);
  });

  it('herkent "8pack" zonder spatie', () => {
    expect(extractPackSize('Oral-B 8pack opzetborstels')).toBe(8);
  });

  it('herkent enkelvoud "1 opzetborstel"', () => {
    expect(extractPackSize('Oral-B losse opzetborstel 1 opzetborstel')).toBe(1);
  });

  it('geeft null voor titels zonder herkenbaar aantal', () => {
    expect(extractPackSize('Philips Sonicare for Kids opzetborstels')).toBeNull();
  });

  it('geeft null voor lege titel', () => {
    expect(extractPackSize('')).toBeNull();
  });
});

describe('resolvePackSize', () => {
  it('geeft voorrang aan een expliciet numeriek veld boven de titel', () => {
    expect(resolvePackSize('4', 'Oral-B opzetborstels 8 stuks')).toBe(4);
  });

  it('valt terug op titel-parsing als het expliciete veld leeg is', () => {
    expect(resolvePackSize('', 'Oral-B opzetborstels 8 stuks')).toBe(8);
    expect(resolvePackSize(undefined, 'Oral-B opzetborstels 8 stuks')).toBe(8);
  });

  it('negeert een ongeldig expliciet veld en valt terug op de titel', () => {
    expect(resolvePackSize('niet-numeriek', 'Oral-B opzetborstels 4 stuks')).toBe(4);
  });

  it('geeft null als geen van beide een aantal opleveren', () => {
    expect(resolvePackSize('', 'Philips Sonicare for Kids opzetborstels')).toBeNull();
  });
});

describe('calculatePricePerHead', () => {
  it('berekent en rondt af op 2 decimalen', () => {
    expect(calculatePricePerHead(10, 3)).toBe(3.33);
  });

  it('geeft null bij ontbrekende packSize', () => {
    expect(calculatePricePerHead(10, null)).toBeNull();
  });

  it('geeft null bij packSize 0', () => {
    expect(calculatePricePerHead(10, 0)).toBeNull();
  });
});

describe('normalizeBrand', () => {
  it('normaliseert Oral-B varianten', () => {
    expect(normalizeBrand('oral b', 'Oral B opzetborstels')).toBe('Oral-B');
    expect(normalizeBrand('', 'Oral-B EB20 opzetborstels')).toBe('Oral-B');
  });

  it('normaliseert Philips/Sonicare naar Philips Sonicare', () => {
    expect(normalizeBrand('Philips', 'Philips Sonicare opzetborstels')).toBe(
      'Philips Sonicare'
    );
  });

  it('valt terug op het ruwe merk of Generiek', () => {
    expect(normalizeBrand('Jordan', 'Jordan opzetborstels')).toBe('Jordan');
    expect(normalizeBrand('', 'Compatible opzetborstels')).toBe('Generiek');
  });
});

describe('detectFitType', () => {
  it('detecteert oral-b-click', () => {
    expect(detectFitType('Oral-B', 'Oral-B EB20 opzetborstels')).toBe('oral-b-click');
  });

  it('detecteert sonicare-click', () => {
    expect(detectFitType('Philips Sonicare', 'Sonicare opzetborstels')).toBe(
      'sonicare-click'
    );
  });

  it('valt terug op generic', () => {
    expect(detectFitType('Jordan', 'Jordan opzetborstels')).toBe('generic');
  });
});

describe('detectIsOEM', () => {
  it('herkent compatible-keywords als niet-OEM', () => {
    expect(detectIsOEM('Oral-B', 'Opzetborstels geschikt voor Oral-B')).toBe(false);
    expect(detectIsOEM('Generiek', 'Compatible opzetborstels')).toBe(false);
    expect(detectIsOEM('Oral-B', 'Vervangende opzetborstels')).toBe(false);
  });

  it('herkent OEM-merken als OEM zonder compatible-keywords', () => {
    expect(detectIsOEM('Oral-B', 'Oral-B EB20 Precision Clean')).toBe(true);
    expect(detectIsOEM('Philips Sonicare', 'Philips Sonicare ProResults')).toBe(true);
  });

  it('generieke merken zijn nooit OEM', () => {
    expect(detectIsOEM('Generiek', 'Huismerk opzetborstels')).toBe(false);
  });
});

describe('fallbackMatchKey', () => {
  it('produceert een stabiele, genormaliseerde key', () => {
    expect(fallbackMatchKey('Oral-B', 'CrossAction', 8)).toBe('oral-b|crossaction|8');
  });

  it('werkt ook zonder line of packSize', () => {
    expect(fallbackMatchKey('Generiek', null, null)).toBe('generiek||');
  });
});

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'x',
    ean: null,
    brand: 'Oral-B',
    line: null,
    title: 'Test opzetborstels',
    fitType: 'oral-b-click',
    isOEM: true,
    shop: 'Bol.com',
    price: 10,
    packSize: 4,
    pricePerHead: 2.5,
    url: '#',
    imageUrl: null,
    lastSeen: '2026-01-01',
    packSizeUnknown: false,
    ...overrides,
  };
}

describe('groupProducts', () => {
  it('groepeert op EAN als die aanwezig is', () => {
    const products = [
      makeProduct({ id: 'a', ean: '123', shop: 'Bol.com', price: 8, pricePerHead: 2 }),
      makeProduct({ id: 'b', ean: '123', shop: 'Kruidvat', price: 9, pricePerHead: 2.25 }),
    ];
    const groups = groupProducts(products);
    expect(groups).toHaveLength(1);
    expect(groups[0].listings).toHaveLength(2);
    expect(groups[0].cheapest?.shop).toBe('Bol.com');
  });

  it('groepeert op brand+line+packSize als EAN ontbreekt', () => {
    const products = [
      makeProduct({ id: 'a', ean: null, brand: 'Jordan', line: 'Clean Slim', packSize: 2 }),
      makeProduct({ id: 'b', ean: null, brand: 'Jordan', line: 'Clean Slim', packSize: 2 }),
      makeProduct({ id: 'c', ean: null, brand: 'Jordan', line: 'Clean Slim', packSize: 4 }),
    ];
    const groups = groupProducts(products);
    expect(groups).toHaveLength(2);
  });

  it('sluit producten zonder packSize uit van de "cheapest"-bepaling', () => {
    const products = [
      makeProduct({ id: 'a', ean: '999', packSize: null, pricePerHead: null }),
    ];
    const groups = groupProducts(products);
    expect(groups[0].cheapest).toBeNull();
  });

  it('sorteert listings op pricePerHead oplopend, nulls laatst', () => {
    const products = [
      makeProduct({ id: 'a', ean: '1', pricePerHead: 3 }),
      makeProduct({ id: 'b', ean: '1', pricePerHead: null, packSize: null }),
      makeProduct({ id: 'c', ean: '1', pricePerHead: 1.5 }),
    ];
    const groups = groupProducts(products);
    const order = groups[0].listings.map((l) => l.id);
    expect(order).toEqual(['c', 'a', 'b']);
  });
});

import { mkdir, writeFile } from 'node:fs/promises';
import { adapters } from '../src/adapters/index.js';
import { groupProducts } from '../src/lib/parse.js';
import type { Product } from '../src/lib/types.js';

async function main() {
  const allProducts: Product[] = [];
  const skippedByAdapter: Record<string, number> = {};

  for (const adapter of adapters) {
    const rows = await adapter.fetch();
    let skipped = 0;
    for (const row of rows) {
      const product = adapter.map(row);
      if (product) {
        allProducts.push(product);
      } else {
        skipped++;
      }
    }
    skippedByAdapter[adapter.name] = skipped;
    console.log(`[${adapter.name}] ${rows.length} rijen gelezen, ${rows.length - skipped} producten gemapt, ${skipped} overgeslagen`);
  }

  const groups = groupProducts(allProducts);
  const flaggedCount = allProducts.filter((p) => p.packSizeUnknown).length;

  await mkdir('src/data', { recursive: true });
  await writeFile('src/data/products.json', JSON.stringify(groups, null, 2));

  const meta = {
    generatedAt: new Date().toISOString(),
    totalListings: allProducts.length,
    totalGroups: groups.length,
    flaggedPackSizeUnknown: flaggedCount,
    sources: adapters.map((a) => a.name),
  };
  await writeFile('src/data/meta.json', JSON.stringify(meta, null, 2));

  console.log(
    `Klaar: ${allProducts.length} listings -> ${groups.length} productgroepen (${flaggedCount} geflagged zonder packSize).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

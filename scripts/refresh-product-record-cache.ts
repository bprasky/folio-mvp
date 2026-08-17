#!/usr/bin/env tsx
/**
 * Refresh the denormalized Product Record coverage cache (spec 22_PRODUCT_RECORD).
 *
 * Usage:
 *   npx tsx scripts/refresh-product-record-cache.ts                 # every product with at least one tag
 *   npx tsx scripts/refresh-product-record-cache.ts --all           # every product, including untagged
 *   npx tsx scripts/refresh-product-record-cache.ts --product <id>  # one product
 *   npx tsx scripts/refresh-product-record-cache.ts --dry-run       # report drift, write nothing
 *
 * WHY THIS IS A BATCH SCRIPT AND NOT A HOOK ON TAG CREATION.
 *
 * The Record surface computes coverage live and never reads these columns, so a
 * stale cache can under-report a list surface but cannot produce a wrong Record
 * or a wrong coverage sentence. That asymmetry is what makes batch refresh safe.
 *
 * The alternative — writing to Product on every ProductTag create — touches four
 * creation routes including the import and living-project paths, puts a write on
 * the designer's tagging hot path, and buys nothing until a list surface reads
 * the columns. Wire it up when something reads them; until then this runs on a
 * schedule.
 *
 * Idempotent. Safe to re-run.
 */

import { prisma } from '../src/lib/prisma';
import { refreshProductRecordCache } from '../src/server/queries/getProductRecord';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ALL = args.includes('--all');
const productIdArg = args.includes('--product') ? args[args.indexOf('--product') + 1] : null;

async function main() {
  let productIds: string[];

  if (productIdArg) {
    productIds = [productIdArg];
  } else if (ALL) {
    const rows = await prisma.product.findMany({ select: { id: true } });
    productIds = rows.map((r) => r.id);
  } else {
    // Default: only products a designer has actually specified. An untagged
    // product's counts are already 0 and recomputing them is a no-op with a
    // round trip attached.
    const rows = await prisma.product.findMany({
      where: { tags: { some: {} } },
      select: { id: true },
    });
    productIds = rows.map((r) => r.id);
  }

  console.log(
    `[refresh-product-record-cache] ${productIds.length} product(s)${DRY_RUN ? ' (dry run)' : ''}`,
  );

  let changed = 0;
  let failed = 0;

  for (const id of productIds) {
    try {
      const before = await prisma.product.findUnique({
        where: { id },
        select: {
          recordTier: true,
          specifierCount: true,
          projectCount: true,
          testimonyCount: true,
        },
      });
      if (!before) continue;

      if (DRY_RUN) {
        // Recompute without writing by reading the live record directly.
        const { getProductRecord } = await import('../src/server/queries/getProductRecord');
        const record = await getProductRecord(id, 'DESIGNER');
        if (!record) continue;
        const drifted =
          record.tier !== before.recordTier ||
          record.coverage.specifierCount !== before.specifierCount ||
          record.coverage.projectCount !== before.projectCount ||
          record.coverage.testimonyCount !== before.testimonyCount;
        if (drifted) {
          changed++;
          console.log(
            `  ${id}: ${before.recordTier}/${before.specifierCount}/${before.projectCount}/${before.testimonyCount}` +
              ` -> ${record.tier}/${record.coverage.specifierCount}/${record.coverage.projectCount}/${record.coverage.testimonyCount}`,
          );
        }
        continue;
      }

      const result = await refreshProductRecordCache(id);
      if (!result) continue;
      const drifted =
        result.tier !== before.recordTier ||
        result.coverage.specifierCount !== before.specifierCount ||
        result.coverage.projectCount !== before.projectCount ||
        result.coverage.testimonyCount !== before.testimonyCount;
      if (drifted) {
        changed++;
        console.log(
          `  ${id}: ${before.recordTier}/${before.specifierCount}/${before.projectCount}/${before.testimonyCount}` +
            ` -> ${result.tier}/${result.coverage.specifierCount}/${result.coverage.projectCount}/${result.coverage.testimonyCount}`,
        );
      }
    } catch (err) {
      failed++;
      console.error(`  ${id}: FAILED — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(
    `[refresh-product-record-cache] ${changed} changed, ${failed} failed, ${productIds.length - failed} processed.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

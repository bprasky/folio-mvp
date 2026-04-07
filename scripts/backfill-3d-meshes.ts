/**
 * Backfill script: Generate 3D meshes for existing products
 *
 * Usage:
 *   npx tsx scripts/backfill-3d-meshes.ts
 *   npx tsx scripts/backfill-3d-meshes.ts --limit=10
 *   DRY_RUN=1 npx tsx scripts/backfill-3d-meshes.ts
 *
 * Processes products that have images but no 3D mesh yet.
 * Calls the product-level generate-3d API endpoint for each product.
 *
 * Requires:
 *   - NEXT_PUBLIC_BASE_URL (e.g. http://localhost:3000)
 *   - ADMIN_API_KEY or a valid session cookie for auth
 *   - SAM3D_ENDPOINT configured on the server (otherwise generation will fail)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Categories where 3D reconstruction produces poor results — skip by default
const LOW_QUALITY_CATEGORIES = ['tile', 'textile', 'fabric', 'paint', 'wallpaper'];

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;
  const dryRun = process.env.DRY_RUN === '1';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const apiKey = process.env.ADMIN_API_KEY;

  if (dryRun) {
    console.log('=== DRY RUN MODE — no generation will occur ===\n');
  }

  // Find products with images but no mesh, excluding low-quality categories
  const products = await prisma.product.findMany({
    where: {
      threeDAssetUrl: null,
      imageUrl: { not: null },
      NOT: {
        category: { in: LOW_QUALITY_CATEGORIES },
      },
    },
    take: limit,
    select: { id: true, name: true, category: true, imageUrl: true },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${products.length} products to process (limit: ${limit})\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const product of products) {
    console.log(`[${success + failed + skipped + 1}/${products.length}] ${product.name} (${product.id})`);
    console.log(`  Category: ${product.category || 'none'}`);

    if (dryRun) {
      console.log('  → Would process (dry run)\n');
      skipped++;
      continue;
    }

    try {
      const res = await fetch(`${baseUrl}/api/products/${product.id}/generate-3d`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (data.status === 'success') {
        success++;
        console.log(`  ✓ Complete: ${data.meshUrl}\n`);
      } else if (data.status === 'already_exists') {
        skipped++;
        console.log(`  → Already has mesh: ${data.meshUrl}\n`);
      } else {
        failed++;
        console.log(`  ✗ Failed: ${data.error || 'Unknown error'}\n`);
      }
    } catch (e: any) {
      failed++;
      console.log(`  ✗ Error: ${e.message}\n`);
    }

    // Rate limit: don't hammer the GPU service
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log('─'.repeat(40));
  console.log(`Done: ${success} success, ${failed} failed, ${skipped} skipped`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

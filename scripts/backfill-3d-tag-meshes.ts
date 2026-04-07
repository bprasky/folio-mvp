/**
 * Backfill script: Generate 3D meshes for existing product tags
 *
 * Usage:
 *   npx tsx scripts/backfill-3d-tag-meshes.ts
 *   npx tsx scripts/backfill-3d-tag-meshes.ts --limit=10
 *   DRY_RUN=1 npx tsx scripts/backfill-3d-tag-meshes.ts
 *
 * Processes ProductTags that have associated images but no 3D mesh yet.
 * For each tag, calls the tag-level generate-3d API endpoint which:
 *   1. Runs SAM segmentation at the tag's x,y coordinates
 *   2. Extracts product mask
 *   3. Generates 3D mesh via SAM 3D Objects
 *   4. Uploads mesh + mask to storage
 *   5. Promotes canonical mesh if this is the best for the product
 *
 * Requires:
 *   - NEXT_PUBLIC_BASE_URL (e.g. http://localhost:3000)
 *   - ADMIN_API_KEY for auth
 *   - SAM3D_ENDPOINT configured on the server
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Categories where SAM 3D produces poor results
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

  // Find tags with images but no mesh, excluding low-quality product categories
  const tags = await prisma.productTag.findMany({
    where: {
      meshStatus: null,
      image: {
        url: { not: null },
      },
      product: {
        NOT: {
          category: { in: LOW_QUALITY_CATEGORIES },
        },
      },
    },
    take: limit,
    select: {
      id: true,
      x: true,
      y: true,
      productId: true,
      product: {
        select: { id: true, name: true, category: true },
      },
      image: {
        select: { id: true, url: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${tags.length} tags to process (limit: ${limit})\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const tag of tags) {
    const productName = tag.product?.name || 'Unknown';
    console.log(
      `[${success + failed + skipped + 1}/${tags.length}] ` +
      `${productName} (tag: ${tag.id}, x:${tag.x.toFixed(2)} y:${tag.y.toFixed(2)})`
    );
    console.log(`  Category: ${tag.product?.category || 'none'}`);

    if (dryRun) {
      console.log('  → Would process (dry run)\n');
      skipped++;
      continue;
    }

    try {
      const res = await fetch(`${baseUrl}/api/tags/${tag.id}/generate-3d`, {
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
        console.log(`  ✓ Complete (confidence: ${data.confidence?.toFixed(2) || 'N/A'})\n`);
      } else if (data.status === 'already_exists') {
        skipped++;
        console.log(`  → Already has mesh\n`);
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

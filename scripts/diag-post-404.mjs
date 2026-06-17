// Read-only diagnostic for /p/[slug] 404s. No writes. SELECT queries only.
// Reproduces the exact getPostBySlug query path so a swallowed error surfaces.
//
// PowerShell:
//   $env:DATABASE_URL = Read-Host "DATABASE_URL"; node scripts/diag-post-404.mjs meru-XB4XBK lucas-house-VRBWUP

import { PrismaClient } from '@prisma/client';

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('ERR: neither DIRECT_URL nor DATABASE_URL is set');
  process.exit(1);
}

const prisma = new PrismaClient({ datasourceUrl: url });

const slugs = process.argv.slice(2);
if (slugs.length === 0) slugs.push('meru-XB4XBK', 'lucas-house-VRBWUP');

// Client-agnostic check: does the actual prod DB have the columns the
// CURRENT (main) Prisma client selects via `include`? $queryRawUnsafe hits
// information_schema directly, so it does NOT depend on the generated client
// being up to date — unlike the include queries below.
async function columnCheck() {
  console.log('=== raw column existence (information_schema, client-agnostic) ===');
  const checks = [
    ['product_tags', 'reviewedAt'], // added by PR #646 migration 20260617120000
    ['products', 'scrapeStatus'],
    ['products', 'isPending'],
  ];
  for (const [table, col] of checks) {
    try {
      const r = await prisma.$queryRawUnsafe(
        `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2) AS present`,
        table, col
      );
      const present = r[0].present;
      console.log(`  ${table}.${col}: ${present ? 'PRESENT' : '*** MISSING ***'}`);
    } catch (e) {
      console.log(`  ${table}.${col}: check failed: ${e.message}`);
    }
  }
}
await columnCheck();

async function diagOne(slug) {
  console.log(`\n=== ${slug} ===`);

  // 1) Bare existence + status (no relations) — isolates "does the row exist".
  try {
    const bare = await prisma.projectPost.findUnique({
      where: { slug },
      select: { id: true, status: true, projectId: true, slug: true },
    });
    if (!bare) {
      console.log('  [bare] NO ROW for this slug — 404 is correct (slug mismatch / unpublished record absent)');
      return;
    }
    console.log(`  [bare] found id=${bare.id} status=${bare.status} projectId=${bare.projectId}`);
    if (bare.status !== 'PUBLISHED') {
      console.log(`  [bare] status is ${bare.status}, not PUBLISHED -> getPostBySlug returns null -> 404`);
    }
  } catch (e) {
    console.log('  [bare] THREW:', e.message);
    return;
  }

  // 2) The exact include used by getPostBySlug — this is where a swallowed
  //    column/relation error would fire for every project.
  try {
    await prisma.projectPost.findUnique({
      where: { slug },
      include: {
        project: {
          include: {
            designer: {
              select: { id: true, name: true, studio: true, profileImage: true, bio: true, website: true, instagram: true, linkedin: true },
            },
            images: {
              include: {
                tags: {
                  where: { product: { isPending: false } },
                  include: {
                    product: {
                      include: {
                        vendor: { select: { id: true, name: true, companyName: true, website: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        supplementalQuotes: {
          select: { id: true, question: true, answer: true, contributorRole: true, userId: true, productTagId: true, pinned: true, displayLocation: true, source: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    console.log('  [full include] OK — query succeeded, no swallowed error here');
  } catch (e) {
    console.log('  [full include] THREW:', e.message);
  }

  // 3) getProjectModules query.
  try {
    const post = await prisma.projectPost.findUnique({ where: { slug }, select: { projectId: true } });
    await prisma.projectModule.findMany({
      where: { projectId: post.projectId, publishedAt: { not: null } },
      orderBy: [{ pinned: 'desc' }, { type: 'asc' }, { publishedAt: 'desc' }],
    });
    console.log('  [modules] OK');
  } catch (e) {
    console.log('  [modules] THREW:', e.message);
  }
}

for (const s of slugs) {
  await diagOne(s);
}

await prisma.$disconnect();

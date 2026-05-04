/**
 * Phase 1 audit (tasks/19_CUTOUT_FORK_AND_CATALOG_DEFAULT.md)
 *
 * Read-only. Surfaces, for every distinct product referenced by ProductTag
 * or ProjectProductTag:
 *   - imageUrl populated   → OK count.
 *   - imageUrl null, url populated → re-scrapable count, with sample IDs.
 *   - both null            → vendor-blocked count, with sample IDs.
 *
 * Also prints the same buckets restricted to products tagged on the current
 * homepage XL post (PINNED_HERO_POST_SLUG in src/lib/homepage/getHomepageData.ts)
 * so we can see exactly what's missing on the visible reel.
 *
 * Usage:
 *   npx tsx scripts/audit-tagged-product-images.ts
 *   npx tsx scripts/audit-tagged-product-images.ts --post=<slug>
 *
 * No writes. Safe against prod.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SAMPLE_SIZE = 5;
const DEFAULT_HOMEPAGE_SLUG = "meru-XB4XBK";

type ProductRow = {
  id: string;
  name: string;
  imageUrl: string | null;
  url: string | null;
  vendorName: string | null;
};

function bucket(rows: ProductRow[]) {
  const ok: ProductRow[] = [];
  const rescrapable: ProductRow[] = [];
  const blocked: ProductRow[] = [];
  for (const r of rows) {
    if (r.imageUrl && r.imageUrl.length > 0) ok.push(r);
    else if (r.url && r.url.length > 0) rescrapable.push(r);
    else blocked.push(r);
  }
  return { ok, rescrapable, blocked };
}

function printBucket(label: string, rows: ProductRow[], total: number) {
  const pct = total === 0 ? 0 : Math.round((rows.length / total) * 100);
  console.log(`  ${label}: ${rows.length} (${pct}%)`);
}

function printSamples(label: string, rows: ProductRow[]) {
  if (rows.length === 0) return;
  console.log(`\n  ${label} — first ${Math.min(SAMPLE_SIZE, rows.length)}:`);
  for (const r of rows.slice(0, SAMPLE_SIZE)) {
    const vendor = r.vendorName ? ` [${r.vendorName}]` : "";
    const urlPreview = r.url ? ` url=${r.url.slice(0, 60)}${r.url.length > 60 ? "…" : ""}` : "";
    console.log(`    - ${r.id} "${r.name}"${vendor}${urlPreview}`);
  }
}

async function loadProducts(productIds: string[]): Promise<ProductRow[]> {
  if (productIds.length === 0) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      url: true,
      vendor: { select: { name: true } },
    },
  });
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.imageUrl,
    url: p.url,
    vendorName: p.vendor?.name ?? null,
  }));
}

async function reportScope(scopeLabel: string, productIds: string[]) {
  console.log(`\n=== ${scopeLabel} ===`);
  console.log(`Distinct products: ${productIds.length}`);
  if (productIds.length === 0) {
    console.log("  (no products in scope — nothing to audit)");
    return;
  }
  const rows = await loadProducts(productIds);
  const buckets = bucket(rows);
  printBucket("imageUrl OK             ", buckets.ok, rows.length);
  printBucket("imageUrl null, url set  ", buckets.rescrapable, rows.length);
  printBucket("imageUrl null, url null ", buckets.blocked, rows.length);
  printSamples("Re-scrapable (Phase 4 will hit these)", buckets.rescrapable);
  printSamples("Vendor-blocked (need vendor follow-up)", buckets.blocked);
}

async function main() {
  const postArg = process.argv.find((a) => a.startsWith("--post="));
  const homepageSlug = postArg ? postArg.split("=")[1] : DEFAULT_HOMEPAGE_SLUG;

  // Global scope: every distinct product referenced by either tag table.
  const [productTags, projectProductTags] = await Promise.all([
    prisma.productTag.findMany({ select: { productId: true } }),
    prisma.projectProductTag.findMany({ select: { productId: true } }),
  ]);
  const allTaggedIds = Array.from(
    new Set([
      ...productTags.map((t) => t.productId),
      ...projectProductTags.map((t) => t.productId),
    ]),
  );
  await reportScope("All tagged products (ProductTag ∪ ProjectProductTag)", allTaggedIds);

  // Homepage-XL scope: tags on images that belong to the pinned post's project.
  const post = await prisma.projectPost.findFirst({
    where: { slug: homepageSlug, status: "PUBLISHED" },
    select: { id: true, slug: true, project: { select: { id: true, title: true } } },
  });
  if (!post?.project) {
    console.log(`\n=== Homepage XL post (slug="${homepageSlug}") ===`);
    console.log("  Post not found or not published — skipping scope.");
  } else {
    const homepageTags = await prisma.productTag.findMany({
      where: { image: { projectId: post.project.id } },
      select: { productId: true },
    });
    const homepageProductIds = Array.from(new Set(homepageTags.map((t) => t.productId)));
    await reportScope(
      `Homepage XL post — slug="${post.slug}" project="${post.project.title ?? post.project.id}"`,
      homepageProductIds,
    );
  }

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

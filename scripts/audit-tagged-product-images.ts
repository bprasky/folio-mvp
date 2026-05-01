/**
 * Audit script: catalog-image health for tagged products
 *
 * Usage:
 *   npx tsx scripts/audit-tagged-product-images.ts
 *   npx tsx scripts/audit-tagged-product-images.ts --post=against-cape-towns-dramatic-mountains
 *   npx tsx scripts/audit-tagged-product-images.ts --check-urls           # slow; HEAD-checks every imageUrl
 *   npx tsx scripts/audit-tagged-product-images.ts --check-urls --concurrency=4
 *   npx tsx scripts/audit-tagged-product-images.ts --post=<slug> --check-urls
 *
 * Read-only. Reports how many tagged products fall into each catalog-image
 * health bucket so we can decide what backfill needs to do:
 *
 *   - vendor-blocked      imageUrl null, url null
 *   - re-scrapable        imageUrl null, url populated
 *   - claims-image        imageUrl populated   (default; doesn't catch dead URLs)
 *   - working / dead      with --check-urls: HEAD-check resolves into 200 vs non-200
 *
 * Also reports per-bucket presence of ProductTag.cropUrl, since that's the
 * render-time fallback in BoostReelCell.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Args {
  postSlug: string | null;
  checkUrls: boolean;
  concurrency: number;
  sampleSize: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    postSlug: null,
    checkUrls: false,
    concurrency: 6,
    sampleSize: 5,
  };
  for (const raw of argv.slice(2)) {
    if (raw === "--check-urls") args.checkUrls = true;
    else if (raw.startsWith("--post=")) args.postSlug = raw.slice("--post=".length);
    else if (raw.startsWith("--concurrency=")) args.concurrency = Number(raw.slice("--concurrency=".length));
    else if (raw.startsWith("--samples=")) args.sampleSize = Number(raw.slice("--samples=".length));
    else if (raw === "--help" || raw === "-h") {
      console.log(`See header of ${__filename} for usage.`);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${raw}`);
      process.exit(2);
    }
  }
  return args;
}

async function resolveProjectIdFromPost(slug: string): Promise<string | null> {
  const post = await prisma.projectPost.findFirst({
    where: { slug },
    select: { projectId: true },
  });
  return post?.projectId ?? null;
}

async function headCheck(url: string, timeoutMs = 8000): Promise<{ ok: boolean; status: number | null; reason?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Some CDNs (and Next.js's image optimizer) only honor GET; HEAD can 405.
    // Try HEAD first, fall back to a GET with Range so we don't pull the body.
    let res = await fetch(url, { method: "HEAD", signal: controller.signal });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        signal: controller.signal,
      });
    }
    return { ok: res.ok, status: res.status };
  } catch (err: any) {
    return { ok: false, status: null, reason: err?.message ?? "fetch error" };
  } finally {
    clearTimeout(timer);
  }
}

async function checkInBatches<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = items.slice();
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length) {
        const next = queue.shift();
        if (next === undefined) break;
        await worker(next);
      }
    }),
  );
}

async function main() {
  const args = parseArgs(process.argv);

  let projectIdFilter: string | null = null;
  if (args.postSlug) {
    projectIdFilter = await resolveProjectIdFromPost(args.postSlug);
    if (!projectIdFilter) {
      console.error(`No ProjectPost found with slug "${args.postSlug}".`);
      process.exit(1);
    }
    console.log(`Scope: ProjectPost slug=${args.postSlug} → projectId=${projectIdFilter}\n`);
  } else {
    console.log("Scope: all ProductTag records across all projects\n");
  }

  // Pull every ProductTag in scope plus the joined Product fields we care
  // about. For large tag tables this is fine — only a handful of fields per
  // row, and we dedupe to distinct products in memory.
  const tags = await prisma.productTag.findMany({
    where: projectIdFilter ? { image: { projectId: projectIdFilter } } : undefined,
    select: {
      productId: true,
      cropUrl: true,
      product: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          url: true,
        },
      },
    },
  });

  // Dedupe by productId. A product tagged on multiple images counts once;
  // we keep the first tag whose cropUrl is set (so the "has crop fallback"
  // signal reflects whether the reel could degrade gracefully).
  type Row = {
    productId: string;
    name: string;
    imageUrl: string | null;
    url: string | null;
    cropUrl: string | null;
  };
  const byProduct = new Map<string, Row>();
  for (const t of tags) {
    if (!t.product) continue;
    const existing = byProduct.get(t.productId);
    if (!existing) {
      byProduct.set(t.productId, {
        productId: t.product.id,
        name: t.product.name,
        imageUrl: t.product.imageUrl,
        url: t.product.url,
        cropUrl: t.cropUrl ?? null,
      });
    } else if (!existing.cropUrl && t.cropUrl) {
      existing.cropUrl = t.cropUrl;
    }
  }
  const rows = Array.from(byProduct.values());

  if (rows.length === 0) {
    console.log("No tagged products found in scope.");
    return;
  }

  // Bucket by null-status of imageUrl/url.
  const vendorBlocked: Row[] = [];
  const reScrapable: Row[] = [];
  const claimsImage: Row[] = [];
  for (const r of rows) {
    if (!r.imageUrl && !r.url) vendorBlocked.push(r);
    else if (!r.imageUrl) reScrapable.push(r);
    else claimsImage.push(r);
  }

  console.log(`Tagged distinct products in scope: ${rows.length}`);
  console.log(`  vendor-blocked (no imageUrl, no url): ${vendorBlocked.length}`);
  console.log(`  re-scrapable    (no imageUrl, has url): ${reScrapable.length}`);
  console.log(`  claims-image    (imageUrl populated):   ${claimsImage.length}`);

  const withCrop = rows.filter((r) => r.cropUrl).length;
  console.log(`\nProducts whose tag has a cropUrl (render-time fallback ready): ${withCrop} / ${rows.length}`);

  const printSamples = (label: string, list: Row[]) => {
    if (list.length === 0) return;
    console.log(`\nSamples — ${label} (showing ${Math.min(args.sampleSize, list.length)} / ${list.length}):`);
    for (const r of list.slice(0, args.sampleSize)) {
      console.log(
        `  ${r.productId}  ${r.name}  ` +
          `imageUrl=${r.imageUrl ? "set" : "null"}  ` +
          `url=${r.url ? "set" : "null"}  ` +
          `cropUrl=${r.cropUrl ? "set" : "null"}`,
      );
    }
  };
  printSamples("vendor-blocked", vendorBlocked);
  printSamples("re-scrapable", reScrapable);
  printSamples("claims-image", claimsImage);

  if (!args.checkUrls) {
    console.log(
      "\n(Skipped HEAD-check on imageUrls. Pass --check-urls to find dead links.)",
    );
    return;
  }

  console.log(
    `\nHEAD-checking ${claimsImage.length} non-null imageUrls (concurrency=${args.concurrency})...`,
  );

  let working = 0;
  let dead = 0;
  const deadSamples: Array<{ row: Row; status: number | null; reason?: string }> = [];

  await checkInBatches(claimsImage, args.concurrency, async (row) => {
    const result = await headCheck(row.imageUrl!);
    if (result.ok) {
      working += 1;
    } else {
      dead += 1;
      if (deadSamples.length < args.sampleSize) {
        deadSamples.push({ row, status: result.status, reason: result.reason });
      }
    }
  });

  console.log(`\nimageUrl HEAD results:`);
  console.log(`  working (2xx): ${working}`);
  console.log(`  dead    (non-2xx / fetch error): ${dead}`);

  if (deadSamples.length) {
    console.log(`\nSamples — dead imageUrls (showing ${deadSamples.length} / ${dead}):`);
    for (const s of deadSamples) {
      console.log(
        `  ${s.row.productId}  ${s.row.name}  ` +
          `status=${s.status ?? "n/a"}  ${s.reason ? `reason=${s.reason}  ` : ""}` +
          `cropUrl=${s.row.cropUrl ? "set" : "null"}  ` +
          `url=${s.row.url ? "set" : "null"}`,
      );
    }
  }

  // Cross-cut: dead imageUrls that DO have a cropUrl can be papered over by
  // the BoostReelCell render fallback today; ones that don't will need
  // either a re-scrape (if Product.url is set) or vendor follow-up.
  const deadWithCrop = claimsImage.filter(
    (r) => deadSamples.some((s) => s.row.productId === r.productId) && r.cropUrl,
  ).length;
  console.log(
    `\nOf the dead-imageUrl samples printed above, ${deadWithCrop} have cropUrl set ` +
      `(handled by Phase 0.5 render fallback).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

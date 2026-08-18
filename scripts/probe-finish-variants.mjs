/**
 * Do the retailers Folio actually tags publish readable finish data?
 * (spec 21 delta D3)
 *
 * The "offer only the finishes that product comes in" design rests on retailers
 * exposing variants in JSON-LD. That cannot be checked from a datacenter IP —
 * retailers 403 anything that is not a browser — so this runs from a normal
 * machine.
 *
 * Usage, from the repo root:
 *
 *   node scripts/probe-finish-variants.mjs            # real URLs from the database
 *   node scripts/probe-finish-variants.mjs <url> ...  # specific pages
 *   node scripts/probe-finish-variants.mjs --limit 30 # widen the database sample
 *
 * With no arguments it samples product URLs designers have ACTUALLY tagged,
 * which is the only sample that answers the real question. Three URLs picked by
 * hand answer a question about those three retailers; the corpus answers the
 * question about Folio.
 *
 * Detects BOTH variant shapes Google supports (added Feb 2024), because
 * checking only one produces false negatives:
 *   - hasVariant   — variants nested under a ProductGroup, one page per product
 *   - isVariantOf  — each variant a flat Product node, common on multi-page setups
 *
 * Read-only. Fetches public pages, reads the database, writes nothing.
 */

import * as cheerio from 'cheerio';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** A JSON-LD scalar that may be a string, an array, or a Thing with a name. */
function scalar(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) return scalar(value[0]);
  if (typeof value === 'object') return scalar(value.name);
  return null;
}

function typesOf(node) {
  const t = node?.['@type'];
  return Array.isArray(t) ? t : t ? [t] : [];
}

/** Every JSON-LD node on the page, flattened out of arrays and @graph wrappers. */
function jsonLdNodes($) {
  const out = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).contents().text() || '{}');
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed['@graph'])
          ? parsed['@graph']
          : [parsed];
      out.push(...list);
    } catch {
      /* malformed JSON-LD is common in the wild; skip it */
    }
  });
  return out;
}

function analyse(html) {
  const $ = cheerio.load(html);
  const nodes = jsonLdNodes($);

  const products = nodes.filter((n) => typesOf(n).includes('Product'));
  const groups = nodes.filter((n) => typesOf(n).includes('ProductGroup'));
  const primary = groups[0] || products[0] || null;

  // Shape 1: variants nested under a ProductGroup.
  const nested = groups
    .flatMap((g) => (Array.isArray(g.hasVariant) ? g.hasVariant : g.hasVariant ? [g.hasVariant] : []))
    .map((v) => scalar(v?.color) || scalar(v?.name))
    .filter(Boolean);

  // Shape 2: each variant its own flat Product pointing back at a group.
  const flat = products
    .filter((p) => p.isVariantOf)
    .map((p) => scalar(p.color) || scalar(p.name))
    .filter(Boolean);

  const finishes = [...new Set([...nested, ...flat])];

  return {
    hasJsonLd: nodes.length > 0,
    productNodes: products.length,
    groupNodes: groups.length,
    color: scalar(primary?.color),
    material: scalar(primary?.material),
    variesBy: (Array.isArray(primary?.variesBy) ? primary.variesBy : [primary?.variesBy])
      .filter(Boolean)
      .map((v) => scalar(v) || String(v)),
    finishes,
    // A strong hint about which platform the retailer is on, since variant
    // markup adoption tracks platform more than it tracks retailer size.
    shopify: /cdn\.shopify\.com|Shopify\.theme/i.test(html),
  };
}

/** Real product URLs designers have tagged, newest first. */
async function urlsFromDatabase(limit) {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const tagged = await prisma.product.findMany({
      where: { url: { not: null } },
      select: { url: true, name: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return tagged.filter((p) => /^https?:\/\//i.test(p.url ?? ''));
  } finally {
    await prisma.$disconnect();
  }
}

// --- run ---------------------------------------------------------------------

const argv = process.argv.slice(2);
const limitFlag = argv.indexOf('--limit');
const limit = limitFlag !== -1 ? Number(argv[limitFlag + 1]) || 15 : 15;
const explicit = argv.filter((a) => /^https?:\/\//i.test(a));

let targets;
if (explicit.length) {
  targets = explicit.map((url) => ({ url, name: null }));
  console.log(`\nProbing ${targets.length} page(s) given on the command line.\n`);
} else {
  try {
    targets = await urlsFromDatabase(limit);
    console.log(`\nProbing ${targets.length} product URL(s) from the database — real pages designers tagged.\n`);
  } catch (err) {
    console.error(`Could not read the database (${err.message?.slice(0, 80)}).`);
    console.error('Pass URLs directly instead: node scripts/probe-finish-variants.mjs <url> ...\n');
    process.exit(1);
  }
}

if (!targets.length) {
  console.log('No product URLs found. Tag a product with a link, or pass URLs directly.\n');
  process.exit(0);
}

const tally = { reached: 0, withJsonLd: 0, withProduct: 0, withVariants: 0, withColor: 0, shopify: 0 };

for (const { url, name } of targets) {
  const label = name ? `${name.slice(0, 32)} — ` : '';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.log(`  HTTP ${String(res.status).padEnd(4)} ${label}${url.slice(0, 70)}`);
      continue;
    }
    tally.reached++;

    const a = analyse(await res.text());
    if (a.hasJsonLd) tally.withJsonLd++;
    if (a.productNodes || a.groupNodes) tally.withProduct++;
    if (a.finishes.length) tally.withVariants++;
    if (a.color) tally.withColor++;
    if (a.shopify) tally.shopify++;

    const flags = [
      a.groupNodes ? `group=${a.groupNodes}` : null,
      a.productNodes ? `product=${a.productNodes}` : null,
      a.color ? `color=${JSON.stringify(a.color)}` : null,
      a.material ? `material=${JSON.stringify(a.material)}` : null,
      a.variesBy.length ? `variesBy=${a.variesBy.join(',')}` : null,
      a.shopify ? 'shopify' : null,
    ].filter(Boolean);

    console.log(
      `  ${a.finishes.length ? `VARIANTS(${a.finishes.length})` : a.hasJsonLd ? 'ld-only    ' : 'no-ld      '} ${flags.join('  ') || '—'}`,
    );
    if (a.finishes.length) {
      console.log(`      → ${a.finishes.slice(0, 8).join(' | ')}${a.finishes.length > 8 ? ' …' : ''}`);
    }
    console.log(`      ${label}${url.slice(0, 90)}`);
  } catch (err) {
    console.log(`  ERROR ${err.name?.padEnd(14)} ${label}${url.slice(0, 60)}`);
  }
}

console.log(`
  ── summary ─────────────────────────────────
  pages reached          ${tally.reached} / ${targets.length}
  had any JSON-LD        ${tally.withJsonLd}
  had a Product node     ${tally.withProduct}
  had a single color     ${tally.withColor}
  had a VARIANT LIST     ${tally.withVariants}   <- the number that decides it
  on Shopify             ${tally.shopify}

  A high variant count means the picker can offer only the finishes that
  product comes in. A low one means free text plus the catalog proposal —
  what already ships — is the feature, and the extra column is not worth it.
`);

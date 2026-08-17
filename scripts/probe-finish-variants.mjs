/**
 * Do retailers actually publish finish data we can read? (spec 21 delta D3)
 *
 * The "offer only the finishes that product comes in" design rests on retailers
 * exposing their variants in JSON-LD. That cannot be checked from a datacenter
 * IP — every retailer returns 403 — so it has to run from a normal machine.
 *
 * Usage, from the repo root:
 *
 *   node scripts/probe-finish-variants.mjs
 *   node scripts/probe-finish-variants.mjs <url> <url> ...
 *
 * Pass your own product URLs to get an answer about the retailers you actually
 * specify from. The defaults are a starting point, not a sample.
 *
 * Reading the output:
 *
 *   variants=4 → Unlacquered Brass | Polished Nickel
 *       The design works. Options come from the product's own page, which is
 *       what keeps "Polished Nickel" off a couch.
 *
 *   variants=0  color="Matte Black"
 *       One finish per URL, no list. The picker becomes "confirm this one"
 *       rather than "choose from these".
 *
 *   no JSON-LD, or 403
 *       Nothing structured to read. Options would have to come from the AI tier,
 *       which is a much weaker case for the extra column and parsing.
 *
 * Read-only. Fetches public pages, writes nothing, touches no database.
 */

import * as cheerio from 'cheerio';

const DEFAULT_URLS = [
  'https://www.rejuvenation.com/products/chelsea-sconce/',
  'https://www.schoolhouse.com/products/isaac-sconce',
  'https://www.cb2.com/peyton-brass-table-lamp/s267834',
];

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

function productNode(html) {
  const $ = cheerio.load(html);
  const nodes = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).contents().text() || '{}');
      nodes.push(
        ...(Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed['@graph'])
            ? parsed['@graph']
            : [parsed]),
      );
    } catch {
      /* malformed JSON-LD is common; skip it */
    }
  });
  const isProduct = (n) => {
    const t = n?.['@type'];
    const wanted = ['Product', 'ProductGroup'];
    return Array.isArray(t) ? t.some((x) => wanted.includes(x)) : wanted.includes(t);
  };
  // Prefer a ProductGroup — that is where hasVariant lives when it exists.
  return nodes.find((n) => n?.['@type'] === 'ProductGroup') || nodes.find(isProduct) || null;
}

const urls = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_URLS;

console.log(`\nProbing ${urls.length} product page(s) for published finish data.\n`);

for (const url of urls) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      console.log(`  HTTP ${res.status}  (blocked or unreachable)  ${url}`);
      continue;
    }

    const node = productNode(await res.text());
    if (!node) {
      console.log(`  no JSON-LD Product node                      ${url}`);
      continue;
    }

    const raw = node.hasVariant;
    const variants = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
    const finishes = variants.map((v) => scalar(v?.color)).filter(Boolean);

    const parts = [
      `type=${JSON.stringify(node['@type'])}`,
      `color=${JSON.stringify(scalar(node.color))}`,
      `material=${JSON.stringify(scalar(node.material))}`,
      `variants=${variants.length}`,
    ];
    console.log(`  ${parts.join('  ')}`);
    if (finishes.length) {
      console.log(`      → ${finishes.slice(0, 8).join(' | ')}${finishes.length > 8 ? ' …' : ''}`);
    }
    console.log(`      ${url}`);
  } catch (err) {
    console.log(`  ERROR ${err.name}: ${String(err.message).slice(0, 60)}  ${url}`);
  }
}

console.log('');

#!/usr/bin/env node
/**
 * BQL diagnostic probe.
 *
 * Purpose: when a flagged-domain scrape comes back fast with no content ("short
 * fetch time, nothing retrieved"), this isolates WHICH layer is failing —
 * auth/endpoint, the residential-proxy params, or the conditional if/solve rung
 * in the app mutation. It prints the full raw response for each variant so the
 * exact failure (401 token, 400 bad param, GraphQL error, empty html) is
 * visible instead of guessed.
 *
 * It is read-only against Browserless: it does NOT touch the database or the
 * app. Each variant is one BQL call (spends proxy units on the proxied ones), so
 * it runs a deliberately small set, cheapest first.
 *
 * Usage:
 *   BROWSERLESS_API_KEY=... node scripts/bql-probe.mjs [url]
 *   (BROWSERLESS_TOKEN is accepted as an alias, same as the app.)
 *
 * Default URL is a Pottery Barn PDP, the domain that prompted this.
 */

const HOST = 'https://production-sfo.browserless.io';
const KEY = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
const URL_TO_SCRAPE =
  process.argv[2] ||
  'https://www.potterybarn.com/products/york-leather-sofa/';

if (!KEY) {
  console.error(
    'No key. Set BROWSERLESS_API_KEY (or BROWSERLESS_TOKEN) in the environment.',
  );
  process.exit(1);
}

// Minimal mutation: just navigate and grab HTML. Isolates connectivity / auth /
// endpoint / proxy from the conditional captcha rung.
const MINIMAL = `mutation Probe($url: String!) {
  goto(url: $url, waitUntil: domContentLoaded) { status time }
  content: html { html }
}`;

// The exact rung the app sends, including the gated solve branches.
const FULL = `mutation FolioBqlScrape($url: String!) {
  goto(url: $url, waitUntil: domContentLoaded) { status }
  recaptcha: if(selector: ".g-recaptcha, iframe[src*='recaptcha']") {
    solve(type: recaptcha) { found solved time }
  }
  cloudflare: if(selector: ".cf-turnstile, iframe[src*='challenges.cloudflare.com']") {
    solve(type: cloudflare) { found solved time }
  }
  content: html { html }
}`;

/** Run one variant and print everything that matters for diagnosis. */
async function probe(label, { path, params, mutation }) {
  const qs = new URLSearchParams({ token: KEY, ...params }).toString();
  const endpoint = `${HOST}${path}?${qs}`;
  // Redact the token in the printed URL.
  const shown = endpoint.replace(KEY, '<token>');

  console.log('\n' + '='.repeat(72));
  console.log(`VARIANT: ${label}`);
  console.log(`POST ${shown}`);

  const started = Date.now();
  let res, raw;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: mutation, variables: { url: URL_TO_SCRAPE } }),
    });
    raw = await res.text();
  } catch (err) {
    console.log(`TRANSPORT ERROR after ${Date.now() - started}ms:`, err?.message || err);
    return;
  }
  const ms = Date.now() - started;

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* non-JSON body (often an HTML error page from a wrong path) */
  }

  console.log(`HTTP ${res.status} in ${ms}ms`);
  if (!parsed) {
    console.log('Body is not JSON. First 400 chars:');
    console.log(raw.slice(0, 400));
    return;
  }

  if (Array.isArray(parsed.errors) && parsed.errors.length) {
    console.log('GraphQL errors:');
    for (const e of parsed.errors) console.log('  -', e?.message);
  }
  const data = parsed.data || {};
  const gotoStatus = data?.goto?.status ?? null;
  const html = typeof data?.content?.html === 'string' ? data.content.html : '';
  console.log(`goto.status: ${gotoStatus}`);
  console.log(`html length: ${html.length}`);
  if (data?.recaptcha || data?.cloudflare) {
    console.log('solve:', JSON.stringify({ recaptcha: data.recaptcha, cloudflare: data.cloudflare }));
  }
  if (html.length) {
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1];
    console.log(`<title>: ${title ? title.trim() : '(none)'}`);
  }
}

console.log(`Probing: ${URL_TO_SCRAPE}`);

// Cheapest first. A → does basic BQL even work (auth/endpoint, no proxy).
// B → does the stealth + residential proxy path the app uses work.
// C → does the full app mutation (with the if/solve rung) work.
await probe('A: minimal, /chromium/bql, no proxy', {
  path: '/chromium/bql',
  params: {},
  mutation: MINIMAL,
});
await probe('B: minimal, /stealth/bql, residential proxy', {
  path: '/stealth/bql',
  params: { proxy: 'residential', proxyCountry: 'us' },
  mutation: MINIMAL,
});
await probe('C: full app mutation, /stealth/bql, residential proxy', {
  path: '/stealth/bql',
  params: { proxy: 'residential', proxyCountry: 'us' },
  mutation: FULL,
});

console.log('\n' + '='.repeat(72));
console.log('Read-out:');
console.log('  - All HTTP 401          -> bad/missing token.');
console.log('  - A 404 / non-JSON      -> wrong endpoint path for this host.');
console.log('  - B 400 + GraphQL error -> a proxy query param is rejected.');
console.log('  - A/B ok, C fails       -> the if/solve rung is the problem.');
console.log('  - All ok, html > 0      -> BQL works; the bug is downstream (route/extract).');
console.log('  - All fast + html = 0   -> the call is not reaching a real browser navigation.');

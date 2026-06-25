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
 *   node scripts/bql-probe.mjs [url]
 *
 * It prompts for your Browserless token (input is hidden). If you'd rather not
 * be prompted, set BROWSERLESS_API_KEY or BROWSERLESS_TOKEN and it uses that.
 *
 * Default URL is a Pottery Barn PDP, the domain that prompted this.
 */

import readline from 'node:readline';

let HOST = 'https://production-sfo.browserless.io';
const URL_TO_SCRAPE =
  process.argv[2] ||
  'https://www.potterybarn.com/products/york-leather-sofa/';

/** Ask for a secret on the terminal without echoing the keystrokes. */
function askHidden(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    // Suppress echo of the typed token (the query itself still prints).
    let muted = false;
    rl._writeToOutput = (str) => {
      if (!muted) rl.output.write(str);
    };
    rl.question(query, (val) => {
      rl.close();
      process.stdout.write('\n');
      resolve(val.trim());
    });
    muted = true;
  });
}

let KEY = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;

if (!KEY) {
  const entered = await askHidden(
    'Paste your Browserless token OR the full BrowserQL connect URL, then press Enter: ',
  );
  // If they pasted the whole dashboard URL, pull the token and host out of it so
  // there is no chance of a copy error or a region mismatch.
  if (/^https?:\/\//i.test(entered)) {
    try {
      const u = new URL(entered);
      HOST = u.origin;
      KEY = u.searchParams.get('token') || '';
      console.log(`Parsed host from URL: ${HOST}`);
    } catch {
      console.error('That looked like a URL but could not be parsed. Aborting.');
      process.exit(1);
    }
  } else {
    KEY = entered;
  }
}

if (!KEY) {
  console.error('No token provided. Aborting.');
  process.exit(1);
}

// Sanity-check what was actually received (no secret exposed): the length and
// first 3 chars let you compare against the key shown in the dashboard, ruling
// out a truncated paste or pasting the wrong thing entirely.
console.log(`Token received: length=${KEY.length}, starts with "${KEY.slice(0, 3)}"`);

// Minimal mutation: just navigate and grab HTML. Isolates connectivity / auth /
// endpoint / proxy from the conditional captcha rung.
const MINIMAL = `mutation Probe($url: String!) {
  goto(url: $url, waitUntil: domContentLoaded) { status time }
  content: html { html }
}`;

// The exact rung the app sends, including the gated solve branches and the 45s
// goto timeout.
const FULL = `mutation FolioBqlScrape($url: String!) {
  goto(url: $url, waitUntil: domContentLoaded, timeout: 45000) { status }
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

// A → the EXACT config the app now ships (full mutation, plain endpoint, no
//     proxy, 45s goto timeout). This is the one that matters.
// B → stealth endpoint, still no residential proxy: the fallback if a domain
//     ever needs anti-detection without the slow residential exit.
await probe('A: SHIPPING config — full mutation, /chromium/bql, no proxy', {
  path: '/chromium/bql',
  params: {},
  mutation: FULL,
});
await probe('B: full mutation, /stealth/bql, no proxy', {
  path: '/stealth/bql',
  params: {},
  mutation: FULL,
});

console.log('\n' + '='.repeat(72));
console.log('Read-out:');
console.log('  - A is HTTP 200 + big html + real product <title> -> ship it; this is the app config.');
console.log('  - A times out / thin html                         -> tell me; we raise the goto timeout or add the proxy back.');
console.log('  - All HTTP 401                                     -> stale token (clear $env:BROWSERLESS_API_KEY).');

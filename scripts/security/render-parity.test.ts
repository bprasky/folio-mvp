import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { extractProductFromHtml, parsePriceNumber } from '../../src/lib/products/extractProductFields';
import { fixtureResponse } from '../../services/render-worker/test/public-fixture.mjs';

function checkFields(html: string, finalUrl: string) {
  const fields = extractProductFromHtml(html, finalUrl);
  assert.equal(fields.name, 'Acceptance Oak Chair');
  assert.equal(fields.image, new URL('/chair.svg', finalUrl).href);
  assert.equal(parsePriceNumber(fields.price), 249);
  assert.equal(fields.description, 'A controlled solid oak chair fixture.');
}
const html = fixtureResponse('/static', '', 'https://8.8.8.8').body;
test('static public fixture has expected name, primary image, price and description', () => checkFields(html, 'https://8.8.8.8/static'));
test('Linux-rendered fixture output preserves extraction across four categories', { skip: !process.env.RENDER_ACCEPTANCE_RESULTS && 'Linux browser acceptance output unavailable' }, () => {
  const data = JSON.parse(readFileSync(process.env.RENDER_ACCEPTANCE_RESULTS!, 'utf8'));
  assert.equal(data.parity.length, 4);
  for (const page of data.parity) { assert.equal(page.status, 200); checkFields(page.html, page.finalUrl); }
});

const require = createRequire(resolve('scripts/security/render-parity.test.ts'));
function replace(name: string, exports: unknown) {
  const file = require.resolve(name); require.cache[file] = { id: file, filename: file, loaded: true, exports } as NodeJS.Module;
}
let renders = 0; let cache: Record<string, unknown> | null = null;
const writes: Array<Record<string, unknown>> = [];
replace('next-auth', { getServerSession: async () => ({ user: { id: 'vendor-a', role: 'VENDOR' } }) });
replace('../../src/app/api/auth/[...nextauth]/options', { authOptions: {} });
replace('../../src/lib/prisma', { prisma: {
  product: { findUnique: async () => ({ id: 'product-a', vendorId: 'vendor-a', url: 'https://8.8.8.8/start', scrapeStatus: 'pending' }), update: async (args: Record<string, unknown>) => { writes.push(args); return args; } },
  cachedProduct: { findUnique: async () => cache, upsert: async (args: { create: Record<string, unknown> }) => { cache = args.create; return cache; } },
} });
replace('../../src/lib/rateLimit', { checkMultipleRateLimits: async () => ({ success: true }) });
replace('../../src/lib/browserless/record', { hasRecentBlockedAttempt: async () => true, recordScrapeAttempt: async () => {} });
replace('../../src/lib/server/render-product', { renderProductPage: async () => { renders++; return { html, status: 200, finalUrl: 'https://8.8.8.8/static' }; } });
const route = require('../../src/app/api/products/[productId]/scrape-bql/route');
test('protected escalation persists fields/status with ownership predicates, then reuses cache without rendering', async () => {
  const request = () => new NextRequest('https://folio.test/api/products/product-a/scrape-bql', { method: 'POST' });
  const result = await route.POST(request(), { params: { productId: 'product-a' } });
  assert.equal(result.status, 200); assert.equal(renders, 1);
  const last = writes.at(-1) as { where: Record<string, unknown>; data: Record<string, unknown> };
  assert.deepEqual(last.where, { id: 'product-a', vendorId: 'vendor-a', url: 'https://8.8.8.8/start' });
  assert.equal(last.data.scrapeStatus, 'complete'); assert.equal(last.data.name, 'Acceptance Oak Chair'); assert.equal(last.data.price, 249);
  const cached = await route.POST(request(), { params: { productId: 'product-a' } });
  assert.equal((await cached.json()).cached, true); assert.equal(renders, 1);
});

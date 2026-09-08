import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Webhook } from 'svix';
import { NextRequest } from 'next/server';

// Replace only infrastructure boundaries before loading real handlers. No production DB,
// auth provider, browser, email service or LLM can be reached by this process.
const require = createRequire(resolve('scripts/security/p0-routes.test.ts'));
let session: { user: { id: string; role: string } } | null = null;
let allowed = true;
const calls: Array<{ method: string; args: any }> = [];
let handlers: Record<string, (args: any) => any> = {};
const database = new Proxy({}, { get: (_target, model: string) => new Proxy({}, {
  get: (_model, method: string) => async (args: unknown) => {
    const key = `${model}.${method}`;
    calls.push({ method: key, args });
    if (!handlers[key]) throw new Error(`Unexpected database call: ${key}`);
    return handlers[key](args);
  },
}) });
function replace(name: string, exports: unknown) {
  const filename = require.resolve(name);
  require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module;
}
replace('../../src/lib/prisma', { prisma: database });
replace('next-auth', { getServerSession: async () => session });
replace('../../src/lib/auth', { authOptions: {} });
replace('../../src/app/api/auth/[...nextauth]/options', { authOptions: {} });
replace('../../src/lib/rateLimit', {
  getClientIp: () => 'test-ip',
  checkMultipleRateLimits: async () => ({ success: allowed }),
  rateLimit: async () => ({ ok: allowed }),
});
replace('../../src/lib/server/render-product', { renderProductPage: async () => { throw Error('Renderer unavailable'); } });
replace('../../src/lib/browserless/record', { hasRecentBlockedAttempt: async () => false, recordScrapeAttempt: async () => {} });
replace('../../src/lib/three-d/triggerMeshGeneration', { triggerMeshGeneration: () => { calls.push({ method: 'mesh', args: {} }); } });
replace('../../src/lib/telemetry/context-signal', { logSignal: async () => {}, extractTags: () => [] });

const feed = require('../../src/app/api/orgs/[orgId]/feed/route');
const inquiry = require('../../src/app/api/orgs/[orgId]/inquiry/route');
const prompts = require('../../src/app/api/orgs/[orgId]/prompts/route');
const answer = require('../../src/app/api/orgs/[orgId]/prompts/[promptId]/answer/route');
const scrape = require('../../src/app/api/products/[productId]/scrape-bql/route');
const products = require('../../src/app/api/products/route');
const productDetail = require('../../src/app/api/products/[productId]/route');
const inbound = require('../../src/app/api/email/inbound/route');
const orgParams = { params: { orgId: 'org-a' } };
const req = (body?: unknown) => new NextRequest('https://folio.test/api/test', body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => { session = null; allowed = true; calls.length = 0; handlers = {}; });

test('private prompts reject anonymous and wrong-org users before prompt reads', async () => {
  assert.equal((await prompts.GET(req(), orgParams)).status, 401);
  assert.equal(calls.length, 0);
  session = { user: { id: 'user-b', role: 'VENDOR' } };
  handlers['organizationUser.findFirst'] = args => {
    assert.deepEqual(args.where, { organizationId: 'org-a', userId: 'user-b', isActive: true });
    return null;
  };
  assert.equal((await prompts.GET(req(), orgParams)).status, 403);
  assert.equal(calls.some(c => c.method.startsWith('vendorPrompt')), false);
});

test('active org member can read only scoped/global active prompts, with a limited projection', async () => {
  session = { user: { id: 'member', role: 'VENDOR' } };
  handlers['organizationUser.findFirst'] = () => ({ role: 'VIEWER' });
  handlers['vendorPrompt.findMany'] = args => {
    assert.deepEqual(args.where.OR, [{ organizationId: 'org-a', status: 'ACTIVE' }, { organizationId: null, status: 'ACTIVE' }]);
    assert.equal(args.select.relatedDesignerId, undefined);
    return [{ id: 'prompt-a', title: 'Own prompt', status: 'ACTIVE' }];
  };
  assert.equal((await prompts.GET(req(), orgParams)).status, 200);
});

test('public feed excludes private/unpublished projects, pending products and internal product images', async () => {
  handlers['organization.findUnique'] = () => ({ type: 'VENDOR' });
  handlers['organizationUser.findMany'] = () => [{ userId: 'vendor' }];
  handlers['inContextBoost.findMany'] = args => {
    assert.deepEqual(args.where.productTag.image.project, { isPublic: true, post: { status: 'PUBLISHED' } });
    assert.equal(args.where.product.isPending, false);
    assert.equal(args.select.followUpAnswer, undefined);
    assert.equal(args.select.impressions, undefined);
    return [{ id: 'boost', product: { name: 'Chair', imageUrl: 'https://private-image.test', imageSource: 'VENDOR_REFERENCE', cutoutImageUrl: null }, productTag: { image: { url: 'public-project-photo', project: { title: 'Published', post: { status: 'PUBLISHED', slug: 'published' } } } } }];
  };
  handlers['projectPost.findMany'] = args => { assert.equal(args.where.project.isPublic, true); assert.equal(args.where.status, 'PUBLISHED'); return []; };
  handlers['vendorPost.findMany'] = args => { assert.equal(args.where.status, 'PUBLISHED'); return []; };
  handlers['product.findMany'] = args => { assert.equal(args.where.isPending, false); return []; };
  const response = await feed.GET(req(), orgParams);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.items[0].productImage, null);
  assert.equal(JSON.stringify(body).includes('private-image'), false);
  assert.equal(JSON.stringify(body).includes('userId'), false);
});

test('public inquiry rejects injected recipients/oversized fields, honors limits, derives recipient from org leadership', async () => {
  const input = { name: 'Contact', email: 'contact@example.com', message: 'A question' };
  assert.equal((await inquiry.POST(req({ ...input, userId: 'victim' }), orgParams)).status, 400);
  assert.equal((await inquiry.POST(req({ ...input, message: 'x'.repeat(4001) }), orgParams)).status, 400);
  allowed = false;
  assert.equal((await inquiry.POST(req(input), orgParams)).status, 429);
  assert.equal(calls.length, 0);
  allowed = true;
  handlers['organization.findUnique'] = () => ({ name: 'Vendor', type: 'VENDOR' });
  handlers['organizationUser.findMany'] = args => {
    assert.deepEqual(args.where, { organizationId: 'org-a', isActive: true, role: { in: ['OWNER', 'ADMIN'] } });
    return [{ userId: 'org-a-admin' }];
  };
  handlers['notification.create'] = args => { assert.equal(args.data.userId, 'org-a-admin'); return {}; };
  const response = await inquiry.POST(req(input), orgParams);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
});

test('answer mutation rejects inactive/view-only members and another tenant prompt before writes', async () => {
  session = { user: { id: 'member-a', role: 'VENDOR' } };
  const params = { params: { orgId: 'org-a', promptId: 'prompt-b' } };
  for (const member of [{ isActive: false, role: 'OWNER' }, { isActive: true, role: 'VIEWER' }]) {
    handlers['organizationUser.findUnique'] = () => member;
    assert.equal((await answer.POST(req({ answer: 'Some answer' }), params)).status, 403);
  }
  handlers['organizationUser.findUnique'] = () => ({ isActive: true, role: 'OWNER' });
  handlers['vendorPrompt.findFirst'] = args => {
    assert.deepEqual(args.where.OR, [{ organizationId: 'org-a' }, { organizationId: null }]); return null;
  };
  assert.equal((await answer.POST(req({ answer: 'Some answer' }), params)).status, 404);
  assert.equal(calls.some(c => /create|update/.test(c.method)), false);
});

test('claimed product escalation rejects other users before spending or writing', async () => {
  const params = { params: { productId: 'claimed' } };
  assert.equal((await scrape.POST(req({}), params)).status, 401);
  session = { user: { id: 'attacker', role: 'DESIGNER' } };
  handlers['product.findUnique'] = () => ({ id: 'claimed', vendorId: 'vendor-owner', url: null });
  assert.equal((await scrape.POST(req({}), params)).status, 403);
  assert.equal(calls.some(c => /update|mesh/.test(c.method)), false);
  session.user.id = 'vendor-owner'; allowed = false;
  assert.equal((await scrape.POST(req({}), params)).status, 429);
});

test('catalog enrichment retains unclaimed and empty-field conditions at write time', async () => {
  session = { user: { id: 'designer', role: 'DESIGNER' } };
  handlers['product.findFirst'] = () => ({ id: 'shared', vendorId: null, name: 'Chair', description: null });
  handlers['product.updateMany'] = args => {
    assert.equal(args.where.vendorId, null);
    assert.deepEqual(args.where.AND, [{ description: null }]);
    return { count: 0 }; // concurrent vendor claim wins; no overwrite
  };
  handlers['product.findUnique'] = () => ({ id: 'shared', vendorId: 'new-owner', description: 'Vendor description' });
  const response = await products.POST(req({ name: 'Chair', url: 'https://example.com/chair', description: 'New description' }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).product.description, 'Vendor description');
  assert.equal(calls.some(c => c.method === 'mesh'), false);
});

test('product edits cannot assign vendor ownership through a display name', async () => {
  session = { user: { id: 'designer', role: 'DESIGNER' } };
  handlers['product.findUnique'] = () => ({ vendorId: null, threeDAssetUrl: 'already-generated', name: 'Chair' });
  handlers['product.update'] = args => {
    assert.deepEqual(args.where, { id: 'product-a', vendorId: null });
    assert.equal(Object.hasOwn(args.data, 'vendorId'), false);
    return { id: 'product-a', name: 'Chair', vendorId: null, vendor: null };
  };
  const response = await productDetail.PUT(req({ name: 'Chair', vendorName: 'Attacker-controlled vendor' }), { params: { productId: 'product-a' } });
  assert.equal(response.status, 200);
  assert.equal(calls.some(c => c.method.startsWith('user.')), false);
});

test('anonymous product detail applies the canonical image-provenance gate', async () => {
  handlers['product.findUnique'] = () => ({ id: 'product-a', name: 'Chair', imageUrl: 'https://internal-image.test/chair', imageSource: 'VENDOR_REFERENCE', cutoutImageUrl: null, vendor: null });
  const response = await productDetail.GET(req(), { params: { productId: 'product-a' } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).imageUrl, null);
});

test('signed webhook traverses real matcher and persists reply; invalid signature cannot access DB', async () => {
  const secret = `whsec_${Buffer.from('test-only-integration-secret-32!!').toString('base64')}`;
  const prior = process.env.RESEND_WEBHOOK_SECRET;
  process.env.RESEND_WEBHOOK_SECRET = secret;
  try {
    const raw = JSON.stringify({ type: 'email.received', data: { id: 'received-1', from: 'vendor@example.com', to: 'designer@reply.example.com', text: 'Reply body', headers: [{ name: 'In-Reply-To', value: '<outbound-1>' }] } });
    const now = new Date();
    const headers = { 'svix-id': 'message-1', 'svix-timestamp': String(Math.floor(+now / 1000)), 'svix-signature': new Webhook(secret).sign('message-1', now, raw) };
    const bad = await inbound.POST(new NextRequest('https://folio.test/api/email/inbound', { method: 'POST', body: raw + ' ', headers }));
    assert.equal(bad.status, 400); assert.equal(calls.length, 0);
    handlers['emailMessage.findFirst'] = args => { assert.equal(args.where.resendMessageId, 'outbound-1'); return { thread: { id: 'thread-a', userId: 'designer', conversationId: null } }; };
    handlers['emailMessage.create'] = args => { assert.equal(args.data.threadId, 'thread-a'); assert.equal(args.data.textBody, 'Reply body'); return {}; };
    handlers['emailThread.update'] = args => { assert.equal(args.data.status, 'REPLIED'); return {}; };
    handlers['emailThread.findUnique'] = () => null;
    const response = await inbound.POST(new NextRequest('https://folio.test/api/email/inbound', { method: 'POST', body: raw, headers }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).matched, true);
    assert.equal(calls.filter(c => c.method === 'emailMessage.create').length, 1);
  } finally { if (prior === undefined) delete process.env.RESEND_WEBHOOK_SECRET; else process.env.RESEND_WEBHOOK_SECRET = prior; }
});

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const sharp = require('sharp');
const { NextRequest } = require('next/server');
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://storage.test';
process.env.FAL_KEY = 'synthetic-never-sent';
const orgId = '53b2f9eb-e09b-4e48-a0ce-1b9d4152d894';
const importId = '53b2f9eb-e09b-4e48-a0ce-1b9d4152d890';
const candidateId = '53b2f9eb-e09b-4e48-a0ce-1b9d4152d891';
const ownUrl = `https://storage.test/storage/v1/object/public/user-avatars/org-profile/${orgId}/19c69c1b-940f-445b-bca4-f43a9e405a23.png`;
const context = { params: { orgId } };
let session, role, revoked, checks, uploads, removals, downloads, providerCalls, providerFailure, blocked, photo, mask;
const candidate = { id: candidateId, url: 'https://studio.test/team.jpg', sourceUrl: 'https://studio.test/about', label: 'Studio founders' };
function replace(name, exports) { const id = require.resolve(name.startsWith('src/') ? resolve(name) : name); require.cache[id] = { id, filename: id, loaded: true, exports }; }
replace('server-only', {});
replace('src/app/api/auth/[...nextauth]/options.ts', { authOptions: {} });
replace('next-auth', { getServerSession: async () => session });
replace('src/lib/rateLimit.ts', { rateLimit: async () => ({ ok: !blocked }) });
replace('src/lib/prisma.ts', { prisma: {
  organizationUser: { findFirst: async ({ where }) => { assert.deepEqual(where, { userId: 'admin', organizationId: orgId, isActive: true }); checks++; return role && !(revoked && checks > 1) ? { role } : null; } },
  importSession: { findMany: async ({ where }) => {
    assert.deepEqual(where.AND, [{ processingMeta: { path: ['kind'], equals: 'workspace-import-v1' } }, { processingMeta: { path: ['orgId'], equals: orgId } }]);
    if (where.id && where.id !== importId) return [];
    return [{ id: importId, processingMeta: { kind: 'workspace-import-v1', orgId, sections: ['business'], pages: [], projects: [], notification: {}, profile: { portraitCandidates: [candidate] } } }];
  } },
} });
replace('src/lib/supabaseAdmin.ts', { supabaseAdmin: { storage: { from: bucket => {
  assert.equal(bucket, 'user-avatars'); return {
    upload: async (path, bytes) => { uploads.push({ path, bytes }); return {}; },
    getPublicUrl: path => ({ data: { publicUrl: `https://storage.test/storage/v1/object/public/user-avatars/${path}` } }),
    remove: async paths => { removals.push(...paths); return {}; },
  };
} } } });
// Real bounded request-body reader and PNG decoder; only external image transport is replaced.
const imageInput = require(resolve('src/lib/server/project-image-input.ts'));
replace('src/lib/server/project-image-input.ts', { ...imageInput, fetchProjectImage: async url => { downloads.push(url); return { buffer: photo, mime: 'image/png' }; } });
replace('@fal-ai/client', { createFalClient: () => ({ run: async (model, options) => {
  providerCalls++; assert.equal(model, 'fal-ai/birefnet'); assert.equal(options.input.refine_foreground, false); assert.equal(options.input.sync_mode, true);
  assert.ok(options.input.image_url.startsWith('data:image/png;base64,'));
  if (providerFailure) throw new Error('synthetic provider unavailable');
  return { data: { mask_image: { url: `data:image/png;base64,${mask.toString('base64')}` } } };
} }) });
global.fetch = async () => { throw new Error('Unexpected network request'); };
const route = require(resolve('src/app/api/orgs/[orgId]/appearance/portraits/route.ts'));
const { cutoutPortrait } = require(resolve('src/lib/server/org-portrait.ts'));
let visionVerdict = 'NO';
replace('@anthropic-ai/sdk', class {
  messages = { create: async input => {
    assert.equal(input.messages[0].content[0].source.media_type, 'image/jpeg');
    return { content: [{ type: 'text', text: visionVerdict }] };
  } };
});
const { prepareImportPortrait, portraitPriority } = require(resolve('src/lib/workspace-import/portrait.ts'));
const { extractWebsitePage } = require(resolve('src/lib/workspace-import/extract.ts'));
const { defaultOrgAppearance, readOrgAppearance, orgProfileAppearanceSchema } = require(resolve('src/lib/org-profile-appearance.ts'));
const get = query => new NextRequest(`https://folio.test/api/portraits${query || ''}`);
const post = body => new NextRequest('https://folio.test/api/portraits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(async () => {
  session = { user: { id: 'admin' } }; role = 'ADMIN'; revoked = false; checks = 0; uploads = []; removals = []; downloads = []; providerCalls = 0; providerFailure = false; blocked = false;
  photo = await sharp({ create: { width: 4, height: 2, channels: 3, background: { r: 90, g: 130, b: 170 } } }).png().toBuffer();
  mask = await sharp(Buffer.from([0, 0, 255, 255, 0, 0, 255, 255]), { raw: { width: 4, height: 2, channels: 1 } }).png().toBuffer();
});
test('discovery finds team photographs, rejects room images, resolves srcset, and keeps Instagram on the linked official host', () => {
  const result = extractWebsitePage('<main><img src="/small.jpg" srcset="/small.jpg 300w, /large.jpg 1200w" alt="Co-founders Jane and Alex"><img src="/room.jpg" alt="Living room"><a href="https://www.instagram.com/studio/">Instagram</a><a href="https://instagram.com.evil.test/fake/">Other</a></main>', 'https://studio.test/about');
  assert.deepEqual(result.portraitCandidates, [{ url: 'https://studio.test/large.jpg', sourceUrl: 'https://studio.test/about', label: 'Co-founders Jane and Alex' }]);
  assert.equal(result.instagramUrl, 'https://www.instagram.com/studio/');
  assert.equal(extractWebsitePage('<main><img src="/project.jpg"></main>', 'https://studio.test/work/house').portraitCandidates.length, 0);
  assert.equal(extractWebsitePage('<main><img src="/founders.jpg" alt="Image"></main>', 'https://studio.test/about').portraitCandidates[0].label, 'Studio photograph');
});
test('legacy appearance is preserved; cutouts require an image; removal round-trips', () => {
  const old = { ...defaultOrgAppearance(), introduction: 'Saved introduction', coverPosition: { x: 20, y: 80 } };
  assert.deepEqual(readOrgAppearance(old), old);
  const portrait = { originalUrl: ownUrl, cutoutUrl: null, treatment: 'original', position: 60, scale: 90, caption: 'The founders' };
  assert.deepEqual(readOrgAppearance({ ...old, portrait }).portrait, portrait);
  assert.equal(orgProfileAppearanceSchema.safeParse({ ...old, portrait: { ...portrait, treatment: 'cutout' } }).success, false);
  assert.equal(readOrgAppearance({ ...old, portrait: null }).portrait, null);
});
test('anonymous, foreign and non-admin access cannot list, proxy, or prepare photos', async () => {
  session = null; assert.equal((await route.GET(get(), context)).status, 401);
  session = { user: { id: 'admin' } };
  for (const denied of [null, 'VIEWER', 'MEMBER', 'MANAGER']) {
    role = denied;
    assert.equal((await route.GET(get(`?import=${importId}&candidate=${candidateId}`), context)).status, 403);
    assert.equal((await route.POST(post({ importId, candidateId }), context)).status, 403);
  }
  assert.equal(downloads.length, 0); assert.equal(uploads.length, 0);
});

test('first import stores the cutout before review, can replay safely, and falls back to the original', async () => {
  process.env.ANTHROPIC_ENABLED = 'false';
  const first = await prepareImportPortrait('admin', orgId, importId, candidate);
  assert.equal(first.treatment, 'cutout');
  assert.equal(uploads.length, 2);
  assert.deepEqual(await prepareImportPortrait('admin', orgId, importId, candidate), first);
  providerFailure = true;
  const fallback = await prepareImportPortrait('admin', orgId, importId, candidate);
  assert.equal(fallback.originalUrl, first.originalUrl);
  assert.equal(fallback.cutoutUrl, null);
  assert.equal(fallback.treatment, 'original');
  const unlabeled = { ...candidate, label: 'Studio photograph' };
  assert.ok(portraitPriority(candidate) > portraitPriority(unlabeled));
  const count = uploads.length;
  assert.equal(await prepareImportPortrait('admin', orgId, importId, unlabeled), undefined);
  assert.equal(uploads.length, count);
});

test('unlabelled team-page imagery is checked for a portrait before storage', async () => {
  const env = { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, ANTHROPIC_ENABLED: process.env.ANTHROPIC_ENABLED };
  try {
    process.env.ANTHROPIC_API_KEY = 'fixture'; process.env.ANTHROPIC_ENABLED = 'true';
    visionVerdict = 'NO';
    assert.equal(await prepareImportPortrait('admin', orgId, importId, candidate), undefined);
    assert.equal(uploads.length, 0);
    visionVerdict = 'YES';
    assert.equal((await prepareImportPortrait('admin', orgId, importId, { ...candidate, label: 'Studio photograph' })).treatment, 'cutout');
  } finally {
    for (const [key, value] of Object.entries(env)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
test('private suggestions do not publish or expose the remote image transport URL', async () => {
  const response = await route.GET(get(), context);
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const data = await response.json(); assert.equal(data.candidates.length, 1); assert.equal(data.candidates[0].url, undefined);
  assert.equal(data.candidates[0].sourceUrl, candidate.sourceUrl);
  assert.equal(downloads.length, 0); assert.equal(uploads.length, 0); assert.equal(providerCalls, 0);
  const image = await route.GET(get(`?import=${importId}&candidate=${candidateId}`), context);
  assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/png'); assert.equal(uploads.length, 0);
});
test('selection prepares only the selected photo and does not call segmentation or mutate appearance', async () => {
  const response = await route.POST(post({ importId, candidateId }), context);
  assert.equal(response.status, 200); assert.match((await response.json()).originalUrl, /org-profile/);
  assert.equal(uploads.length, 1); assert.deepEqual(downloads, [candidate.url]); assert.equal(providerCalls, 0);
  assert.equal((await route.POST(post({ importId: candidateId, candidateId }), context)).status, 404);
});
test('cutout rejects cross-org, external and private URLs before any download or provider call', async () => {
  for (const originalUrl of [ownUrl.replace(orgId, importId), 'https://evil.test/photo.png', 'http://127.0.0.1/photo.png', ownUrl + '?token=x'])
    assert.equal((await route.POST(post({ originalUrl, cutout: true }), context)).status, 400);
  assert.equal(downloads.length, 0); assert.equal(providerCalls, 0);
});
test('segmentation preserves original RGB and applies the mask as alpha', async () => {
  const cutout = await cutoutPortrait(photo);
  const { data, info } = await sharp(cutout).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  for (let pixel = 0; pixel < 8; pixel++) { assert.deepEqual([...data.subarray(pixel * 4, pixel * 4 + 3)], [90, 130, 170]); assert.equal(data[pixel * 4 + 3], pixel % 4 < 2 ? 0 : 255); }
});
test('provider failure, rate limit and revoked access produce no published assets', async () => {
  providerFailure = true;
  assert.equal((await route.POST(post({ originalUrl: ownUrl, cutout: true }), context)).status, 500);
  assert.equal(uploads.length, 0);
  blocked = true; assert.equal((await route.POST(post({ importId, candidateId }), context)).status, 429);
  blocked = false; revoked = true; checks = 0;
  assert.equal((await route.POST(post({ importId, candidateId }), context)).status, 403); assert.equal(uploads.length, 0);
});

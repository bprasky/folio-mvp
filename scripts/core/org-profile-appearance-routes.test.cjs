const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const sharp = require('sharp');
const { NextRequest } = require('next/server');

// External boundaries only; exercise the real validators, permission matrix,
// image decoder and route handlers without application accounts or storage.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://storage.test';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';
let session, role, revoked, selected, saved, uploadFailure, uploads, removals, db;
const orgId = '53b2f9eb-e09b-4e48-a0ce-1b9d4152d894';
const imageId = '19c69c1b-940f-445b-bca4-f43a9e405a23';
const context = { params: { orgId } };
function replace(name, exports) {
  const id = require.resolve(name.startsWith('src/') ? resolve(name) : name);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
replace('server-only', {});
replace('src/app/api/auth/[...nextauth]/options.ts', { authOptions: {} });
replace('next-auth', { getServerSession: async () => session });
replace('next/cache', { revalidatePath: () => {} });
const facade = new Proxy({}, { get: (_, key) => db[key] });
replace('src/lib/prisma.ts', { prisma: facade });
replace('src/lib/supabaseAdmin.ts', { supabaseAdmin: { storage: { from: bucket => {
  assert.equal(bucket, 'user-avatars');
  return {
    upload: async (path, bytes, options) => { uploads.push({ path, bytes, options }); return { error: uploadFailure ? {} : null }; },
    remove: async paths => { removals.push(...paths); return { error: null }; },
    getPublicUrl: path => ({ data: { publicUrl: `https://storage.test/storage/v1/object/public/user-avatars/${path}` } }),
  };
} } } });
global.fetch = async () => { throw new Error('Unexpected external request'); };
const route = require(resolve('src/app/api/orgs/[orgId]/appearance/route.ts'));
const uploadRoute = require(resolve('src/app/api/orgs/[orgId]/appearance/image/route.ts'));
const feed = require(resolve('src/app/api/org/[orgId]/feed/route.ts'));
const { defaultOrgAppearance, orgProfileAppearanceSchema, profileFacts, profilePageStyle } = require(resolve('src/lib/org-profile-appearance.ts'));
const org = { id: orgId, name: 'Fixture Studio', type: 'DESIGN_FIRM', logo: null, description: null, tagline: null,
  location: null, foundedYear: null, specialties: [], serviceRegions: [], projectTypes: [], teamSizeRange: null };
const request = value => new NextRequest('http://folio.test/api/appearance', { method: 'PATCH', body: JSON.stringify(value) });
const get = () => new NextRequest('http://folio.test/api/appearance');

beforeEach(() => {
  session = { user: { id: 'admin' } }; role = 'ADMIN'; revoked = false; selected = true; saved = null;
  uploadFailure = false; uploads = []; removals = [];
  let membershipChecks = 0;
  db = {
    organizationUser: { findFirst: async query => {
      assert.deepEqual(query.where, { userId: 'admin', organizationId: orgId, isActive: true });
      membershipChecks++;
      return role && !(revoked && membershipChecks > 1) ? { role } : null;
    } },
    organization: {
      findUnique: async query => { assert.equal(query.where.id, orgId); return { ...org, profileAppearance: saved }; },
      update: async query => { assert.equal(query.where.id, orgId); saved = structuredClone(query.data.profileAppearance); return { id: orgId }; },
    },
    project: { count: async () => 4, findMany: async () => [] },
    projectImage: { findFirst: async query => {
      assert.deepEqual(query.where, { id: imageId, inclusion: 'INCLUDED', project: { designerOrgId: orgId, isPublic: true } });
      return selected ? { id: imageId } : null;
    } },
    orgMedia: { findMany: async () => [] }, orgRecognition: { findMany: async () => [] }, orgCollaboration: { findMany: async () => [] },
    $transaction: async work => work(db),
  };
});

test('owners and admins can save and reload; empty facts and explicit no-image persist', async () => {
  for (const allowed of ['OWNER', 'ADMIN']) {
    role = allowed;
    const appearance = { ...defaultOrgAppearance(), backgroundColor: '#152433', facts: [], cover: { kind: 'none' } };
    assert.equal((await route.PATCH(request(appearance), context)).status, 200);
    const response = await route.GET(get(), context);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).appearance, appearance);
  }
});

test('guests, inactive/foreign members, and every lower org role cannot read or save settings', async () => {
  for (const denied of [null, 'VIEWER', 'MEMBER', 'MANAGER']) {
    role = denied;
    assert.equal((await route.GET(get(), context)).status, 403);
    assert.equal((await route.PATCH(request(defaultOrgAppearance()), context)).status, 403);
    assert.equal((await uploadRoute.POST(get(), context)).status, 403);
  }
  session = null;
  for (const response of [await route.GET(get(), context), await route.PATCH(request(defaultOrgAppearance()), context), await uploadRoute.POST(get(), context)]) assert.equal(response.status, 401);
  assert.equal(saved, null);
});

test('membership revocation before the transaction prevents persistence', async () => {
  revoked = true;
  assert.equal((await route.PATCH(request(defaultOrgAppearance()), context)).status, 403);
  assert.equal(saved, null);
});

test('foreign, draft, excluded, and withdrawn project selections fail the current-eligibility lookup', async () => {
  const appearance = { ...defaultOrgAppearance(), cover: { kind: 'project', imageId } };
  selected = false;
  assert.equal((await route.PATCH(request(appearance), context)).status, 400);
  assert.equal(saved, null);
  selected = true;
  assert.equal((await route.PATCH(request(appearance), context)).status, 200);
});

test('strict validation rejects injected colors, unsupported keys, duplicate or excess facts and oversized copy', async () => {
  const base = defaultOrgAppearance();
  for (const value of [
    { ...base, backgroundColor: 'url(secret)' }, { ...base, introduction: 'x'.repeat(361) },
    { ...base, coverPosition: { x: 101, y: 0 } }, { ...base, version: 2 },
    { ...base, facts: [{ key: 'password', value: 'x' }] },
    { ...base, facts: [{ key: 'years', value: '1' }, { key: 'years', value: '2' }] },
    { ...base, facts: ['years', 'completed', 'location', 'awards', 'press'].map(key => ({ key, value: '1' })) },
    { ...base, identity: { mode: 'logo', url: 'javascript:alert(1)' } }, { ...base, extra: 'not allowed' },
  ]) { assert.equal(orgProfileAppearanceSchema.safeParse(value).success, false); assert.equal((await route.PATCH(request(value), context)).status, 400); }
  const bad = new NextRequest('http://folio.test/api/appearance', { method: 'PATCH', body: '{broken' });
  assert.equal((await route.PATCH(bad, context)).status, 400);
  assert.equal(saved, null);
});

test('only own organization uploads are accepted, never detached/private/foreign URLs', async () => {
  const base = defaultOrgAppearance();
  const filename = '68d52387-dc47-4b88-a774-82cb9eea22b5.png';
  for (const url of ['https://external.test/photo.png', `https://storage.test/storage/v1/object/public/user-avatars/org-profile/foreign/${filename}`, `https://storage.test/storage/v1/object/public/project-photos/${filename}`]) {
    assert.equal((await route.PATCH(request({ ...base, cover: { kind: 'upload', url } }), context)).status, 400);
    assert.equal((await route.PATCH(request({ ...base, identity: { mode: 'portrait', url } }), context)).status, 400);
  }
  const url = `https://storage.test/storage/v1/object/public/user-avatars/org-profile/${orgId}/${filename}`;
  assert.equal((await route.PATCH(request({ ...base, cover: { kind: 'upload', url } }), context)).status, 200);
});

async function imageRequest(bytes, type = 'image/png') {
  const body = new FormData(); body.append('file', new Blob([bytes], { type }), 'upload.png');
  return new NextRequest('http://folio.test/api/appearance/image', { method: 'POST', body });
}
test('real PNG decoding strips metadata; upload prepares an immutable asset without changing saved appearance', async () => {
  const input = await sharp({ create: { width: 10, height: 10, channels: 4, background: '#bada55' } }).png().withMetadata().toBuffer();
  const response = await uploadRoute.POST(await imageRequest(input), context);
  assert.equal(response.status, 200);
  assert.match((await response.json()).url, new RegExp(`org-profile/${orgId}/.+\\.png$`));
  assert.equal(uploads.length, 1); assert.equal(uploads[0].options.upsert, false);
  const metadata = await sharp(uploads[0].bytes).metadata();
  assert.equal(metadata.exif, undefined); assert.equal(metadata.icc, undefined);
  assert.equal(saved, null); assert.deepEqual(removals, []);
});

test('bad image bytes, deceptive MIME, excessive bytes, and failed uploads preserve saved images', async () => {
  assert.equal((await uploadRoute.POST(await imageRequest(Buffer.from('not an image')), context)).status, 400);
  assert.equal((await uploadRoute.POST(await imageRequest(Buffer.from('<svg/>'), 'image/svg+xml'), context)).status, 400);
  assert.equal((await uploadRoute.POST(await imageRequest(Buffer.alloc(5 * 1024 * 1024 + 1)), context)).status, 413);
  assert.equal(uploads.length, 0);
  uploadFailure = true;
  const input = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } }).png().toBuffer();
  assert.equal((await uploadRoute.POST(await imageRequest(input), context)).status, 500);
  assert.deepEqual(removals, []); assert.equal(saved, null);
});

test('permission lost during upload removes only the newly uploaded asset', async () => {
  revoked = true;
  const input = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } }).png().toBuffer();
  assert.equal((await uploadRoute.POST(await imageRequest(input), context)).status, 403);
  assert.deepEqual(removals, [uploads[0].path]); assert.equal(saved, null);
});

test('anonymous feed uses exact firm/public/photo filters and never returns private metadata', async () => {
  session = null;
  db.project.findMany = async query => {
    assert.deepEqual(query.where, { designerOrgId: orgId, isPublic: true });
    assert.deepEqual(query.select.images.where, { inclusion: 'INCLUDED' });
    assert.equal(query.select.description, undefined); assert.equal(query.select.images.select.aiAnalysis, undefined);
    return [{ id: 'project', title: 'Public project', city: 'Miami', regionState: 'FL', images: [{ url: '/public.jpg' }],
      post: { status: 'PUBLISHED' }, _count: { rooms: 2 }, saves: 0, privateNote: 'never expose' }];
  };
  for (const model of ['orgMedia', 'orgRecognition', 'orgCollaboration']) db[model].findMany = async query => {
    assert.deepEqual(query.where, { organizationId: orgId, publishedAt: { not: null } });
    assert.ok(query.select); return [];
  };
  const response = await feed.GET(new NextRequest('http://folio.test/api/feed'), context);
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
  const data = await response.json(); assert.equal(data.items[0].data.title, 'Public project');
  assert.equal(JSON.stringify(data).includes('never expose'), false);
});

test('suggestions never invent lifetime totals and Folio count remains live', () => {
  assert.deepEqual(profileFacts(defaultOrgAppearance(), org, 0, 2026), []);
  const facts = profileFacts({ ...defaultOrgAppearance(), facts: [{ key: 'folio', value: '999' }] }, org, 4, 2026);
  assert.equal(facts[0].value, '4');
  assert.equal(profilePageStyle('#111111')['--org-page-ink'], '#ffffff');
  assert.equal(profilePageStyle('#ffffff')['--org-page-ink'], '#000000');
  assert.deepEqual(profilePageStyle(null), {});
});

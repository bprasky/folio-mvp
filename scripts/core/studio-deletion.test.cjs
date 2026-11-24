// Real Prisma transactions/cascades against an explicitly disposable PostgreSQL
// database. Auth and Next's cache are the only replaced application boundaries.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { disposableTarget, factories } = require('./fixtures.cjs');
const target = disposableTarget();
if (!target) throw Error('Studio deletion requires CORE_TEST_DATABASE_URL and CORE_TEST_DATABASE_DISPOSABLE=1');
process.env.DATABASE_URL = target;
process.env.DIRECT_URL = target;
const { PrismaClient } = require('@prisma/client');
const { NextRequest } = require('next/server');
const db = new PrismaClient(), f = factories(db);
let session = null, failCache = false;
function replace(name, exports) {
  const id = require.resolve(name.startsWith('src/') ? resolve(name) : name);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
replace('server-only', {});
replace('src/lib/prisma.ts', { prisma: db });
replace('src/app/api/auth/[...nextauth]/options.ts', { authOptions: {} });
replace('next-auth', { getServerSession: async () => session });
replace('next/cache', { revalidatePath: () => { if (failCache) throw Error('Fixture cache outage'); } });
const route = require(resolve('src/app/api/orgs/[orgId]/deletion/route.ts'));
const { deleteStudio, reviewStudioDeletion } = require(resolve('src/lib/server/studio-deletion.ts'));
const { WORKSPACE_IMPORT_KIND } = require(resolve('src/lib/workspace-import/types.ts'));
const { can } = require(resolve('src/lib/orgPermissions.ts'));
const { saveImport } = require(resolve('src/lib/workspace-import/store.ts'));
const { createProjectOnce } = require(resolve('src/lib/projects/createProject.ts'));
let fetchImportPhoto, importUploads = 0;
replace('src/lib/server/project-image-input.ts', { fetchProjectImage: (...args) => fetchImportPhoto(...args) });
replace('src/lib/storage.ts', { saveBufferToProjectStorage: async () => { importUploads++; throw Error('Unexpected upload after cancellation'); } });
replace('src/lib/email/sendEmail.ts', { sendEmail: async () => { throw Error('Unexpected import email'); } });
const { advanceImport } = require(resolve('src/lib/workspace-import/processor.ts'));
const context = id => ({ params: { orgId: id } });
const get = id => new NextRequest(`https://folio.test/api/orgs/${id}/deletion`);
const del = (id, body, headers = {}) => new NextRequest(`https://folio.test/api/orgs/${id}/deletion`, {
  method: 'DELETE', headers: { origin: 'https://folio.test', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const confirm = review => ({ confirmation: review.name, version: review.version, acknowledged: true });
async function expect(response, status) { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; }
async function fixture(role = 'ADMIN', orgOverrides = {}) {
  const actor = await f.user(), org = await f.organization(orgOverrides);
  const member = await f.membership(actor.id, org.id, { role });
  session = { user: { id: actor.id, role: actor.role } };
  return { actor, org, member };
}
after(async () => { await db.$disconnect(); });

test('only active studio owners/admins with an approved account can review or delete', async () => {
  const { actor, org, member } = await fixture();
  session = null;
  await expect(await route.GET(get(org.id), context(org.id)), 401);
  await expect(await route.DELETE(del(org.id, {}), context(org.id)), 401);
  session = { user: { id: actor.id, role: 'ADMIN' } };
  const review = await expect(await route.GET(get(org.id), context(org.id)), 200);
  for (const role of ['MANAGER', 'MEMBER', 'VIEWER']) {
    assert.equal(can(role, 'delete_studio'), false);
    await db.organizationUser.update({ where: { id: member.id }, data: { role } });
    await expect(await route.GET(get(org.id), context(org.id)), 403);
    await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 403);
  }
  await db.organizationUser.update({ where: { id: member.id }, data: { role: 'ADMIN', isActive: false } });
  await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 403);
  const outsider = await f.user({ role: 'ADMIN' });
  session = { user: { id: outsider.id, role: 'ADMIN' } };
  await expect(await route.GET(get(org.id), context(org.id)), 403);
  await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 403);
  session = { user: { id: actor.id } };
  await db.organizationUser.update({ where: { id: member.id }, data: { isActive: true } });
  await db.user.update({ where: { id: actor.id }, data: { accountStatus: 'PENDING' } });
  await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 403);
  assert.ok(await db.organization.findUnique({ where: { id: org.id } }));
});

test('review is private, requires claimed studio; origin, name, acknowledgment and version are mandatory', async () => {
  const { actor, org } = await fixture('OWNER');
  const response = await route.GET(get(org.id), context(org.id));
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const review = await expect(response, 200), good = confirm(review);
  for (const input of [{}, { ...good, acknowledged: false }, { ...good, confirmation: 'Wrong studio' }, { ...good, unexpected: true }])
    await expect(await route.DELETE(del(org.id, input), context(org.id)), 400);
  await expect(await route.DELETE(del(org.id, good, { origin: 'https://attacker.test' }), context(org.id)), 403);
  await expect(await route.DELETE(del(org.id, good, { 'sec-fetch-site': 'cross-site' }), context(org.id)), 403);
  await expect(await route.DELETE(del(org.id, good, { 'content-type': 'text/plain' }), context(org.id)), 400);
  await expect(await route.DELETE(del(org.id, { ...good, confirmation: 'x'.repeat(5000) }), context(org.id)), 413);
  await db.organization.update({ where: { id: org.id }, data: { name: 'Renamed studio' } });
  await expect(await route.DELETE(del(org.id, { ...good, confirmation: 'Renamed studio' }), context(org.id)), 409);
  assert.ok(await db.organization.findUnique({ where: { id: org.id } }));
  await db.organization.update({ where: { id: org.id }, data: { status: 'UNCLAIMED' } });
  await expect(await route.GET(get(org.id), context(org.id)), 403);
  await db.organization.update({ where: { id: org.id }, data: { status: 'CLAIMED', type: 'VENDOR' } });
  await expect(await route.GET(get(org.id), context(org.id)), 400);
});

test('running imports can be cancelled by deletion while billing records remain protected', async () => {
  const { actor, org } = await fixture();
  const run = await db.importSession.create({ data: { userId: actor.id, sourceType: 'WEBSITE', status: 'PROCESSING',
    processingMeta: { kind: WORKSPACE_IMPORT_KIND, orgId: org.id } } });
  let review = await reviewStudioDeletion(actor.id, org.id);
  assert.deepEqual(review.blockers, []);
  assert.equal(review.counts.activeImports, 1);
  await db.vendorSubscription.create({ data: { organizationId: org.id, stripeSubscriptionId: `fixture-${org.id}` } });
  review = await reviewStudioDeletion(actor.id, org.id);
  assert.match(review.blockers.join(' '), /Billing/);
  await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 409);
  assert.ok(await db.organization.findUnique({ where: { id: org.id } }));
  assert.equal((await db.importSession.findUnique({ where: { id: run.id } })).status, 'PROCESSING');
});

test('confirmation stops imports and removes drafts added since review, without affecting another studio', async () => {
  const { actor, org } = await fixture();
  const other = await f.organization();
  const otherRun = await db.importSession.create({ data: { userId: actor.id, sourceType: 'WEBSITE', status: 'PROCESSING',
    processingMeta: { kind: WORKSPACE_IMPORT_KIND, orgId: other.id } } });
  const run = await db.importSession.create({ data: { userId: actor.id, sourceType: 'WEBSITE', status: 'PROCESSING',
    processingMeta: { kind: WORKSPACE_IMPORT_KIND, orgId: org.id, phase: 'projects' } } });
  const readyNotice = await db.notification.create({ data: { userId: actor.id, type: 'WORKSPACE_IMPORT_READY', title: 'Ready', body: 'Fixture',
    metadata: { importId: run.id, orgId: org.id } } });
  const otherNotice = await db.notification.create({ data: { userId: actor.id, type: 'WORKSPACE_IMPORT_READY', title: 'Other studio ready', body: 'Fixture',
    metadata: { importId: otherRun.id, orgId: other.id } } });
  const review = await reviewStudioDeletion(actor.id, org.id);
  const project = await f.project(actor.id, { designerOrgId: org.id });
  const projectRun = await db.importSession.create({ data: { userId: actor.id, projectId: project.id, sourceType: 'WEBSITE', status: 'PROCESSING' } });
  await db.importSession.update({ where: { id: run.id }, data: { processingMeta: { kind: WORKSPACE_IMPORT_KIND, orgId: org.id, phase: 'notify' } } });
  const fresh = await reviewStudioDeletion(actor.id, org.id);
  assert.equal(fresh.version, review.version, 'background progress must not force endless review retries');
  assert.equal(fresh.counts.activeImports, 2);
  await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 200);
  for (const id of [run.id, projectRun.id]) assert.equal(await db.importSession.findUnique({ where: { id } }), null);
  assert.equal(await db.project.findUnique({ where: { id: project.id } }), null);
  assert.equal(await db.notification.findUnique({ where: { id: readyNotice.id } }), null);
  assert.ok(await db.importSession.findUnique({ where: { id: otherRun.id } }));
  assert.ok(await db.notification.findUnique({ where: { id: otherNotice.id } }));
  assert.ok(await db.user.findUnique({ where: { id: actor.id } }));
  await assert.rejects(createProjectOnce(actor.id, org.id, 'late-import', { title: 'Late draft', projectStatus: 'new_project' }), { code: 'P2003' });
  const replay = await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 200);
  assert.equal(replay.replayed, true);
});

test('a leased worker finishing a photo fetch after deletion stops without saving or resurrecting its run', async () => {
  const { actor, org } = await fixture();
  const project = await f.project(actor.id, { designerOrgId: org.id });
  const run = { kind: WORKSPACE_IMPORT_KIND, orgId: org.id, orgName: org.name, sections: ['projects'], phase: 'projects',
    pages: [], profile: {}, notices: [], notification: { status: 'pending', attempts: 0 },
    lease: { token: 'in-flight', until: new Date(Date.now() + 360000).toISOString() },
    projects: [{ url: 'https://studio.test/project', title: 'Draft', projectId: project.id, status: 'photos', attempts: 0,
      photos: [{ url: 'https://studio.test/photo.png', alt: 'Photo', status: 'pending', attempts: 0 }] }] };
  const row = await db.importSession.create({ data: { userId: actor.id, sourceType: 'WEBSITE', status: 'PROCESSING', processingMeta: run } });
  let started, release;
  const entered = new Promise(resolve => { started = resolve; }), gate = new Promise(resolve => { release = resolve; });
  fetchImportPhoto = async () => { started(); await gate; return { buffer: Buffer.from('fixture'), mime: 'image/png' }; };
  importUploads = 0;
  const worker = advanceImport(actor.id, row.id, structuredClone(run));
  const stopped = assert.rejects(worker, /Active business access/);
  await entered;
  try {
    const review = await reviewStudioDeletion(actor.id, org.id);
    await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 200);
  } finally { release(); }
  await stopped;
  await assert.rejects(saveImport(row.id, row.processingMeta, run), /import changed/);
  assert.equal(importUploads, 0);
  assert.equal(await db.importSession.findUnique({ where: { id: row.id } }), null);
  assert.equal(await db.project.findUnique({ where: { id: project.id } }), null);
  assert.equal(await db.projectImage.count({ where: { projectId: project.id } }), 0);
});

// Hide feature tables without dropping their data or FK constraints. Every test
// restores the catalog even if an assertion fails; this database is disposable.
async function withoutTables(tables, run) {
  const hidden = [];
  try {
    for (const table of tables) {
      await db.$executeRawUnsafe(`ALTER TABLE public.${table} RENAME TO studio_delete_test_${table}`);
      hidden.push(table);
    }
    return await run();
  } finally {
    for (const table of hidden.reverse())
      await db.$executeRawUnsafe(`ALTER TABLE public.studio_delete_test_${table} RENAME TO ${table}`);
  }
}

test('unprovisioned subscriptions do not abort review or deletion; receipt retries still work', async () => {
  const { actor, org } = await fixture('OWNER');
  const project = await f.project(actor.id, { designerOrgId: org.id });
  await withoutTables(['vendor_subscriptions'], async () => {
    const review = await expect(await route.GET(get(org.id), context(org.id)), 200);
    assert.deepEqual(review.blockers, []);
    const deleted = await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 200);
    assert.equal(deleted.deleted, true);
    assert.equal(await db.organization.findUnique({ where: { id: org.id } }), null);
    assert.equal(await db.project.findUnique({ where: { id: project.id } }), null);
    assert.ok(await db.user.findUnique({ where: { id: actor.id } }));
    const replay = await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 200);
    assert.equal(replay.replayed, true);
    assert.equal(await db.notification.count({ where: { userId: actor.id, type: 'STUDIO_DELETED' } }), 1);
  });
});

const optionalFeatureTables = [
  ['orders'], ['vendor_subscriptions'], ['boosts'], ['boosts', 'boost_opportunities'],
  ['in_context_boosts'], ['homepage_reel_boosts'], ['developments'],
  ['vendor_product_claims'], ['collaboration_stories'], ['org_territory_assignments'],
];

test('optional features can be absent separately or together through review and confirmed deletion', async t => {
  for (const tables of [...optionalFeatureTables, [...new Set(optionalFeatureTables.flat())]]) {
    await t.test(tables.join(', '), async () => {
      const { actor, org } = await fixture();
      const project = await f.project(actor.id, { designerOrgId: org.id });
      await withoutTables(tables, async () => {
        const review = await expect(await route.GET(get(org.id), context(org.id)), 200);
        assert.deepEqual(review.blockers, []);
        await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 200);
        assert.equal(await db.organization.findUnique({ where: { id: org.id } }), null);
        assert.equal(await db.project.findUnique({ where: { id: project.id } }), null);
        assert.ok(await db.user.findUnique({ where: { id: actor.id } }));
      });
    });
  }
});

test('provisioning any optional feature after review requires a fresh confirmation', async t => {
  for (const tables of optionalFeatureTables) {
    await t.test(tables.join(', '), async () => {
      const { org } = await fixture();
      const review = await withoutTables(tables, () => reviewStudioDeletion(session.user.id, org.id));
      await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 409);
      assert.ok(await db.organization.findUnique({ where: { id: org.id } }));
    });
  }
});

test('absent optional tables do not disable billing protection in tables that exist', async () => {
  const { actor, org } = await fixture();
  const subscription = await db.vendorSubscription.create({ data: { organizationId: org.id, stripeSubscriptionId: `fixture-${org.id}` } });
  await withoutTables(['orders', 'collaboration_stories', 'developments'], async () => {
    const review = await reviewStudioDeletion(actor.id, org.id);
    assert.match(review.blockers.join(' '), /Billing/);
    await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 409);
    assert.ok(await db.vendorSubscription.findUnique({ where: { id: subscription.id } }));
  });
  const order = await db.order.create({ data: { purchaserUserId: actor.id, vendorOrgId: org.id,
    retailAmountCents: 100, tradeAmountCents: 80, marginAmountCents: 20,
    folioAmountCents: 20, cashPaidCents: 100, fulfillmentMethod: 'QUOTE' } });
  await withoutTables(['vendor_subscriptions'], async () => {
    const review = await reviewStudioDeletion(actor.id, org.id);
    assert.match(review.blockers.join(' '), /Billing/);
    await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 409);
    assert.ok(await db.order.findUnique({ where: { id: order.id } }));
  });
  assert.ok(await db.organization.findUnique({ where: { id: org.id } }));
});

test('partially provisioned promotions and missing core tables still prevent deletion', async () => {
  const { actor, org } = await fixture();
  await f.project(actor.id, { designerOrgId: org.id });
  const review = await reviewStudioDeletion(actor.id, org.id);
  for (const table of ['boost_opportunities', 'editorial_stories']) {
    await withoutTables([table], async () => {
      await expect(await route.GET(get(org.id), context(org.id)), 500);
      await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 500);
      assert.ok(await db.organization.findUnique({ where: { id: org.id } }));
      assert.equal(await db.notification.count({ where: { userId: actor.id, type: 'STUDIO_DELETED' } }), 0);
    });
  }
});

test('commerce becoming available invalidates the review; existing studio and project orders remain protected', async () => {
  const { actor, org } = await fixture('OWNER');
  const project = await f.project(actor.id, { designerOrgId: org.id });
  let review;
  await db.$executeRawUnsafe('ALTER TABLE public.orders RENAME TO studio_delete_test_orders');
  try { review = await expect(await route.GET(get(org.id), context(org.id)), 200); }
  finally { await db.$executeRawUnsafe('ALTER TABLE public.studio_delete_test_orders RENAME TO orders'); }
  await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 409);
  for (const relation of [{ vendorOrgId: org.id }, { projectId: project.id }]) {
    const order = await db.order.create({ data: { purchaserUserId: actor.id, ...relation,
      retailAmountCents: 100, tradeAmountCents: 80, marginAmountCents: 20,
      folioAmountCents: 20, cashPaidCents: 100, fulfillmentMethod: 'QUOTE' } });
    try {
      review = await expect(await route.GET(get(org.id), context(org.id)), 200);
      assert.match(review.blockers.join(' '), /Billing, order/);
      await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 409);
      assert.ok(await db.order.findUnique({ where: { id: order.id } }));
      assert.ok(await db.organization.findUnique({ where: { id: org.id } }));
      assert.ok(await db.project.findUnique({ where: { id: project.id } }));
    } finally { await db.order.delete({ where: { id: order.id } }); }
  }
});

test('an incompatible orders table fails closed and a review error never implies deletion was attempted', async () => {
  const { actor, org } = await fixture('OWNER');
  const review = await reviewStudioDeletion(actor.id, org.id);
  await db.$executeRawUnsafe('ALTER TABLE public.orders RENAME COLUMN "vendorOrgId" TO "studioDeleteTestVendorId"');
  try {
    const failed = await expect(await route.GET(get(org.id), context(org.id)), 500);
    assert.match(failed.error, /could not load the deletion review\. Nothing was deleted/);
    assert.doesNotMatch(failed.error, /confirm deletion|check its result/);
    await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 500);
    assert.ok(await db.organization.findUnique({ where: { id: org.id } }));
    assert.equal(await db.notification.count({ where: { userId: actor.id, type: 'STUDIO_DELETED' } }), 0);
  } finally { await db.$executeRawUnsafe('ALTER TABLE public.orders RENAME COLUMN "studioDeleteTestVendorId" TO "vendorOrgId"'); }
});

test('an incompatible subscriptions table cannot be treated as an absent optional feature', async () => {
  const { actor, org } = await fixture();
  const review = await reviewStudioDeletion(actor.id, org.id);
  await db.$executeRawUnsafe('ALTER TABLE public.vendor_subscriptions RENAME COLUMN "stripeSubscriptionId" TO "studioDeleteTestSubscriptionId"');
  try {
    await expect(await route.GET(get(org.id), context(org.id)), 500);
    await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 500);
    assert.ok(await db.organization.findUnique({ where: { id: org.id } }));
    assert.equal(await db.notification.count({ where: { userId: actor.id, type: 'STUDIO_DELETED' } }), 0);
  } finally {
    await db.$executeRawUnsafe('ALTER TABLE public.vendor_subscriptions RENAME COLUMN "studioDeleteTestSubscriptionId" TO "stripeSubscriptionId"');
  }
});

test('both owner and admin can delete; all personal accounts, personal projects and credited external projects survive', async () => {
  for (const role of ['OWNER', 'ADMIN']) {
    const { actor, org } = await fixture(role);
    const otherUser = await f.user(), otherOrg = await f.organization();
    await f.membership(otherUser.id, org.id, { role: 'MEMBER' });
    await f.membership(actor.id, otherOrg.id, { role: 'MEMBER' });
    await db.user.update({ where: { id: actor.id }, data: { operatingAsOrgId: org.id } });
    const owned = await f.project(otherUser.id, { designerOrgId: org.id, isPublic: true });
    const external = await f.project(actor.id, { designerOrgId: otherOrg.id, vendorOrgId: org.id });
    const personal = await f.project(actor.id);
    const image = await f.image(owned.id);
    const post = await db.projectPost.create({ data: { projectId: owned.id, slug: `fixture-${owned.id}` } });
    await db.projectParticipant.create({ data: { projectId: external.id, orgId: org.id, role: 'VIEWER', side: 'DESIGNER' } });
    const run = await db.importSession.create({ data: { userId: actor.id, sourceType: 'WEBSITE', status: 'COMPLETED', processingMeta: { kind: WORKSPACE_IMPORT_KIND, orgId: org.id } } });
    const retainedRun = await db.importSession.create({ data: { userId: actor.id, sourceType: 'WEBSITE', status: 'COMPLETED', processingMeta: { kind: WORKSPACE_IMPORT_KIND, orgId: otherOrg.id } } });
    await db.studioCandidate.create({ data: { id: `fixture-${org.id}`, designerId: actor.id, organizationId: org.id, projectIds: [owned.id], currentVersion: 1, state: 'draft' } });
    const review = await reviewStudioDeletion(actor.id, org.id);
    assert.deepEqual(review.counts, { projects: 1, publishedProjects: 1, members: 2, profileItems: 0, activeImports: 0 });
    assert.deepEqual(review.blockers, []);
    failCache = true; // A post-commit cache error must not report a failed delete.
    const deleted = await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 200);
    failCache = false;
    assert.equal(deleted.deleted, true);
    for (const [model, id] of [['organization', org.id], ['project', owned.id], ['projectImage', image.id], ['projectPost', post.id], ['importSession', run.id]])
      assert.equal(await db[model].findUnique({ where: { id } }), null, model);
    assert.equal(await db.organizationUser.count({ where: { organizationId: org.id } }), 0);
    assert.equal(await db.studioCandidate.count({ where: { organizationId: org.id } }), 0);
    assert.equal((await db.user.findUnique({ where: { id: actor.id } })).operatingAsOrgId, null);
    assert.ok(await db.user.findUnique({ where: { id: otherUser.id } }));
    for (const [model, id] of [['organization', otherOrg.id], ['project', external.id], ['project', personal.id], ['importSession', retainedRun.id]])
      assert.ok(await db[model].findUnique({ where: { id } }), model);
    assert.equal((await db.project.findUnique({ where: { id: external.id } })).vendorOrgId, null);
    const replay = await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 200);
    assert.equal(replay.replayed, true);
    assert.equal(await db.notification.count({ where: { userId: actor.id, type: 'STUDIO_DELETED' } }), 1);
  }
});

test('scheduled Spotlight history, Publishing Studio stories and active interviews remain protected', async () => {
  const { actor, org } = await fixture();
  const project = await f.project(actor.id, { designerOrgId: org.id });
  const product = await f.product();
  const spotlight = await db.productSpotlight.create({ data: { projectId: project.id, productId: product.id, publisherOrgId: org.id, selectedById: actor.id } });
  await db.spotlightQuestion.create({ data: { spotlightId: spotlight.id, kind: 'initial', questionVersion: 1, meaningKey: 'fixture', contextSnapshot: {}, wording: 'Why this material?', promptVersion: 'fixture', policyVersion: 'fixture' } });
  await db.editorialStory.create({ data: { ownerId: actor.id, organizationId: org.id, slug: `fixture-${org.id}`, format: 'expertise' } });
  await db.liveInterviewSession.create({ data: { id: `fixture-${org.id}`, actorId: actor.id, sourceType: 'project', sourceId: project.id, canonicalId: project.id, status: 'active', credentialHash: org.id, expiresAt: new Date(Date.now() + 60000) } });
  const review = await reviewStudioDeletion(actor.id, org.id);
  assert.match(review.blockers.join(' '), /Spotlight/);
  assert.match(review.blockers.join(' '), /Publishing Studio/);
  assert.match(review.blockers.join(' '), /interview/);
  await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 409);
  assert.ok(await db.project.findUnique({ where: { id: project.id } }));
});

test('an unknown restrictive dependency rolls back every deletion and workspace change', async () => {
  const { actor, org } = await fixture();
  const project = await f.project(actor.id, { designerOrgId: org.id });
  const run = await db.importSession.create({ data: { userId: actor.id, sourceType: 'WEBSITE', status: 'PROCESSING', processingMeta: { kind: WORKSPACE_IMPORT_KIND, orgId: org.id } } });
  const notice = await db.notification.create({ data: { userId: actor.id, type: 'WORKSPACE_IMPORT_READY', title: 'Ready', body: 'Fixture', metadata: { importId: run.id } } });
  await db.user.update({ where: { id: actor.id }, data: { operatingAsOrgId: org.id } });
  await db.$executeRawUnsafe('CREATE TABLE studio_delete_test_restrict (id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE RESTRICT)');
  try {
    await db.$executeRaw`INSERT INTO studio_delete_test_restrict (id) VALUES (${org.id})`;
    const review = await reviewStudioDeletion(actor.id, org.id);
    await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 409);
    assert.ok(await db.organization.findUnique({ where: { id: org.id } }));
    assert.ok(await db.project.findUnique({ where: { id: project.id } }));
    assert.equal((await db.importSession.findUnique({ where: { id: run.id } })).status, 'PROCESSING');
    assert.ok(await db.notification.findUnique({ where: { id: notice.id } }));
    assert.equal((await db.user.findUnique({ where: { id: actor.id } })).operatingAsOrgId, org.id);
    assert.equal(await db.notification.count({ where: { userId: actor.id, type: 'STUDIO_DELETED' } }), 0);
  } finally { await db.$executeRawUnsafe('DROP TABLE studio_delete_test_restrict'); }
});

test('photo promotions and homepage bids cannot be erased by studio project cascades', async () => {
  const { actor, org } = await fixture();
  const project = await f.project(actor.id, { designerOrgId: org.id }), image = await f.image(project.id), product = await f.product();
  const vendor = await f.organization({ type: 'VENDOR' });
  const tag = await db.productTag.create({ data: { imageId: image.id, productId: product.id, x: 20, y: 30 } });
  const photoBoost = await db.inContextBoost.create({ data: { productTagId: tag.id, productId: product.id, designerId: actor.id, vendorId: vendor.id, status: 'APPROVED', vendorSpendCents: 500 } });
  let review = await reviewStudioDeletion(actor.id, org.id);
  assert.match(review.blockers.join(' '), /promotion/);
  await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 409);
  assert.ok(await db.inContextBoost.findUnique({ where: { id: photoBoost.id } }));
  await db.inContextBoost.delete({ where: { id: photoBoost.id } });
  const post = await db.projectPost.create({ data: { projectId: project.id, slug: `reel-${org.id}` } });
  const reel = await db.homepageReelBoost.create({ data: { projectPostId: post.id, productId: product.id, vendorId: vendor.id, bidCents: 500, startsAt: new Date(), endsAt: new Date(Date.now() + 60000) } });
  review = await reviewStudioDeletion(actor.id, org.id);
  assert.match(review.blockers.join(' '), /promotion/);
  await expect(await route.DELETE(del(org.id, confirm(review)), context(org.id)), 409);
  assert.ok(await db.homepageReelBoost.findUnique({ where: { id: reel.id } }));
});

test('a photo promotion starting below the project FK is protected from a concurrent studio deletion', async () => {
  const { actor, org } = await fixture();
  const project = await f.project(actor.id, { designerOrgId: org.id }), image = await f.image(project.id), product = await f.product();
  const tag = await db.productTag.create({ data: { imageId: image.id, productId: product.id, x: 20, y: 30 } });
  const review = await reviewStudioDeletion(actor.id, org.id);
  let locked, release;
  const acquired = new Promise(resolve => { locked = resolve; }), gate = new Promise(resolve => { release = resolve; });
  const promoting = db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM product_tags WHERE id = ${tag.id} FOR KEY SHARE`;
    locked(); await gate;
    await tx.inContextBoost.create({ data: { productTagId: tag.id, productId: product.id, designerId: actor.id, status: 'APPROVED', vendorSpendCents: 500 } });
  }, { timeout: 15000 });
  await acquired;
  const deleting = deleteStudio(actor.id, org.id, confirm(review));
  const deadline = Date.now() + 5000;
  let blocked = false;
  while (!blocked && Date.now() < deadline) {
    const rows = await db.$queryRaw`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FROM product_tags%FOR UPDATE%') AS blocked`;
    blocked = rows[0].blocked;
    if (!blocked) await new Promise(resolve => setTimeout(resolve, 20));
  }
  release(); await promoting;
  await assert.rejects(deleting, /changed|promotion/);
  assert.ok(blocked, 'deletion actually waited for the promotion to finish');
  assert.ok(await db.project.findUnique({ where: { id: project.id } }));
  assert.equal(await db.inContextBoost.count({ where: { productTagId: tag.id } }), 1);
});

test('simultaneous confirmations produce one deletion receipt and both callers can recover', async () => {
  const { actor, org } = await fixture();
  await f.project(actor.id, { designerOrgId: org.id });
  const review = await reviewStudioDeletion(actor.id, org.id);
  const results = await Promise.all([deleteStudio(actor.id, org.id, confirm(review)), deleteStudio(actor.id, org.id, confirm(review))]);
  assert.ok(results.every(result => result.deleted));
  assert.equal(results.filter(result => result.replayed).length, 1);
  assert.equal(await db.notification.count({ where: { userId: actor.id, type: 'STUDIO_DELETED' } }), 1);
});

test('an import committed while deletion waits on the studio lock is cancelled by that deletion', async () => {
  const { actor, org } = await fixture();
  const review = await reviewStudioDeletion(actor.id, org.id);
  let locked, release;
  const acquired = new Promise(resolve => { locked = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const importing = db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${org.id} FOR KEY SHARE`;
    locked(); await gate;
    await tx.importSession.create({ data: { userId: actor.id, sourceType: 'WEBSITE', status: 'PROCESSING', processingMeta: { kind: WORKSPACE_IMPORT_KIND, orgId: org.id } } });
  }, { timeout: 15000 });
  await acquired;
  const deleting = deleteStudio(actor.id, org.id, confirm(review));
  const deadline = Date.now() + 5000;
  let blocked = false;
  while (!blocked && Date.now() < deadline) {
    const rows = await db.$queryRaw`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FROM organizations%FOR UPDATE%') AS blocked`;
    blocked = rows[0].blocked;
    if (!blocked) await new Promise(resolve => setTimeout(resolve, 20));
  }
  release(); await importing;
  assert.equal((await deleting).deleted, true);
  assert.ok(blocked, 'deletion actually waited on the in-flight import parent lock');
  assert.equal(await db.organization.findUnique({ where: { id: org.id } }), null);
  assert.equal(await db.importSession.count({ where: { processingMeta: { path: ['orgId'], equals: org.id } } }), 0);
});

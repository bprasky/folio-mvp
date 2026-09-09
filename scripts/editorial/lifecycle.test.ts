import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'dotenv';
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Never inherit DATABASE_URL (which may be production). An integration target
// must be explicit, disposable, and different from either configured app DB.
const target = process.env.EDITORIAL_TEST_DATABASE_URL;
if (target) {
  assert.equal(process.env.EDITORIAL_TEST_DATABASE_DISPOSABLE, '1', 'Explicit disposable test database acknowledgement required');
  const identity = (url: string) => { const u = new URL(url); return u.hostname + ':' + u.port + u.pathname; };
  for (const file of ['.env', '.env.local']) {
    if (existsSync(file)) {
      const app = parse(readFileSync(file)).DATABASE_URL;
      if (app) assert.notEqual(identity(target), identity(app), 'Refusing tests against configured app database');
    }
  }
}
process.env.DATABASE_URL = target || 'postgresql://disabled:disabled@127.0.0.1:1/editorial_disabled?connect_timeout=1';
process.env.POSTING_V1 = 'true';

const require = createRequire(resolve('scripts/editorial/lifecycle.test.ts'));
let session: { user: { id: string; role: string } } | null = null;
function replace(name: string, exports: unknown) {
  const filename = require.resolve(name);
  require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module;
}
// Only session acquisition and external side effects are substituted. Prisma,
// project authz, transactions, lifecycle code and public reader are all real.
replace('next-auth', { getServerSession: async () => session });
replace('../../src/app/api/auth/[...nextauth]/options', { authOptions: {} });
replace('next/cache', { revalidatePath: () => {} });
replace('../../src/lib/email/notifyVendorTagged', { notifyTaggedVendors: async () => {} });
replace('../../src/lib/editorial-queue/unlock', { triggerQueueUnlockForProject: async () => {} });
replace('../../src/lib/notifications/notifyIncompleteProductVendors', { notifyIncompleteProductVendors: async () => {} });

const { checkTransition } = require('../../src/lib/editorial/lifecycle');
const init = require('../../src/app/api/posting/project/[projectId]/init/route');
const status = require('../../src/app/api/posting/project/[projectId]/status/route');
const reviewList = require('../../src/app/api/admin/editorial-review/route');
const actions = require('../../src/app/actions/projects');
const blocksRoute = require('../../src/app/api/posting/project/[projectId]/blocks/route');
const { prisma } = require('../../src/lib/prisma') as { prisma: PrismaClient };
const { getPostBySlug } = require('../../src/lib/post/getPostBySlug');
const req = (body?: unknown) => new NextRequest('https://folio.test/api/test', body === undefined ? {} : { method: 'PATCH', body: JSON.stringify(body) });
const context = (id: string) => ({ params: { projectId: id } });

test('anonymous initiation, submission and review list return 401 before DB access', async () => {
  session = null;
  assert.equal((await init.POST(req(), context('private'))).status, 401);
  assert.equal((await status.PATCH(req({ action: 'submit' }), context('private'))).status, 401);
  assert.equal((await reviewList.GET(req())).status, 401);
  assert.equal((await actions.publishEditorial({ projectId: 'private' })).statusCode, 401);
});

test('normal session cannot approve or reject; client identity fields are rejected', async () => {
  session = { user: { id: 'designer', role: 'DESIGNER' } };
  for (const action of ['approve', 'reject']) {
    assert.equal((await status.PATCH(req({ action, reason: 'Revise', expectedUpdatedAt: new Date().toISOString() }), context('private'))).status, 403);
  }
  assert.equal((await status.PATCH(req({ action: 'submit', reviewedBy: 'admin' }), context('private'))).status, 400);
  assert.equal((await reviewList.GET(req())).status, 403);
});

test('state transitions reuse PostStatus and cannot self-publish while in review', () => {
  for (const [from, action] of [['DRAFT', 'submit'], ['REVIEW', 'approve'], ['REVIEW', 'reject'], ['DRAFT', 'publish'], ['PUBLISHED', 'unpublish'], ['PUBLISHED', 'archive']]) {
    assert.equal(checkTransition(from, action, {}), true);
  }
  for (const [from, action] of [['REVIEW', 'publish'], ['REVIEW', 'archive'], ['PUBLISHED', 'submit'], ['DRAFT', 'approve'], ['ARCHIVED', 'publish'], ['ARCHIVED', 'reject']]) {
    assert.throws(() => checkTransition(from, action, {}), { status: 409 });
  }
  assert.equal(checkTransition('REVIEW', 'submit', {}), false);
  assert.equal(checkTransition('PUBLISHED', 'approve', { decision: 'approved' }), false);
  assert.equal(checkTransition('DRAFT', 'reject', { decision: 'rejected' }), false);
  assert.throws(() => checkTransition('PUBLISHED', 'approve', {}), { status: 409 });
});

test('database journey through real route handlers and public reader', { skip: !target && 'EDITORIAL_TEST_DATABASE_URL unavailable', timeout: 60000 }, async t => {
  const ownerId = randomUUID(), strangerId = randomUUID(), adminId = randomUUID();
  const projectId = randomUUID(), otherProjectId = randomUUID();
  let slug = '';
  const act = (action: string, extra: Record<string, unknown> = {}) => status.PATCH(req({ action, ...extra }), context(projectId));
  const current = () => prisma.projectPost.findUniqueOrThrow({ where: { projectId } });
  const asOwner = () => { session = { user: { id: ownerId, role: 'DESIGNER' } }; };
  const asAdmin = () => { session = { user: { id: adminId, role: 'ADMIN' } }; };
  try {
    for (const [id, role] of [[ownerId, 'DESIGNER'], [strangerId, 'DESIGNER'], [adminId, 'ADMIN']] as const) {
      await prisma.user.create({ data: { id, role, name: 'Editorial test', email: id + '@editorial.test', passwordHash: 'not-a-login', specialties: [], desiredRooms: [] } });
    }
    for (const id of [projectId, otherProjectId]) {
      await prisma.project.create({ data: { id, ownerId, designerId: ownerId, title: 'Editorial test' } });
    }
    const room = await prisma.room.create({ data: { projectId, name: 'Living room' } });
    const image = await prisma.projectImage.create({ data: { projectId, roomId: room.id, url: 'https://example.test/photo.jpg', noProducts: true } });
    const foreignImage = await prisma.projectImage.create({ data: { projectId: otherProjectId, url: 'https://example.test/foreign.jpg' } });

    await t.test('wrong designer cannot initiate or submit another project', async () => {
      session = { user: { id: strangerId, role: 'DESIGNER' } };
      assert.equal((await init.POST(req(), context(projectId))).status, 403);
      assert.equal((await act('submit')).status, 403);
      assert.equal((await blocksRoute.PATCH(req({}), context(projectId))).status, 403);
      assert.equal((await actions.publishEditorial({ projectId })).statusCode, 403);
    });
    await t.test('owner initialization is idempotent and writes one real post', async () => {
      asOwner();
      const responses = await Promise.all([init.POST(req(), context(projectId)), init.POST(req(), context(projectId))]);
      assert.deepEqual(responses.map(response => response.status), [200, 200]);
      assert.equal(await prisma.projectPost.count({ where: { projectId } }), 1);
      const post = await current(); slug = post.slug;
      await prisma.projectPost.update({ where: { projectId }, data: { expandedBlocks: { lead: { title: 'Test story' }, galleryChapters: [{ body: ['A real persisted test narrative.'], imageIds: [image.id] }] } } });
    });
    await t.test('foreign image rejected, duplicate submission persists one review', async () => {
      await prisma.projectPost.update({ where: { projectId }, data: { heroAssetId: foreignImage.id } });
      assert.equal((await act('submit')).status, 422);
      await prisma.projectPost.update({ where: { projectId }, data: { heroAssetId: image.id } });
      const responses = await Promise.all([act('submit'), act('submit')]);
      assert.deepEqual(responses.map(response => response.status), [200, 200]);
      assert.equal((await current()).status, 'REVIEW');
      assert.equal(await getPostBySlug(slug), null);
      assert.equal((await act('publish')).status >= 400, true);
      assert.equal((await actions.publishEditorial({ projectId })).statusCode, 409);
      await assert.rejects(actions.publishProjectAction({ projectId }), { status: 409 });
    });
    await t.test('admin listing uses the persisted review and stale decisions fail', async () => {
      session = { user: { id: ownerId, role: 'ADMIN' } };
      assert.equal((await act('approve', { expectedUpdatedAt: (await current()).updatedAt.toISOString() })).status, 403);
      asAdmin();
      const list = await reviewList.GET(req());
      assert.equal(list.status, 200);
      assert.ok((await list.json()).posts.some((post: { projectId: string }) => post.projectId === projectId));
      assert.equal((await act('approve', { expectedUpdatedAt: '2000-01-01T00:00:00.000Z' })).status, 409);
    });
    await t.test('rejection is idempotent and reviewer comes from session', async () => {
      const version = (await current()).updatedAt.toISOString();
      assert.equal((await act('reject', { reason: 'Please revise', expectedUpdatedAt: version })).status, 200);
      assert.equal((await act('reject', { reason: 'Please revise', expectedUpdatedAt: version })).status, 200);
      const post = await current();
      assert.equal(post.status, 'DRAFT');
      assert.equal((post.provenance as any).editorialReview.reviewedBy, adminId);
      assert.equal((await act('approve', { expectedUpdatedAt: post.updatedAt.toISOString() })).status, 409);
    });
    await t.test('existing designer publish action uses the same lifecycle and stays idempotent', async () => {
      asOwner();
      const first = await actions.publishEditorial({ projectId });
      assert.equal(first.ok, true);
      assert.equal(first.projectPostId, (await current()).id);
      const publishedAt = (await current()).publishedAt?.toISOString();
      assert.equal((await actions.publishEditorial({ projectId })).ok, true);
      assert.equal((await current()).publishedAt?.toISOString(), publishedAt);
      assert.equal((await act('unpublish')).status, 200);
    });
    await t.test('approval publishes the same post consumed publicly and survives a new DB client', async () => {
      asOwner(); assert.equal((await act('submit')).status, 200);
      asAdmin(); const version = (await current()).updatedAt.toISOString();
      assert.equal((await act('approve', { expectedUpdatedAt: version })).status, 200);
      const first = await current();
      assert.equal((await act('approve', { expectedUpdatedAt: version })).status, 200);
      assert.equal((await current()).publishedAt?.toISOString(), first.publishedAt?.toISOString());
      const publicPost = await getPostBySlug(slug);
      assert.equal(publicPost.id, first.id);
      assert.equal(publicPost.project.isPublic, true);
      const independent = new PrismaClient({ datasources: { db: { url: target } } });
      try { assert.equal((await independent.projectPost.findUniqueOrThrow({ where: { projectId } })).status, 'PUBLISHED'); }
      finally { await independent.$disconnect(); }
      asOwner(); assert.equal((await act('unpublish')).status, 200);
      assert.equal(await getPostBySlug(slug), null);
      assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).isPublic, false);
    });
    await t.test('concurrent contradictory reviews produce one winner and coherent visibility', async () => {
      asOwner(); assert.equal((await act('submit')).status, 200);
      asAdmin(); const version = (await current()).updatedAt.toISOString();
      const outcomes = await Promise.all([act('approve', { expectedUpdatedAt: version }), act('reject', { expectedUpdatedAt: version, reason: 'Revise' })]);
      assert.deepEqual(outcomes.map(response => response.status).sort(), [200, 409]);
      const post = await current();
      const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
      assert.equal(project.isPublic, post.status === 'PUBLISHED');
    });
  } finally {
    await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, strangerId, adminId] } } });
    await prisma.$disconnect();
  }
});

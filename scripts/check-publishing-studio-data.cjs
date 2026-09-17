/** Execute the real studio loader and idea PATCH with in-memory DB/session boundaries. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(js, { exports, console, require(name) {
    if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
    return imports[name];
  } }, { filename: file });
  return exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
function matches(row, where) {
  return Object.entries(where || {}).every(([key, wanted]) => {
    if (key === 'OR') return wanted.some(part => matches(row, part));
    const actual = row[key];
    if (wanted !== null && typeof wanted === 'object') {
      if ('in' in wanted) return wanted.in.includes(actual);
      return actual != null && matches(actual, wanted);
    }
    return actual === wanted;
  });
}
function setup(options = {}) {
  const date = new Date('2026-09-17T00:00:00Z');
  const project = (id, ownerId, org = null, status = 'PUBLISHED') => ({
    id, ownerId, designerId: ownerId, designerOrgId: org, title: id,
    images: [{ url: `${id}.jpg` }], post: { id: `article-${id}`, status, slug: id, variant: 'PROJECT_FEATURE', updatedAt: date },
  });
  const projects = [project('p1', 'me'), project('p2', 'me', null, 'DRAFT'),
    project('other', 'stranger'), project('org1', 'me', 'org'), project('org2', 'colleague', 'org'),
    project('other-org', 'me', 'elsewhere')];
  const idea = (id, designerId, organizationId, projectIds, status = 'recommended') => ({
    id, designerId, format: 'MATERIAL_STUDY', status, createdAt: date,
    prompts: { intro: 'A material story', items: [{ id: 'q1', prompt: 'Why this material?' }] },
    angle: { designerId, organizationId, summary: id, evidence: { projectIds } },
  });
  const ideas = [idea('mine', 'me', null, ['p1', 'p2']), idea('mixed', 'me', null, ['p1', 'other']),
    idea('forged', 'stranger', null, ['p1']), idea('malformed', 'me', null, 'p1'),
    idea('dismissed', 'me', null, ['p1'], 'dismissed'), idea('published', 'me', null, ['p1'], 'published'),
    idea('org-mine', 'me', 'org', ['org1', 'org2']), idea('org-peer', 'colleague', 'org', ['org1']),
    idea('org-mixed', 'me', 'org', ['org1', 'other-org'])];
  const campaigns = projects.map(p => ({ id: `campaign-${p.id}`, projectId: p.id, preset: 'compact',
    totalPosts: 4, createdAt: date, _count: { posts: 1 }, posts: [
      { id: `post-${p.id}`, title: 'Launch', caption: 'Caption', sequenceNum: 1, createdAt: date },
    ] }));
  const carousels = projects.map(p => ({ id: `carousel-${p.id}`, projectId: p.id, designerId: p.ownerId,
    headline: 'Carousel', caption: 'Saved caption', status: 'exported', updatedAt: date }));
  const calls = [];
  const findMany = (table, data) => async args => {
    calls.push({ table, ...plain(args) });
    return data.filter(row => matches(row, args.where)).slice(0, args.take);
  };
  const prisma = {
    user: { findUnique: async () => options.missingUser ? null : { operatingAsOrgId: options.org || null } },
    organizationUser: { findFirst: async args => {
      calls.push({ table: 'membership', ...plain(args) });
      return options.stale ? null : { role: options.memberRole || 'MEMBER', organization: { name: 'Our studio' } };
    } },
    project: { findMany: findMany('project', projects) },
    editorialQueueItem: { findMany: findMany('idea', ideas), updateMany: async args => {
      calls.push({ table: 'update', ...plain(args) });
      if (options.conflict) return { count: 0 };
      const eligible = ideas.filter(row => matches(row, args.where));
      eligible.forEach(row => Object.assign(row, args.data));
      return { count: eligible.length };
    } },
    instagramCampaign: { findMany: findMany('campaign', campaigns) },
    instagramExport: { findMany: findMany('carousel', carousels) },
  };
  const data = load('src/lib/publishing-studio/data.ts', { 'server-only': {}, '@/lib/prisma': { prisma } });
  const permissions = load('src/lib/permissions.ts', { '@/lib/prisma': { prisma } });
  const route = load('src/app/api/publishing-studio/ideas/[id]/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status || 200 }) } },
    'next-auth': { getServerSession: async () => options.signedOut ? null : { user: { id: 'me', role: options.role || 'DESIGNER' } } },
    '@/app/api/auth/[...nextauth]/options': { authOptions: {} }, '@/lib/prisma': { prisma },
    '@/lib/permissions': permissions, '@/lib/publishing-studio/data': data,
  });
  return { ...data, calls, ideas, patch: (id, status) => route.PATCH({ json: async () => ({ status }) }, { params: { id } }) };
}

async function main() {
  let f = setup();
  let data = await f.getStudioData('me');
  assert.deepEqual(plain(data.projects.map(p => p.id)), ['p1', 'p2']);
  assert.equal(data.projects.find(p => p.id === 'p2').canCreate, false);
  assert.deepEqual(plain(data.ideas.map(p => p.id)), ['mine', 'dismissed', 'published']);
  assert.equal(data.campaigns[0].postCount, 1);
  assert.equal(data.campaigns[0].totalPosts, 4);
  assert.ok(data.posts.every(p => p.status === 'generated' || p.status === 'exported'));
  console.log('PASS personal isolation, drafts, malformed/mixed evidence, persisted status and actual campaign counts');

  const filtered = await f.getStudioData('me', 'p1');
  assert.deepEqual(plain(filtered.ideas.map(p => p.id)), ['mine', 'dismissed', 'published']);
  assert.deepEqual(plain(filtered.campaigns.map(p => p.id)), ['campaign-p1']);
  assert.deepEqual(plain(filtered.posts.map(p => p.id).sort()), ['carousel-p1', 'post-p1']);
  assert.deepEqual(plain(filtered.campaigns[0]), plain(data.campaigns[0]));
  await assert.rejects(f.getStudioData('me', 'other'), error => error.status === 404);
  console.log('PASS project filter preserves shared records and cross-project ideas without allowing forged selection');

  f = setup({ org: 'org' });
  data = await f.getStudioData('me');
  assert.deepEqual(plain(data.projects.map(p => p.id)), ['org1', 'org2']);
  assert.deepEqual(plain(data.ideas.map(p => p.id)), ['org-mine']);
  assert.equal(data.projects.find(p => p.id === 'org2').canCreate, false);
  assert.equal(data.projects.find(p => p.id === 'org2').canCreateCampaign, true);
  const viewer = setup({ org: 'org', memberRole: 'VIEWER' });
  assert.equal((await viewer.getStudioData('me')).projects.find(p => p.id === 'org2').canCreateCampaign, false);
  assert.deepEqual(f.calls.find(c => c.table === 'membership').where, { userId: 'me', organizationId: 'org', isActive: true });
  assert.ok(!data.posts.some(p => p.id === 'carousel-org2'), 'Personal carousel drafts must not leak to colleagues');
  const stale = setup({ org: 'org', stale: true });
  await assert.rejects(stale.getStudioData('me'), error => error.status === 403);
  assert.equal(stale.calls.filter(c => c.table !== 'membership').length, 0);
  await assert.rejects(setup({ missingUser: true }).getStudioData('me'), error => error.status === 401);
  console.log('PASS current-org membership, colleague draft privacy, mixed-org evidence rejection and stale membership fail-closed');

  f = setup();
  assert.equal((await f.patch('forged', 'dismissed')).status, 404);
  assert.equal((await f.patch('mixed', 'dismissed')).status, 404);
  assert.equal((await f.patch('published', 'dismissed')).status, 409);
  assert.equal((await f.patch('mine', 'published')).status, 400);
  assert.equal(f.calls.filter(c => c.table === 'update').length, 0);
  assert.equal((await setup({ signedOut: true }).patch('mine', 'dismissed')).status, 401);
  assert.equal((await setup({ role: 'HOMEOWNER' }).patch('mine', 'dismissed')).status, 403);
  assert.equal((await setup({ org: 'org', stale: true }).patch('org-mine', 'dismissed')).status, 403);
  console.log('PASS unauthenticated/wrong-role/foreign/unsafe/published ideas cannot mutate');

  assert.equal((await f.patch('mine', 'in_progress')).status, 200);
  assert.equal((await f.patch('dismissed', 'recommended')).status, 200);
  const update = f.calls.find(c => c.table === 'update');
  assert.deepEqual(update.where, { id: 'mine', designerId: 'me', status: 'recommended', angle: { designerId: 'me', organizationId: null } });
  assert.equal((await setup({ conflict: true }).patch('mine', 'dismissed')).status, 409);
  console.log('PASS owner changes, restore, ownership predicate and optimistic concurrency conflict');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

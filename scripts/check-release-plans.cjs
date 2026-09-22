const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { if (!(name in mocks)) throw Error(name); return mocks[name]; }, process, URLSearchParams, console });
  return exports;
}
(async () => {
  const model = load('src/lib/publishing-studio/release-plan.ts', {});
  const options = [{ sourceId: 'project:p', revision: 'one', kind: 'introduction' }, { sourceId: 'room:p:r', revision: 'two', kind: 'room' }];
  const items = options.map(option => ({ sourceId: option.sourceId, revision: option.revision, planningDate: null }));
  assert.ok(model.validateReleaseItems(items, options));
  assert.equal(model.validateReleaseItems([...items].reverse(), options), null);
  assert.equal(model.validateReleaseItems([items[0], items[1], items[1]], options), null);
  assert.equal(model.validateReleaseItems([items[0], { ...items[1], revision: 'old' }], options), null);
  assert.equal(model.validPlanningDate('2026-02-30'), false);
  assert.equal(model.validPlanningDate('2026-09-22'), true);
  let saved = null, writes = 0, role = 'DESIGNER', workspace = null, source = 'two', isPublic = true;
  class AccessError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const project = { id: 'p', title: 'House', ownerId: 'owner', designerId: 'owner', post: { excerpt: 'This published introduction describes a coastal house arranged around sheltered courtyards and generous spaces for family gatherings.' } };
  const db = {
    user: { findUnique: async () => ({ role }) },
    project: { findFirst: async ({ where }) => where.id === 'p' && where.designerOrgId === null ? project : null, findMany: async () => [project] },
    instagramExport: { findMany: async () => [{ id: 'edited', config: { studioCardId: 'room:p:r' }, headline: 'My saved headline', caption: 'My saved caption', status: 'draft' }] },
    editorialDraft: {
      findUnique: async () => saved,
      findMany: async () => saved ? [{ projectId: 'p', rawState: saved.rawState }] : [],
      create: async ({ data }) => { writes++; saved = data; },
      updateMany: async ({ where, data }) => { if (saved.version !== where.version) return { count: 0 }; writes++; saved = { ...saved, ...data }; return { count: 1 }; },
    },
    $transaction: async callback => callback(db),
  };
  let duplicate = false;
  const feed = { configObject: value => value && typeof value === 'object' ? value : {}, buildStudioFeed: () => isPublic ? options.map((option, index) => ({ id: option.sourceId, revision: index ? source : option.revision, roomId: index ? 'r' : undefined, canPolish: true, caption: index && !duplicate ? 'We rejected the brass chandelier because its weight distorted our ceiling beams, choosing lighter glass instead.' : project.post.excerpt + (index ? ' Beautiful.' : ''), title: `Post ${index}`, imageUrl: 'photo' })) : [] };
  const service = load('src/lib/publishing-studio/release-plan-service.ts', {
    'server-only': {}, crypto: require('node:crypto'), '@prisma/client': { Prisma: { TransactionIsolationLevel: { Serializable: 'Serializable' }, PrismaClientKnownRequestError: class extends Error {} } },
    '@/lib/prisma': { prisma: db }, '@/lib/permissions': { canAccessDesignerTools: value => value === 'DESIGNER' },
    './data': { StudioAccessError: AccessError, resolvePublishingStudioContext: async () => ({ id: workspace, canWriteCampaigns: false }) }, './feed': feed, './release-plan': model,
  });
  const initial = await service.readReleasePlan('owner', 'p');
  assert.equal(writes, 0); assert.equal(initial.plan, null);
  assert.equal(initial.options[1].caption, 'My saved caption'); assert.match(initial.options[1].editorHref, /export=edited/);
  assert.match(initial.options[0].editorHref, /proposal=project/);
  assert.match(initial.options[0].editorHref, /release=p/);
  duplicate = true; assert.equal((await service.listReleasePlans('owner')).opportunities.length, 0, 'Near duplicate rooms do not form a sequence'); duplicate = false;
  const overview = project.post.excerpt; project.post.excerpt = 'A closer look at House.';
  assert.equal((await service.listReleasePlans('owner')).opportunities.length, 0, 'Generic fallback is not an introduction'); project.post.excerpt = overview;
  const result = await service.saveReleasePlan('owner', { projectId: 'p', expectedVersion: 0, items });
  assert.equal(result.plan.version, 1); assert.equal(writes, 1);
  await assert.rejects(service.saveReleasePlan('owner', { projectId: 'p', expectedVersion: 0, items }), error => error.status === 409);
  assert.equal(writes, 1);
  const dated = items.map(item => ({ ...item, planningDate: '2026-09-23' }));
  await service.saveReleasePlan('owner', { projectId: 'p', expectedVersion: 1, items: dated });
  assert.equal((await service.readReleasePlan('owner', 'p')).plan.items[1].planningDate, '2026-09-23');
  await assert.rejects(service.readReleasePlan('intruder', 'p'), error => error.status === 403);
  source = 'changed'; assert.equal((await service.readReleasePlan('owner', 'p')).plan.needsReview, true);
  await assert.rejects(service.saveReleasePlan('owner', { projectId: 'p', expectedVersion: 2, items }), error => error.status === 409);
  role = 'HOMEOWNER'; await assert.rejects(service.readReleasePlan('owner', 'p'), error => error.status === 403);
  role = 'DESIGNER'; workspace = 'other'; await assert.rejects(service.readReleasePlan('owner', 'p'), error => error.status === 403);
  workspace = null; isPublic = false;
  assert.equal((await service.readReleasePlan('owner', 'p')).plan.needsReview, true);
  const discovery = await service.listReleasePlans('owner'); assert.equal(discovery.opportunities.length, 0); assert.equal(discovery.plans[0].needsReview, true);
  const previousFlag = process.env.STUDIO_EDITORIAL_READINESS; process.env.STUDIO_EDITORIAL_READINESS = 'true';
  isPublic = true; assert.equal((await service.readReleasePlan('owner', 'p')).options.length, 0);
  if (previousFlag === undefined) delete process.env.STUDIO_EDITORIAL_READINESS; else process.env.STUDIO_EDITORIAL_READINESS = previousFlag;
  assert.equal(writes, 2);
  console.log('PASS: release plans browse without writes; reuse saved edits; preserve selections/dates; reject stale, role/workspace/actor conflicts; preserve blocked plans and readiness gates.');
})().catch(error => { console.error(error); process.exitCode = 1; });

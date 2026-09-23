const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, process, require: name => { if (!(name in mocks)) throw new Error(`Missing mock ${name}`); return mocks[name]; } });
  return exports;
}
(async () => {
  const pure = load('src/lib/publishing-studio/history.ts', {});
  const card = { id: 'proposal:p', title: 'Audience headline', caption: 'Moving the kitchen opening recovered the garden view and brought daylight across the dining table.', pitch: 'Recovering the garden view by moving the kitchen opening', revision: 'v1', kind: 'suggestion', canPolish: true, updatedAt: 'date' };
  let row = null, role = 'DESIGNER', workspace = null, permitted = true, visible = true, conflict = false, writes = 0;
  class Access extends Error { constructor(message, status) { super(message); this.status = status; } }
  class Known extends Error {}
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const db = {
    user: { findUnique: async () => ({ role }) },
    project: { findFirst: async query => permitted && query.where.id === 'p' ? { id: 'p' } : null,
      findMany: async () => permitted ? [{ id: 'p' }] : [] },
    instagramExport: { findMany: async () => [] },
    editorialDraft: {
      findUnique: async () => row,
      findMany: async query => row && query.where.id.in.includes(row.id) ? [row] : [],
      create: async ({ data }) => { writes++; row = structuredClone(data); },
      updateMany: async ({ where, data }) => { if (conflict || row.version !== where.version) return { count: 0 }; writes++; Object.assign(row, structuredClone(data)); return { count: 1 }; },
    },
  };
  const service = load('src/lib/publishing-studio/publication-history.ts', {
    'server-only': {}, crypto: require('node:crypto'), '@prisma/client': { Prisma: { TransactionIsolationLevel: { Serializable: 'Serializable' }, PrismaClientKnownRequestError: Known } },
    '@/lib/prisma': { prisma: { ...db, $transaction: async (fn, options) => { assert.equal(options.isolationLevel, 'Serializable'); return fn(db); } } },
    '@/lib/permissions': { canAccessDesignerTools: value => value === 'DESIGNER' },
    './data': { StudioAccessError: Access, resolvePublishingStudioContext: async (actor, tx) => { assert.ok(tx); return { id: workspace, canWriteCampaigns: true }; } },
    './feed': { configObject: object, buildStudioFeed: () => visible ? [card] : [] }, './history': pure,
  });
  const input = { projectId: 'p', sourceId: card.id, revision: 'v1', expectedVersion: 0, kind: 'published', destination: 'instagram', headline: 'Attacker-supplied prose' };
  assert.equal((await service.readPublicationHistory('actor', null, ['p'])).length, 0);
  assert.equal(writes, 0, 'reading and export availability never imply publication');
  const published = await service.savePublicationHistory('actor', input);
  assert.equal(published.version, 1); assert.equal(published.entries[0].kind, 'published');
  assert.equal(published.entries[0].headline, card.title, 'evidence and hook are derived server-side');
  assert.equal(published.entries[0].destination, 'instagram');
  assert.equal(pure.shouldSuppressPublication({ ...card, title: 'An entirely new headline' }, published.entries), true);
  assert.equal(pure.shouldSuppressPublication({ ...card, id: 'room:p:r', roomId: 'r' }, published.entries), false, 'introduction history does not suppress distinct room scope');
  assert.equal(pure.shouldSuppressPublication({ ...card, caption: 'A handwoven textile anchors a saturated library wall.', pitch: 'Textile craftsmanship in a colorful library' }, published.entries), false, 'same source identity does not erase a materially different story');
  await assert.rejects(service.savePublicationHistory('actor', input), error => error.status === 409);
  await assert.rejects(service.savePublicationHistory('actor', { ...input, expectedVersion: 1, sourceId: 'forged' }), error => error.status === 409);
  await assert.rejects(service.savePublicationHistory('actor', { ...input, expectedVersion: 1, revision: 'old' }), error => error.status === 409);
  await assert.rejects(service.savePublicationHistory('actor', { ...input, expectedVersion: 1, destination: 'uploaded' }), error => error.status === 400);
  const dismissed = await service.savePublicationHistory('actor', { ...input, expectedVersion: 1, kind: 'dismissed' });
  assert.equal(dismissed.entries[0].kind, 'dismissed'); assert.equal(dismissed.entries[0].destination, null);
  visible = false;
  const restored = await service.savePublicationHistory('actor', { ...input, expectedVersion: 2, kind: 'restored' });
  assert.equal(restored.entries.length, 0, 'undo is available even after original source changes');
  // Exercise the actual feed loader and release discovery against the same
  // correction reader. A saved carousel must survive suggestion suppression.
  let integrationHistory = [{ ...published, entries: published.entries.map(entry => ({ ...entry, sourceId: 'project:p' })) }];
  const introduction = { ...card, id: 'project:p', projectIds: ['p'], roomId: undefined };
  const roomCard = { ...card, id: 'room:p:r', projectIds: ['p'], roomId: 'r', caption: 'The library palette joins woven linen, blue lacquer and antique brass around a carefully proportioned reading alcove.', pitch: 'Layering linen and lacquer in a reading alcove' };
  const savedCard = { ...introduction, id: 'carousel:saved', kind: 'carousel', status: 'draft' };
  const project = { id: 'p', title: 'Project', ownerId: 'actor', designerId: 'actor', images: [], rooms: [],
    post: { id: 'post', status: 'PUBLISHED', slug: 'project', variant: 'PROJECT_FEATURE', updatedAt: new Date(), excerpt: 'The original kitchen opening blocked the view until the revised plan opened the dining room toward the garden.' } };
  const integratedDb = {
    user: { findUnique: async () => ({ role: 'DESIGNER', operatingAsOrgId: null }) },
    project: { findMany: async () => [project] }, editorialQueueItem: { findMany: async () => [] },
    editorialDraft: { findMany: async () => [] }, instagramCampaign: { findMany: async () => [] }, instagramExport: { findMany: async () => [] },
  };
  const integrationImports = { 'server-only': {}, crypto: require('node:crypto'), '@prisma/client': { Prisma: {} },
    '@/lib/prisma': { prisma: integratedDb }, '@/lib/permissions': { canAccessDesignerTools: () => true },
    './publication-history': { readPublicationHistory: async () => integrationHistory }, './history': pure,
    './publication-headlines': require('./studio-publication-test-import.cjs')('./publication-headlines'),
    './feed': { configObject: object, buildStudioFeed: () => [introduction, roomCard, savedCard], savedPublicationPreview: () => ({ imageUrl: null }) },
  };
  const dataLoader = load('src/lib/publishing-studio/data.ts', integrationImports);
  const releases = load('src/lib/publishing-studio/release-plan-service.ts', { ...integrationImports, './data': dataLoader, './release-plan': { validateReleaseItems: () => true } });
  const beforeUndoFeed = await dataLoader.getStudioData('actor');
  assert.equal(beforeUndoFeed.feed.some(item => item.id === introduction.id), false);
  assert.equal(beforeUndoFeed.feed.some(item => item.id === roomCard.id), true, 'published introduction preserves room decisions');
  assert.equal(beforeUndoFeed.feed.some(item => item.id === savedCard.id), true, 'correction never deletes saved work');
  assert.equal((await releases.listReleasePlans('actor')).opportunities.length, 0, 'confirmed introduction removes repeat project-release opportunity');
  integrationHistory = [restored];
  assert.equal((await dataLoader.getStudioData('actor')).feed.some(item => item.id === introduction.id), true, 'undo restores eligible feed suggestion');
  assert.equal((await releases.listReleasePlans('actor')).opportunities.length, 1, 'undo restores eligible release opportunity');
  const changedOverview = { ...introduction, caption: 'An entirely rewritten account of the residence and its complete redesign.', pitch: 'A new overview description' };
  assert.equal(pure.shouldSuppressPublication(changedOverview, published.entries.map(entry => ({ ...entry, sourceId: 'project:p' }))), true, 'canonical published project reveal remains consumed despite wording changes');
  visible = true; conflict = true;
  await assert.rejects(service.savePublicationHistory('actor', { ...input, expectedVersion: 3 }), error => error.status === 409);
  conflict = false; role = 'HOMEOWNER';
  await assert.rejects(service.savePublicationHistory('actor', { ...input, expectedVersion: 3 }), error => error.status === 403);
  role = 'DESIGNER'; permitted = false;
  await assert.rejects(service.savePublicationHistory('actor', { ...input, expectedVersion: 3 }), error => error.status === 404);
  assert.equal((await service.readPublicationHistory('actor', null, ['p'])).length, 0);
  permitted = true; workspace = 'other';
  await assert.rejects(service.readPublicationHistory('actor', null, ['p']), error => error.status === 409);
  workspace = null; row.rawState.actor = 'foreign';
  assert.equal((await service.readPublicationHistory('actor', null, ['p'])).length, 0, 'malformed/foreign namespace is not exposed');
  await assert.rejects(service.savePublicationHistory('actor', { ...input, expectedVersion: 3 }), error => error.status === 403);
  console.log('PASS publication history: explicit destination, server-derived evidence, semantic/room scope, no inferred publication, CAS, undo and ownership boundaries.');
})().catch(error => { console.error(error); process.exitCode = 1; });

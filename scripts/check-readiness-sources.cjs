// Real canonical source loader; database and workspace adapters are inert fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
async function main() {
  let workspace = { id: 'studio', name: 'Practice Name', canWriteCampaigns: true };
  let projectQuery;
  const project = {
    id: 'project', title: 'A residence', designer: { name: 'Individual Designer' },
    post: { expandedBlocks: { galleryChapters: [{ roomId: 'room', body: ['We moved the opening to recover the garden view.'] }] }, credits: { photographer: 'Photo Credit' } },
    rooms: [{ id: 'room', name: 'Living room' }],
    images: [{ id: 'image', url: 'https://example.com/photo.jpg', roomId: 'room', updatedAt: new Date('2026-09-20T12:00:00Z') }],
  };
  const db = {
    project: { findMany: async query => { projectQuery = query; return [structuredClone(project)]; } },
    editorialQueueItem: { findMany: async () => [] },
  };
  const mocks = {
    'server-only': {}, crypto: require('node:crypto'), '@/lib/prisma': { prisma: db },
    '../data': { resolvePublishingStudioContext: async (actor, client) => { assert.equal(actor, 'actor'); assert.equal(client, db); return workspace; } },
    '@/lib/instagram-export/generation': { extractTextFromBlocks: value => Array.isArray(value) ? value.join('\n') : '' },
  };
  const exports = {};
  const script = ts.transpileModule(fs.readFileSync('src/lib/publishing-studio/readiness/sources.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(script, { exports, process, require: name => {
    if (!(name in mocks)) throw new Error(`Unmocked dependency: ${name}`);
    return mocks[name];
  } });
  const initial = await exports.loadCandidateSources('actor', db);
  assert.equal(initial.sources.length, 2);
  assert.ok(initial.sources.every(source => source.designerName === 'Practice Name'), 'org project and room credits belong to the practice');
  assert.ok(initial.sources.every(source => source.photographer === 'Photo Credit'));
  assert.equal(projectQuery.where.designerOrgId, 'studio');
  assert.equal(projectQuery.where.isPublic, true);
  assert.equal(projectQuery.where.post.status, 'PUBLISHED');
  assert.equal(projectQuery.select.images.where.inclusion, 'INCLUDED');
  assert.equal(projectQuery.select.images.select.updatedAt, true);
  const fingerprints = initial.sources.map(exports.sourceVersion);
  const unchanged = await exports.loadCandidateSources('actor', db);
  assert.deepEqual(Array.from(unchanged.sources, exports.sourceVersion), Array.from(fingerprints), 'unchanged images keep source identity stable');
  project.images[0].updatedAt = new Date('2026-09-21T12:00:00Z');
  const revised = await exports.loadCandidateSources('actor', db);
  revised.sources.forEach((source, index) => {
    assert.equal(source.key, initial.sources[index].key);
    assert.equal(source.images[0].url, initial.sources[index].images[0].url);
    assert.notEqual(exports.sourceVersion(source), fingerprints[index], 'same URL with a newer image revision invalidates cached readiness');
  });
  workspace = { id: null, name: 'Your studio', canWriteCampaigns: false };
  const personal = await exports.loadCandidateSources('actor', db);
  assert.ok(personal.sources.every(source => source.designerName === 'Individual Designer'));
  assert.equal(projectQuery.where.designerOrgId, null);
  assert.equal(projectQuery.where.OR[0].ownerId, 'actor');
  assert.equal(projectQuery.where.OR[1].designerId, 'actor');
  project.designer = null;
  const fallback = await exports.loadCandidateSources('actor', db);
  assert.ok(fallback.sources.every(source => source.designerName === 'Your studio'));
  console.log('PASS readiness sources: organization-first credits, personal/fallback attribution, public included scope, stable fingerprints and same-URL image revision invalidation.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

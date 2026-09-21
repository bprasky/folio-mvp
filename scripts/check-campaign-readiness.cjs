const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText,
    { exports, require: id => { assert.ok(id in mocks, id); return mocks[id]; }, console, Date, process });
  return exports;
}
class StudioAccessError extends Error {}
let workspace = { id: null, canWriteCampaigns: false };
const tag = { reviewedAt: new Date(), product: { id: 'product', name: 'Chair', isPending: false, vendor: { name: 'Maker' } } };
const project = { id: 'p', ownerId: 'u', designerOrgId: null, isPublic: true, title: 'Home', designer: { name: 'Designer' },
  post: { status: 'PUBLISHED', heroAssetId: 'hero', expandedBlocks: {} }, rooms: [{ id: 'room', name: 'Living' }], images: [
    { id: 'excluded', inclusion: 'EXCLUDED', url: 'excluded', room: 'Bad', tags: [tag] },
    { id: 'first', inclusion: 'INCLUDED', url: 'first', roomId: 'room', room: 'Stale name', tags: [{ ...tag, reviewedAt: null }] },
    { id: 'third', inclusion: 'INCLUDED', url: 'third', roomId: 'room', tags: [] },
    { id: 'hero', inclusion: 'INCLUDED', url: 'hero', roomId: 'room', tags: [tag, { ...tag, product: { ...tag.product, id: 'pending', isPending: true } }] },
  ] };
let query;
const selection = load('src/lib/instagram/campaign/selectCampaignContent.ts', {
  '@/lib/prisma': { prisma: { project: { findUnique: async args => { query = args; return project; } } } },
  '@/lib/publishing-studio/data': { resolvePublishingStudioContext: async () => workspace, StudioAccessError },
  '@/lib/instagram/roomTeasers': { extractRoomTeasers: () => [] },
  '@/lib/posting/schemas': { BlocksSchema: { pick: () => ({ passthrough: () => ({ safeParse: () => ({ success: false }) }) }) } },
});
(async () => {
  const result = await selection.selectCampaignContent('p', 'complete', 'u');
  assert.equal(result.launch.heroImageId, 'hero');
  assert.equal(result.rooms.length, 1); assert.equal(result.rooms[0].name, 'Living');
  assert.equal(result.products.length, 1); assert.equal(result.products[0].id, 'product');
  assert.equal(result.totalPosts, 4); assert.equal(result.quotes.length, 0); assert.equal(result.details.length, 0);
  assert.equal(query.include.images.where.inclusion, 'INCLUDED');
  assert.equal(query.include.images.include.tags.where.product.isPending, false);
  workspace = { id: 'other', canWriteCampaigns: true };
  await assert.rejects(() => selection.selectCampaignContent('p', 'complete', 'u'), /workspace/);
  workspace = { id: null }; project.isPublic = false;
  await assert.rejects(() => selection.selectCampaignContent('p', 'complete', 'u'), /Publish/);

  let approved = [{ id: 'c', version: 1, sourceVersion: 'v1', title: 'Decision', caption: 'Approved text', imageIds: ['hero'], imageUrls: ['approved-url'] }];
  let created, event, renderInput, eventFails = false;
  class Zip { folder() { return this; } file() {} async generateAsync() { return Buffer.from('zip'); } }
  const generate = load('src/lib/instagram/campaign/generateReadyCampaign.ts', {
    'server-only': {}, jszip: Zip,
    '@/lib/prisma': { prisma: { project: { findUnique: async () => ({ ...project, isPublic: true }) }, instagramCampaign: { create: async args => { created = args.data; return { id: 'campaign' }; } } } },
    '@/lib/publishing-studio/readiness/render-image': { renderApprovedImage: async (url, width, height) => { renderInput = { url, width, height }; return Buffer.from('image'); } },
    './generateCaptions': { generateCaptionsFile: () => 'captions' },
    '@/lib/publishing-studio/readiness/service': { getApprovedCampaignCandidates: async () => approved, recordCampaignCandidateEvent: async (...args) => { if (eventFails) throw new Error('storage unavailable'); event = args; } },
  });
  await generate.generateReadyCampaign('u', 'p', ['square']);
  assert.equal(created.totalPosts, 1); assert.equal(created.posts.create.length, 1);
  assert.equal(created.posts.create[0].caption, 'Approved text');
  assert.equal(renderInput.url, 'approved-url'); assert.equal(event[1], 'c');
  eventFails = true;
  await assert.rejects(() => generate.generateReadyCampaign('u', 'p', ['square']), /Campaign campaign was saved.*download was not delivered/);
  assert.equal(created.totalPosts, 1, 'Post-save event failure explicitly acknowledges the persisted campaign');
  approved = []; created = null;
  await assert.rejects(() => generate.generateReadyCampaign('u', 'p', ['square']), /No ready/);
  assert.equal(created, null);
  console.log('Campaign checks passed: workspace/public gates, included/confirmed sources, room IDs, exact output count and approved-only generation.');
})().catch(error => { console.error(error); process.exitCode = 1; });

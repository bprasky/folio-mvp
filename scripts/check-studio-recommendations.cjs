// Execute real orchestration with inert adapters: no database, Redis or AI calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, { exports, require: name => {
    if (!(name in mocks)) throw new Error(`Unmocked dependency: ${name}`);
    return mocks[name];
  }, console, process: { env: { NODE_ENV: 'test' } } });
  return exports;
}
async function main() {
  let seenScope, seenDigest, persisted = [], query, sourceCount = 3;
  const digest = { maturity: { eligibleSignalTypes: ['repetition'] }, signals: [{ id: 'used' }, { id: 'fresh' }, { id: 'another' }] };
  const engine = load('src/lib/editorial-queue/index.ts', {
    '@/lib/prisma': { prisma: { project: { count: async () => sourceCount }, designerAngle: { findMany: async args => { query = args; return [{ signalIds: ['used'] }]; } } } },
    './buildCorpusDigest': { buildCorpusDigest: () => structuredClone(digest) },
    './fetchRawCorpusLayer': { fetchRawCorpusLayer: async (id, scope) => { seenScope = scope; return {}; } },
    './extractAngles': {
      extractAngles: async input => { seenDigest = input; return { rejected: [], accepted: [
        { signalIds: ['fresh'] }, { signalIds: ['fresh', 'another'] }, { signalIds: ['another'] },
      ] }; },
      persistAngles: async (id, org, angles) => { persisted = angles; return ['saved']; },
    },
    './assignFormat': {}, './generatePrompts': {}, './maturity': {}, './validateAngles': {}, './types': {},
  });
  const scope = { organizationId: null, projectIds: ['p1', 'p2', 'p3'] };
  await engine.runAngleExtraction('owner', null, scope);
  assert.equal(seenScope, scope);
  assert.equal(query.where.designerId, 'owner');
  assert.equal(query.where.organizationId, null);
  assert.equal(query.where.queueItems.some.status.not, 'expired', 'dismissed ideas also deduplicate');
  assert.equal(seenDigest.signals.map(s => s.id).join(','), 'fresh,another');
  assert.equal(persisted.length, 2, 'overlapping candidates in one response are not duplicated');
  sourceCount = 2;
  persisted = [];
  await assert.rejects(() => engine.runAngleExtraction('owner', null, scope), engine.EditorialCorpusChangedError);
  assert.equal(persisted.length, 0, 'source made private/deleted during AI call must not persist');
  digest.maturity.eligibleSignalTypes = [];
  seenDigest = null;
  assert.equal((await engine.runAngleExtraction('owner', null, scope)).status, 'not_eligible');
  assert.equal(seenDigest, null, 'below gate never reaches AI');

  let session = null, generated = 0, projectQuery, eligibleProjects = [], budgetCalls = 0;
  let generationRun = { extraction: { status: 'llm_unavailable', persistedAngleIds: [] }, createdQueueItemIds: [] };
  const route = load('src/app/api/publishing-studio/recommendations/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    'next-auth': { getServerSession: async () => session }, 'next/cache': { revalidatePath() {} },
    '@upstash/redis': {}, '@/app/api/auth/[...nextauth]/options': {},
    '@/lib/prisma': { prisma: { project: { findMany: async args => { projectQuery = args; return eligibleProjects; } } } },
    '@/lib/rateLimit': { checkRateLimit: async () => { budgetCalls++; return { success: true }; } },
    '@/lib/editorial-queue': { generateQueueForDesigner: async () => { generated++; return generationRun; }, EditorialCorpusChangedError: engine.EditorialCorpusChangedError },
    '@/lib/permissions': { canAccessDesignerTools: role => ['DESIGNER', 'ADMIN'].includes(role?.toUpperCase()) },
    '@/lib/editorial-queue/maturity': { EDITORIAL_QUEUE_MIN_STORIES: 3 },
    '@/lib/publishing-studio/data': { resolvePublishingStudioContext: async () => ({ id: 'org' }), StudioAccessError: class extends Error {} },
  });
  const request = action => ({ json: async () => ({ action }) });
  assert.equal((await route.POST(request('refresh'))).status, 401);
  session = { user: { id: 'owner', role: 'VENDOR' } };
  assert.equal((await route.POST(request('refresh'))).status, 403);
  session.user.role = 'DESIGNER';
  assert.equal((await route.POST(request('unexpected'))).status, 400);
  assert.equal((await route.POST(request('refresh'))).body.status, 'not_eligible');
  assert.equal(projectQuery.where.designerId, 'owner');
  assert.equal(projectQuery.where.designerOrgId, 'org');
  assert.equal(projectQuery.where.isPublic, true);
  assert.equal(projectQuery.where.post.status, 'PUBLISHED');
  assert.equal(generated, 0);
  assert.equal(budgetCalls, 0, 'below gate must not consume budget');
  eligibleProjects = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  session.user.role = 'designer';
  assert.equal((await route.POST(request('refresh'))).status, 503, 'unavailable extraction is not a successful refresh');
  generationRun = { extraction: { status: 'persisted', persistedAngleIds: ['angle'] }, createdQueueItemIds: [] };
  assert.equal((await route.POST(request('refresh'))).status, 503, 'failed prompt generation is not no-new-ideas');
  generationRun = { extraction: { status: 'no_signals', persistedAngleIds: [] }, createdQueueItemIds: [] };
  assert.equal((await route.POST(request('refresh'))).status, 200);
  generationRun = { extraction: { status: 'persisted', persistedAngleIds: ['angle'] }, createdQueueItemIds: ['idea'] };
  assert.equal((await route.POST(request('refresh'))).body.createdPieces, 1);
  console.log('Studio recommendations: scoped corpus, active/dismissed dedup, gate and request authorization passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

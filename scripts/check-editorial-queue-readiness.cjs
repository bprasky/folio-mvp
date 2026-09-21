// Inert module loader: exercises real queue logic without tsx, DB or paid calls.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const cache = new Map();
const queries = [];
let scope;
const prisma = {
  user: { findUnique: async () => ({ id: 'owner', name: 'Owner', specialties: [] }) },
  project: { findMany: async args => { queries.push(args); return []; } },
  editorialQueueItem: { findMany: async () => [] },
};
const mocks = {
  '@anthropic-ai/sdk': class { constructor() { throw new Error('Paid calls forbidden'); } },
  '@/lib/prisma': { prisma },
  '@/lib/posting/llmClient': { callLLM: () => { throw new Error('Paid calls forbidden'); } },
};
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, { exports, console, process, require: name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) {
      return load((name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(file), name)) + '.ts');
    }
    return require(name);
  } }, { filename: file });
  return exports;
}
async function main() {
  load('scripts/check-editorial-queue-digest.ts');
  load('scripts/check-editorial-queue-angles.ts');
  const { materialClassOf } = load('src/lib/editorial-queue/signals.ts');
  for (const word of ['washbasin', 'champagne', 'ironwood']) assert.equal(materialClassOf(null, word), null);
  assert.equal(materialClassOf('oak', 'Brass handle'), 'oak');
  assert.equal(materialClassOf(null, 'white-oak table'), 'oak');
  const { fetchRawCorpusLayer } = load('src/lib/editorial-queue/fetchRawCorpusLayer.ts');
  await fetchRawCorpusLayer('owner');
  assert.equal(queries[0].where.isPublic, true);
  assert.equal(queries[0].where.designerOrgId, null);
  assert.equal(queries[0].select.images.where.inclusion, 'INCLUDED');
  assert.equal(queries[0].select.images.select.tags.where.reviewedAt.not, null);
  assert.equal(queries[0].select.images.select.tags.where.product.isPending, false);
  const { parsePromptResponse, buildPromptGenUserPrompt } = load('src/lib/editorial-queue/generatePrompts.ts');
  assert.equal(parsePromptResponse('null', 'QA'), null);
  assert.equal(parsePromptResponse(JSON.stringify({ items: [{ prompt: 'one' }] }), 'QA'), null);
  const rows = [1, 2, 3].map(i => ({ prompt: `choice ${i}`, optionA: 'oak', optionB: 'ash' }));
  assert.ok(parsePromptResponse(JSON.stringify({ items: rows }), 'THIS_OR_THAT'));
  rows[1].optionB = 'oak';
  assert.equal(parsePromptResponse(JSON.stringify({ items: rows }), 'THIS_OR_THAT'), null);
  const { validateAngles } = load('src/lib/editorial-queue/validateAngles.ts');
  const angle = validateAngles([{ angleType: 'process', summary: 'Invented Italy trip', signalIds: ['s'], confidence: 1 }],
    [{ id: 's', evidence: { sources: [{ id: 's', kind: 'computed_signal', text: 'Oak appears twice' }] } }]).accepted[0];
  assert.equal(angle.evidence.claimStatus, 'inferred');
  const old = process.env.STUDIO_EDITORIAL_READINESS;
  process.env.STUDIO_EDITORIAL_READINESS = 'true';
  assert.match(buildPromptGenUserPrompt(angle, 'QA'), /unverified inference/);
  assert.match(buildPromptGenUserPrompt(angle, 'QA'), /Oak appears twice/);
  if (old === undefined) delete process.env.STUDIO_EDITORIAL_READINESS; else process.env.STUDIO_EDITORIAL_READINESS = old;
  const { resolveSignalEvidence } = load('src/lib/editorial-queue/evidence.ts');
  const signal = { id: 'room', headline: 'Kitchen tags', detail: 'Tagged images only', evidence: { imageIds: ['im'] } };
  resolveSignalEvidence(signal, { images: [{ imageId: 'im', projectId: 'p' }], tags: [], projects: [{ projectId: 'p', title: 'House' }], products: [], interviewAnswers: [] });
  assert.deepEqual(Array.from(signal.evidence.projectIds), ['p']);
  assert.ok(signal.evidence.sources.some(source => source.text === 'House'));
  // Unlock uses the public scoped corpus and passes it to dedup/revalidation.
  prisma.project.findMany = async args => { queries.push(args); return [{ id: 'a' }, { id: 'b' }, { id: 'c' }]; };
  prisma.notification = { findFirst: async () => null, create: async () => ({}) };
  prisma.organizationUser = { findFirst: async () => ({ id: 'membership' }) };
  cache.set(path.resolve('src/lib/editorial-queue/index.ts'), { generateQueueForDesigner: async (...args) => { scope = args[3]; return { createdQueueItemIds: [] }; } });
  const { maybeUnlockEditorialQueue } = load('src/lib/editorial-queue/unlock.ts');
  await maybeUnlockEditorialQueue('owner', 'org');
  assert.equal(scope.organizationId, 'org');
  assert.deepEqual(Array.from(scope.projectIds), ['a', 'b', 'c']);
  assert.equal(queries.at(-1).where.isPublic, true);
  assert.equal(queries.at(-1).where.designerOrgId, 'org');
  let role = 'DESIGNER', allowedBudget = true, writable = true, unlockCalls = 0;
  mocks['next/server'] = { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } };
  mocks['next-auth'] = { getServerSession: async () => ({ user: { id: 'owner', role } }) };
  mocks['@/app/api/auth/[...nextauth]/options'] = { authOptions: {} };
  mocks['@/lib/editorial-queue/unlock'] = { maybeUnlockEditorialQueue: async () => { unlockCalls++; return { status: 'test' }; } };
  mocks['@/lib/publishing-studio/data'] = { StudioAccessError: class extends Error {}, resolvePublishingStudioContext: async () => ({ id: 'org', canWriteCampaigns: writable }) };
  mocks['@/lib/permissions'] = { canAccessDesignerTools: value => value === 'DESIGNER' };
  mocks['@/lib/rateLimit'] = { checkRateLimit: async () => ({ success: allowedBudget }) };
  const route = load('src/app/api/editorial-queue/generate/route.ts');
  const previousFlag = process.env.STUDIO_EDITORIAL_READINESS;
  process.env.STUDIO_EDITORIAL_READINESS = 'true';
  assert.equal((await route.POST()).status, 409);
  process.env.STUDIO_EDITORIAL_READINESS = 'false'; role = 'VIEWER';
  assert.equal((await route.POST()).status, 403);
  role = 'DESIGNER'; writable = false;
  assert.equal((await route.POST()).status, 403);
  writable = true; allowedBudget = false;
  assert.equal((await route.POST()).status, 429);
  assert.equal(unlockCalls, 0);
  allowedBudget = true; assert.equal((await route.POST()).status, 200); assert.equal(unlockCalls, 1);
  if (previousFlag === undefined) delete process.env.STUDIO_EDITORIAL_READINESS; else process.env.STUDIO_EDITORIAL_READINESS = previousFlag;
  console.log('PASS queue readiness: real digest/angle suites, source boundaries, materials, question contracts, inferred claims, scoped unlock');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

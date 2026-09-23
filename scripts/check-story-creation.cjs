const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) { const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, console, Date, require: key => { if (!(key in mocks)) { const pure = require('./studio-publication-test-import.cjs')(key); if (pure) return pure; throw Error(key); } return mocks[key]; } }); return exports; }
(async () => {
  const activities = load('src/lib/publishing-studio/activities.ts', {});
  let generations = 0, created, contextSeen, mutateOnGenerate = false, role = 'DESIGNER';
  let stamp = new Date('2026-09-21T00:00:00Z');
  const db = { user: { findUnique: async () => ({ name: 'A designer', bio: 'A biography.', role }) },
    project: { findMany: async () => [{ id: 'project', title: 'House', rooms: [{ id: 'room', name: 'Living room' }], images: [{ id: 'photo', roomId: 'room' }], post: { id: 'post', expandedBlocks: 'Whole project', updatedAt: stamp } }] },
    editorialStory: {
      findUnique: async () => created || null,
      findFirst: async ({ where }) => created && created.ownerId === where.ownerId && created.organizationId === where.organizationId ? created : null,
      create: async ({ data }) => { const revision = data.revisions.create; created = { ...data, status: 'draft', publishedRevisionNumber: null, revisions: [{ ...revision, id: 'revision', editVersion: 1, answersReviewedAt: null, answers: [], sources: revision.sources.create }] }; return created; },
    }, $transaction: async fn => fn(db) };
  const service = load('src/lib/publishing-studio/story-service.ts', { 'server-only': {}, crypto: require('crypto'), '@prisma/client': require('@prisma/client'), '@/lib/prisma': { prisma: db },
    '@/lib/permissions': { canAccessDesignerTools: value => value === 'DESIGNER' }, '@/lib/rateLimit': { checkRateLimit: async () => ({ success: true }) },
    '@/lib/instagram-export/generation': { extractTextFromBlocks: value => value || '', publishedRoomSource: () => 'Only the living room' },
    './data': { resolvePublishingStudioContext: async () => ({ id: null, name: 'Studio', canWriteCampaigns: true }) }, './activities': activities,
    './generate-activity': { generateActivity: async (brief, context) => { generations++; contextSeen = context; if (mutateOnGenerate) stamp = new Date('2026-09-22T00:00:00Z'); const definition = activities.createActivity(brief, context); return { ...definition, questionSource: 'personalized', questions: definition.questions.map(q => ({ ...q, prompt: 'A question?', sourceIds: [], evidence: [{ sourceId: context.references.find(r => r.kind === 'project').id, quote: 'Only the living room' }] })) }; } },
  });
  const brief = { subject: 'project', projectId: 'project', roomId: 'room', format: 'qa' }, key = 'creation-key-123456789';
  const first = await service.startStory('owner', brief, key);
  assert.equal(first.revision, 1); assert.equal(first.status, 'draft'); assert.equal(first.publishedUrl, null);
  assert.equal(contextSeen.references.length, 1); assert.equal(contextSeen.references[0].roomId, 'room');
  assert.equal(created.revisions[0].sources[0].projectPostId, 'post', 'evidence source survives empty sourceIds');
  await service.startStory('owner', brief, key); assert.equal(generations, 1, 'retry resumes without paid generation');
  await assert.rejects(service.startStory('owner', { subject: 'designer', format: 'qa' }, key), e => e.status === 409);
  created = null; mutateOnGenerate = true;
  await assert.rejects(service.startStory('owner', brief, key), e => e.status === 409); assert.equal(created, null, 'changed source timestamp prevents creation');
  role = 'CONSUMER'; const before = generations;
  await assert.rejects(service.startStory('owner', brief, key), e => e.status === 403); assert.equal(generations, before);
  console.log('PASS: story creation retries, mismatched briefs, room-only references, evidence provenance, source-race rejection and fresh role checks.');
})().catch(error => { console.error(error); process.exitCode = 1; });

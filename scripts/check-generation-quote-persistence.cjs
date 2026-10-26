/** Run the route's actual post-generation save path; no model, network or DB. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require('tsx/cjs');
const { savedEmbeddedQuoteChoices } = require('../src/lib/posting/embeddedQuotes.ts');

const route = fs.readFileSync('src/app/api/posting/project/[projectId]/interview/generate/route.ts', 'utf8');
const start = route.indexOf('const validatedBlocks = composed;');
const end = route.indexOf("console.log('[AUDIT] generate:saved'", start);
assert.ok(start >= 0 && end > start, 'The route persistence boundary must remain discoverable');
const savePath = route.slice(start, end);
const selection = {
  selected: { text: 'We chose glass to keep the room open.', provenance: { questionId: 'dining-q1', isFollowUp: false } },
  alternatives: [
    { text: 'We chose glass to keep the room open.', score: 9, provenance: { questionId: 'dining-q1', isFollowUp: false } },
    { text: 'Six people can sit comfortably here.', score: 7, provenance: { questionId: 'dining-q2', isFollowUp: true } },
  ],
  authorship: 'verbatim',
};
const fixture = {
  hook: { text: 'Every room needed its own character.' },
  introduction: ['A home organized around distinct rooms.'],
  galleryChapters: [
    { kind: 'editorial', roomId: 'entry', title: 'Entry', imageIds: [], body: ['The entry.'], pullQuote: null },
    { kind: 'editorial', roomId: 'dining', title: 'Dining Room', imageIds: [], body: ['The dining room.'], pullQuote: selection },
  ],
  // The hook shifts the index and the empty room is absent from it.
  pullQuotes: [{ text: 'Every room needed its own character.' }, { text: selection.selected.text, sourceSection: 'Dining Room' }],
};
async function persist(source, { currentProvenance = {}, sourceInterview = { payload: {} }, acquireLock = false, verifyWrite } = {}) {
  let written;
  const post = { id: 'post', slug: 'story', status: 'DRAFT', updatedAt: new Date(0), provenance: currentProvenance,
    expandedBlocks: { embeddedQuotes: [{ slotId: 'breather-2', sourceId: 'designer', text: selection.selected.text, attribution: 'organization' }] } };
  const tx = {
    projectPost: { findUniqueOrThrow: async () => post, update: async ({ where, data }) => {
      assert.deepEqual(where.provenance.equals, post.provenance, 'CAS must compare the same provenance used to build the update');
      verifyWrite?.(data);
      written = JSON.parse(JSON.stringify(data.expandedBlocks)); return { ...post, ...data };
    } },
    project: { findUniqueOrThrow: async () => ({ isPublic: false }), update: async () => ({}) },
  };
  const context = {
    composed: structuredClone(fixture), post, projectId: 'project', projectData: { isPublic: false, images: [] },
    validImages: [], normalizedAnswers: [], normalizedFollowUps: [], allSelections: [], imageOrder: [],
    frozenChapters: [], existingOverrides: [], existingHistory: [],
    designerBio: null, projectHistory: null, atelierSummary: null, duration: 1, _cid: 'test',
    interview: sourceInterview, generationResetId: sourceInterview.resetId ?? null, answersOverride: [], acquireLock,
    verifyProductAccuracy: () => ({ warnings: [] }),
    savedEmbeddedQuoteChoices,
    session: { user: { id: 'owner' } },
    assertProjectWrite: async (actorId, projectId) => { assert.equal(actorId, 'owner'); assert.equal(projectId, 'project'); },
    jsonObject: value => value && typeof value === 'object' && !Array.isArray(value) ? value : {},
    Prisma: require('@prisma/client').Prisma,
    prisma: { projectPost: { findUnique: async () => post }, $transaction: async callback => callback(tx) },
    console: { log() {}, warn() {} },
  };
  const js = ts.transpileModule(`(async () => { ${source}\n })()`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  await vm.runInNewContext(js, context);
  assert.ok(written, 'Actual transaction update must receive expandedBlocks');
  return written;
}
function assertCanonical(saved) {
  assert.equal(saved.galleryChapters[0].pullQuote, null, 'A room with no quote must not receive the project hook');
  assert.deepEqual(saved.galleryChapters[1].pullQuote, selection, 'Selected text, provenance and all alternatives survive persistence');
  assert.deepEqual(saved.pullQuotes, fixture.pullQuotes, 'The top-level display index remains intact');
  assert.equal(saved.embeddedQuotes[0].text, selection.selected.text, 'Owner embedded quote survives the actual regeneration transaction');
}
async function main() {
  const generator = fs.readFileSync('src/lib/posting/generateEditorialDraft.ts', 'utf8');
  const assignmentStart = generator.indexOf('async function assignVerifiedPullQuotes(');
  const assignmentEnd = generator.indexOf('// MAIN GENERATION FUNCTION', assignmentStart);
  assert.ok(assignmentStart >= 0 && assignmentEnd > assignmentStart);
  const assignmentJs = ts.transpileModule(generator.slice(assignmentStart, assignmentEnd), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const regenerated = structuredClone(fixture);
  regenerated.galleryChapters[1].pullQuote = { selected: null, alternatives: selection.alternatives };
  const assigned = vm.runInNewContext(`${assignmentJs}\nassignVerifiedPullQuotes`, {
    projectAnswerCategory: () => null,
    prepareRoomTeasers: async (blocks, _answers, _projectId, options) => {
      assert.equal(options.refresh, true, 'Full generation must prepare both pools before persistence');
      blocks.galleryChapters[1].pullQuote = selection;
      return blocks;
    },
    syncPullQuotesFromChapters() {}, console: { info() {} },
  });
  await assigned(regenerated, { project: { id: 'project' } }, [{ section: 'Dining Room' }], 'test');
  assert.deepEqual(regenerated.galleryChapters[1].pullQuote, selection);
  console.log('PASS explicit full regeneration replaces removed selection with verified default and alternatives');
  assertCanonical(await persist(savePath));
  console.log('PASS route persistence retains null room, multi-option selection and provenance with hook index');
  const guided = { id: 'guided-session', version: 3, turns: [{ id: 'original' }, { id: 'correction', supersedes: 'original' }] };
  await persist(savePath, {
    currentProvenance: { preserve: 'other data', interview: { guided, payload: { answers: [], followups: [] } } },
    sourceInterview: { guided, payload: { answers: [{ answer: 'removed answer' }], followups: [{ answer: 'invalidated followup' }] } },
    verifyWrite: data => {
      assert.deepEqual(data.provenance.interview.guided, guided, 'Raw guided revisions survive generation');
      assert.equal(data.provenance.preserve, 'other data');
      assert.equal(data.provenance.interview.payload.answers.length, 0, 'Do not revive explicitly removed answers');
      assert.equal(data.provenance.interview.payload.followups.length, 0, 'Do not revive invalidated followups');
    },
  });
  await assert.rejects(persist(savePath, {
    currentProvenance: { interview: { guided, payload: { answers: [], followups: [] } } },
    sourceInterview: { guided: { ...guided, version: 2 }, payload: {} },
    verifyWrite: () => assert.fail('A draft composed before a correction must not be saved'),
  }), error => error.status === 409);
  console.log('PASS generation preserves guided history and explicit empty answers; changed session rejects stale draft');
  const resetInterview = { resetId: 'reset-current', payload: { answers: [], followups: [] } };
  assertCanonical(await persist(savePath, {
    currentProvenance: { interview: resetInterview }, sourceInterview: resetInterview,
  }));
  for (const sourceResetId of [null, 'reset-previous']) {
    await assert.rejects(persist(savePath, {
      currentProvenance: { interview: resetInterview },
      sourceInterview: { resetId: sourceResetId, payload: { answers: [{ answer: 'Before the reset' }] } },
      verifyWrite: () => assert.fail('Generation from an earlier interview must not save after a reset'),
    }), error => error.status === 409 && /restarted/.test(error.message));
  }
  console.log('PASS matching reset permits generation; first and later resets reject stale saves before any update');
  await assert.rejects(persist(savePath, {
    acquireLock: true,
    currentProvenance: { interview: { status: { phase: 'generating', requestId: 'newer-attempt' }, payload: {} } },
    verifyWrite: () => assert.fail('An expired writer cannot overwrite its replacement'),
  }), error => error.status === 409 && /newer generation/.test(error.message));
  assertCanonical(await persist(savePath, {
    acquireLock: true, currentProvenance: { interview: { status: { phase: 'generating', requestId: 'test' }, payload: {} } },
  }));
  console.log('PASS generation lease owner saves; replaced late writer cannot update the draft');
  const redistribution = `
    if (validatedBlocks.pullQuotes?.length && validatedBlocks.galleryChapters?.length) {
      for (let i = 0; i < validatedBlocks.galleryChapters.length && i < validatedBlocks.pullQuotes.length; i++) {
        const q = validatedBlocks.pullQuotes[i];
        validatedBlocks.galleryChapters[i].pullQuote = typeof q === 'string' ? q : q.text;
      }
    }
  `;
  const broken = await persist(savePath.replace('const expandedBlocks = validatedBlocks;', redistribution + 'const expandedBlocks = validatedBlocks;'));
  assert.throws(() => assertCanonical(broken), 'Fixture must reject the original redistribution defect');
  console.log('PASS regression fixture rejects the original redistribution behavior');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

/** Exercise real route persistence blocks with doubles; no network or live DB. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const read = path => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const routeRoot = 'src/app/api/posting/project/[projectId]/interview/';
const generation = read(routeRoot + 'generate/route.ts');
const jsonObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const baseContext = { jsonObject, Prisma: { DbNull: 'fixture-db-null' }, console: { warn() {} } };
function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, 'Actual persistence boundary must be discoverable');
  return source.slice(start, end);
}
function evaluate(source, context) {
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return vm.runInNewContext(js, { ...baseContext, ...context });
}
function namedFunction(source, name) {
  const parsed = ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.Latest, true);
  const declaration = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration, `Actual ${name} function must exist`);
  return declaration.getText(parsed).replace(/^export /, '');
}

async function checkGenerationMetadata() {
  const helper = between(generation, 'async function patchGenerationInterview(', '// Safe body reader');
  let state = { unrelated: 'keep', interview: { guided: { version: 2, turns: [{ id: 'first' }] }, payload: { answers: [], followups: [] } } };
  let writes = 0;
  let resetDuringCas = false;
  let authorizations = 0;
  const patch = evaluate(helper + '\npatchGenerationInterview', {
    assertProjectWrite: async (actorId, projectId) => { assert.equal(actorId, 'owner'); assert.equal(projectId, 'project'); authorizations++; },
    prisma: { projectPost: {
      findUnique: async () => ({ updatedAt: new Date(0), provenance: structuredClone(state) }),
      updateMany: async ({ where, data }) => {
        writes++;
        assert.ok(where.provenance.equals, 'CAS must include the JSON snapshot');
        if (writes === 1) {
          if (resetDuringCas) state.interview = { resetId: 'new-reset', payload: { answers: [] } };
          else state.interview.guided = { version: 3, turns: [{ id: 'first' }, { id: 'accepted-during-save' }] };
          return { count: 0 };
        }
        state = data.provenance;
        return { count: 1 };
      },
    } },
  });
  await patch('project', 'owner', null, () => ({ status: { phase: 'idle' } }));
  assert.equal(writes, 2);
  assert.equal(authorizations, 1);
  assert.equal(state.interview.guided.version, 3);
  assert.equal(state.interview.guided.turns[1].id, 'accepted-during-save');
  assert.equal(state.interview.payload.answers.length, 0);
  assert.equal(state.unrelated, 'keep');
  assert.equal(state.interview.status.phase, 'idle');
  writes = 0; resetDuringCas = true;
  await assert.rejects(patch('project', 'owner', null, () => ({ status: { phase: 'old-generation-finished' } })), error => error.status === 409);
  assert.equal(writes, 1, 'a reset during CAS must stop the old generation retry before another write');
  assert.equal(state.interview.resetId, 'new-reset'); assert.equal(state.interview.status, undefined);
  await assert.rejects(patch('project', 'owner', null, () => ({ status: { phase: 'stale' } })), error => error.status === 409);
  assert.equal(writes, 1, 'an already stale generation may not call the patch writer');
  console.log('PASS generation metadata CAS retries without erasing a concurrent guided turn');
}

async function checkSavedEvidenceRead() {
  const source = read(routeRoot + 'route.ts');
  const actual = ['buildQuestionTextMap', 'answerRoomKey', 'buildCoverage', 'GET']
    .map(name => namedFunction(source, name)).join('\n') + '\nGET';
  for (const mode of ['saved-only', 'guided', 'legacy', 'empty', 'anonymous', 'forbidden', 'spotlight', 'disabled']) {
    const events = [];
    const provenance = { interview: {
      ...(mode === 'guided' ? { guided: { id: 'existing-guided' } } : {}),
      payload: { answers: [{ questionId: 'q1', answer: 'We kept the route open.', roomId: 'room' }] },
      questionSet: { rooms: { result: { rooms: [{ roomId: 'room', roomName: 'Living room', questions: [{ id: 'q1', questionText: 'What shaped this room?' }] }] } } },
    } };
    const original = JSON.stringify(provenance);
    const get = evaluate(actual, {
      URL, POSTING_V1_ENABLED: mode !== 'disabled', authOptions: {},
      console: { log() {}, warn() {}, error() {} },
      legacyInterviewBoundary: async () => mode === 'spotlight' ? { status: 409 } : null,
      getServerSession: async () => mode === 'anonymous' ? null : { user: { id: 'owner' } },
      assertProjectView: async () => { events.push('authorize'); if (mode === 'forbidden') throw new Error('Forbidden'); },
      prisma: {
        projectPost: { findUnique: async () => { events.push('read'); return mode === 'empty' ? null : { provenance }; } },
        editorialInterview: { findUnique: async () => ({ roomProgress: { room: 'complete' } }) },
      },
      NextResponse: { json: (body, options) => ({ body: JSON.parse(JSON.stringify(body)), status: options?.status ?? 200 }) },
      require: name => {
        assert.equal(name, '@/lib/editorial/getInterviewQuestions');
        return { getInterviewQuestions: async () => { events.push('prepare'); return [{ id: 'contextual', questionType: 'contextual', questionText: 'A legacy question' }]; } };
      },
    });
    const savedOnly = ['saved-only', 'empty'].includes(mode);
    const result = await get({ url: 'https://folio.test/api/posting/project/project/interview' + (savedOnly ? '?savedOnly=1' : '') }, { params: { projectId: 'project' } });
    assert.equal(events.filter(event => event === 'prepare').length, mode === 'legacy' ? 1 : 0, mode + ' must not generate questions while reading evidence');
    assert.equal(JSON.stringify(provenance), original, 'Reads must preserve saved provenance');
    if (['saved-only', 'guided', 'legacy'].includes(mode)) {
      assert.equal(result.status, 200);
      assert.equal(result.body.answers[0].prompt, 'What shaped this room?');
      assert.equal(result.body.answers[0].answer, 'We kept the route open.');
      assert.deepEqual(result.body.coverage, [{ roomId: 'room', roomName: 'Living room', answered: 1, total: 1, complete: true }]);
      assert.equal(result.body.contextualQuestions.length, mode === 'legacy' ? 1 : 0);
      assert.equal(result.body.guided, mode === 'guided', 'saved evidence identifies the correct editor without preparing questions');
    } else if (mode === 'empty') {
      assert.equal(result.status, 200); assert.deepEqual(result.body.answers, []);
    } else assert.notEqual(result.status, 200, mode + ' must remain blocked');
    if (mode === 'legacy') assert.ok(events.indexOf('authorize') < events.indexOf('prepare'));
  }
  console.log('PASS saved-evidence and guided reads preserve answers/coverage without model preparation; legacy preparation follows authorization');
}

async function checkLegacySave() {
  const source = read(routeRoot + 'route.ts');
  const guidedGuard = between(source, 'const existingProvenance = (currentPost.provenance as any) || {};', '// Clearing is DESTRUCTIVE');
  const persistence = between(source, 'const saved = await prisma.$transaction(async (tx) => {', '// Calculate saved count');
  for (const mode of ['guided', 'reset', 'race', 'projection-failure', 'progress-failure', 'legacy']) {
    const original = { provenance: { interview: { ...(mode === 'guided' ? { guided: { id: 'saved-guided-session' } } : {}), ...(mode === 'reset' ? { resetId: 'new-reset' } : {}), payload: { answers: ['old answer'] } } }, answers: ['old answer'], roomProgress: {} };
    let state = structuredClone(original);
    let transactionCount = 0;
    const writes = [];
    const nextProvenance = { interview: { payload: { answers: ['new answer'] } } };
    let tx;
    const context = {
      projectId: 'project', resetId: null, currentPost: { provenance: state.provenance, updatedAt: new Date(0) },
      nextProvenance, nextInterviewPayload: { selectedQuestionIds: ['q1'] },
      incomingAnswers: [{ questionId: 'q1' }], isClearing: false,
      mergedAnswers: [{ questionId: 'q1', roomId: 'room', answer: 'new answer', section: 'designIntent' }],
      roomStatuses: [{ roomId: 'room', status: 'complete' }],
      ROOM_STATUS_VALUES: ['not_started', 'in_progress', 'complete', 'skipped'],
      STATUS_RANK: { not_started: 0, in_progress: 1, complete: 2, skipped: 3 },
      NextResponse: { json: (body, options) => ({ body, status: options.status }) },
      rebuildAnswerProjection: async (id, answers, audio, client) => {
        assert.equal(client, tx, 'Answer projection must use the transaction client holding the post CAS');
        assert.equal(id, 'editorial');
        assert.equal(answers[0].questionCategory, 'designIntent');
        writes.push('answers');
        if (mode === 'projection-failure') throw new Error('synthetic projection failure');
        tx.staged.answers = answers.map(answer => answer.answer);
      },
      prisma: { $transaction: async work => {
        transactionCount++;
        // Transaction boundary double: proves orchestration, not PostgreSQL locking.
        tx = {
          staged: structuredClone(state),
          projectPost: { updateMany: async ({ where, data }) => {
            writes.push('canonical');
            assert.equal(where.projectId, 'project');
            assert.deepEqual(where.provenance.equals, state.provenance);
            if (mode === 'race') return { count: 0 };
            tx.staged.provenance = data.provenance;
            return { count: 1 };
          } },
          editorialInterview: {
            upsert: async () => { writes.push('editorial'); return { id: 'editorial', roomProgress: tx.staged.roomProgress }; },
            update: async ({ data }) => {
              writes.push('progress');
              if (mode === 'progress-failure') throw new Error('synthetic room progress failure');
              tx.staged.roomProgress = data.roomProgress;
            },
          },
        };
        const result = await work(tx);
        state = tx.staged;
        return result;
      } },
    };
    const operation = evaluate(`(async () => { ${guidedGuard} ${persistence} return { status: 200 }; })()`, context);
    if (mode.endsWith('failure')) {
      await assert.rejects(operation, /synthetic .*failure/);
      assert.deepEqual(state, original, 'Projection errors must escape the transaction rather than commit partial canonical state');
      assert.deepEqual(writes, mode === 'projection-failure' ? ['canonical', 'editorial', 'answers'] : ['canonical', 'editorial', 'answers', 'progress']);
    } else {
      const result = await operation;
      assert.equal(result.status, mode === 'legacy' ? 200 : 409);
      if (mode === 'legacy') {
        assert.deepEqual(writes, ['canonical', 'editorial', 'answers', 'progress']);
        assert.equal(state.answers[0], 'new answer');
        assert.equal(state.roomProgress.room.status, 'complete');
        assert.equal(state.roomProgress.room.answeredCount, 1);
      } else {
        assert.deepEqual(state, original);
        assert.deepEqual(writes, ['guided', 'reset'].includes(mode) ? [] : ['canonical']);
      }
    }
    assert.equal(transactionCount, ['guided', 'reset'].includes(mode) ? 0 : 1);
  }
  console.log('PASS legacy save keeps CAS, answers and room progress in one transaction; guided/race guards and failure propagation preserve state');
}

async function checkRealtime() {
  const route = read('src/app/api/interview/realtime/convert/route.ts');
  const block = between(route, 'const editorialInterview = await prisma.$transaction(async tx => {', 'return NextResponse.json({');
  async function convert(guided, conflict = false) {
    const writes = [];
    const tx = {
      projectPost: {
        findUnique: async () => ({ updatedAt: new Date(0), provenance: { interview: guided ? { guided: { id: 'saved-session' } } : {} } }),
        updateMany: async ({ where }) => { assert.ok(where.provenance.equals); writes.push('canonical'); return { count: conflict ? 0 : 1 }; },
      },
      editorialInterview: { upsert: async () => { writes.push('editorial'); return { id: 'editorial' }; } },
      editorialInterviewAnswer: { deleteMany: async () => writes.push('delete'), createMany: async () => writes.push('insert') },
      realtimeInterviewSession: { update: async () => writes.push('link') },
    };
    try {
      await evaluate(`(async () => { ${block} return editorialInterview; })()`, {
        realtimeSession: { projectId: 'project' }, projectSlug: 'project', sessionId: 'realtime',
        realtimeQuestionIds: ['realtime-0'], answers: [{ questionId: 'realtime-0', answerText: 'answer' }],
        provenancePayload: { interview: { source: 'realtime', payload: { answers: [] } } },
        prisma: { $transaction: async callback => callback(tx) },
      });
      return { writes };
    } catch (error) { return { error, writes }; }
  }
  let result = await convert(true);
  assert.equal(result.error.status, 409);
  assert.deepEqual(result.writes, [], 'Existing guided history must block all writes');
  result = await convert(false, true);
  assert.equal(result.error.status, 409);
  assert.deepEqual(result.writes, ['canonical'], 'A failed CAS must precede projection/link mutations');
  assert.deepEqual((await convert(false)).writes, ['canonical', 'editorial', 'delete', 'insert', 'link']);
  console.log('PASS realtime guided/race guards precede every projection write; ordinary conversion continues');
}

async function checkFollowups() {
  for (const name of ['', 'single/', 'batch/']) {
    const route = read(routeRoot + 'followups/' + name + 'route.ts');
    const marker = name === 'single/' ? '// Recheck after the model call' : '// Recheck guided ownership after the model call';
    const persistenceStart = route.indexOf('try {', route.indexOf(marker));
    const persistenceEnd = route.indexOf(name === 'batch/' ? '\n    return NextResponse.json(' : '// Analytics', persistenceStart);
    assert.ok(persistenceStart >= 0 && persistenceEnd > persistenceStart);
    const block = route.slice(persistenceStart, persistenceEnd);
    async function persist(guided, conflict = false, reset = false) {
      let writes = 0;
      let captured;
      const provenance = { interview: { payload: { answers: [{ answer: 'saved' }] }, followUps: [], ...(guided ? { guided: { id: 'saved' } } : {}), ...(reset ? { resetId: 'new-reset' } : {}) } };
      const result = await evaluate(`(async () => { ${block} return { status: 200 }; })()`, {
        projectId: 'project', sourceResetId: null, validated: { questionId: 'q1', roomId: 'room1', round: 1 },
        followupsWithKeys: [{ id: 'fu1', text: 'A followup' }], followUps: [{ id: 'fu1', question: 'A followup' }],
        followUpsRaw: [{ questionId: 'q1', followUps: [{ id: 'fu1', prompt: 'A followup' }] }],
        NextResponse: { json: (body, options) => ({ body, status: options.status }) },
        prisma: { projectPost: {
          findUnique: async () => ({ provenance, updatedAt: new Date(0) }),
          updateMany: async ({ where, data }) => {
            writes++;
            captured = { where, data };
            return { count: conflict ? 0 : 1 };
          },
        } },
      });
      if (captured) {
        assert.deepEqual(captured.where.provenance.equals, provenance);
        assert.equal(captured.data.provenance.interview.payload.answers[0].answer, 'saved');
      }
      return { result, writes };
    }
    let outcome = await persist(true);
    assert.equal(outcome.result.status, 409);
    assert.equal(outcome.writes, 0);
    outcome = await persist(false, true);
    assert.equal(outcome.result.status, 409);
    assert.equal(outcome.writes, 1);
    outcome = await persist(false, false, true);
    assert.equal(outcome.result.status, 409); assert.equal(outcome.writes, 0, 'a follow-up prepared before reset cannot repopulate the new interview');
    outcome = await persist(false);
    assert.equal(outcome.result.status, 200);
    assert.equal(outcome.writes, 1);
  }
  console.log('PASS all three legacy followup writers reject guided sessions and CAS races; ordinary writes preserve evidence');
}

async function checkResetRequestEpochs() {
  for (const name of ['', 'single/', 'batch/']) {
    const source = read(routeRoot + 'followups/' + name + 'route.ts');
    const block = name === 'batch/'
      ? between(source, '    const sourceResetId = ', '    // Build images and products context')
      : between(source, '    const savedPost = await prisma.projectPost.findUnique(', '    let validated;');
    for (const [savedEpoch, requestEpoch, expectedStatus] of [['new-reset', null, 409], ['new-reset', 'old-reset', 409], ['new-reset', 'new-reset', 200], [null, null, 200]]) {
      const post = { provenance: { interview: savedEpoch ? { resetId: savedEpoch } : {} } };
      const body = { resetId: requestEpoch, answers: [{ answer: 'A response composed in another tab.' }] };
      const result = await evaluate(`(async () => { ${block} return { status: 200 }; })()`, {
        projectId: 'project', projectPost: post, body, request: { json: async () => body },
        prisma: { projectPost: { findUnique: async () => post } },
        NextResponse: { json: (body, options) => ({ body, status: options.status }) },
      });
      assert.equal(result.status, expectedStatus, `${name || 'default/'} rejects an old client before preparing follow-ups`);
    }
  }
  const overrideGuard = between(generation, '    generationResetId = ', '    // Check for existing draft');
  for (const body of [{ answersOverride: [] }, { followupsOverride: [] }, { answersOverride: [], resetId: 'old-reset' }, { answersOverride: [], resetId: 'new-reset' }, {}]) {
    const result = await evaluate(`(async () => { let generationResetId; ${overrideGuard} return { status: 200 }; })()`, {
      body, post: { provenance: { interview: { resetId: 'new-reset' } } },
      NextResponse: { json: (body, options) => ({ body, status: options.status }) },
    });
    assert.equal(result.status, (Array.isArray(body.answersOverride) || Array.isArray(body.followupsOverride)) && body.resetId !== 'new-reset' ? 409 : 200);
  }
  console.log('PASS new follow-up requests and generation override arrays require the current reset epoch; canonical-only generation stays available');
}

async function checkQuestionCaches() {
  const source = read('src/lib/editorial/getInterviewQuestions.ts');
  for (const name of ['persistKnownFacts', 'persistQuestionSet']) {
    for (const guided of [false, true]) {
      let writes = 0;
      let captured;
      const provenance = { interview: { payload: { answers: [{ answer: 'retain' }] }, ...(guided ? { guided: { version: 2 } } : {}) } };
      const save = evaluate(namedFunction(source, name) + `\n${name}`, { prisma: { projectPost: {
        findUnique: async () => ({ provenance, updatedAt: new Date(0) }),
        updateMany: async ({ where, data }) => {
          writes++;
          captured = { where, data };
          // Cache persistence is optional: a concurrent save must be a harmless no-op.
          return { count: 0 };
        },
      } } });
      await save('project', name === 'persistKnownFacts' ? { facts: [] } : 'rooms', 'signature', { groups: [] });
      assert.equal(writes, guided ? 0 : 1);
      if (captured) {
        assert.deepEqual(captured.where.provenance.equals, provenance, 'Optional caches must also compare the original JSON');
        assert.equal(captured.data.provenance.interview.payload.answers[0].answer, 'retain');
      }
    }
  }
  console.log('PASS legacy fact/question caches skip guided sessions and compare the original JSON');
}

async function checkReverseSync() {
  const source = read('src/lib/editorial/syncEditorialAnswersToProvenance.ts');
  const helper = ['slugify', 'deriveSection', 'categoryFor', 'deepMerge', 'syncEditorialAnswersToProvenance'].map(name => namedFunction(source, name)).join('\n');
  for (const mode of ['guided', 'race', 'legacy', 'reset']) {
    let writes = 0;
    let reads = 0;
    const provenance = { interview: { ...(mode === 'guided' ? { guided: { id: 'guided' } } : {}), payload: { answers: [] } } };
    const sync = evaluate(helper + '\nsyncEditorialAnswersToProvenance', {
      assertLegacyInterviewAllowed() {}, ALLOWED_SECTIONS: new Set(['what', 'how']),
      console: { log() {} },
      prisma: {
        editorialInterview: { findUnique: async () => ({ selectedQuestionIds: ['q1'], answers: [{ questionId: 'q1', questionText: 'Question', answerText: 'Answer', questionCategory: 'what', isFollowUp: false }] }) },
        project: { findUnique: async () => ({ images: [] }) },
        projectPost: {
          findUnique: async () => { reads++; return { provenance: mode === 'reset' && reads > 1 ? { interview: { resetId: 'new-reset', payload: { answers: [] } } } : provenance, updatedAt: new Date(0) }; },
          updateMany: async ({ where, data }) => {
            writes++;
            assert.deepEqual(where.provenance.equals, provenance);
            assert.equal(data.provenance.interview.payload.answers[0].section, 'what');
            return { count: mode === 'race' ? 0 : 1 };
          },
        },
      },
    });
    if (mode === 'legacy') assert.equal((await sync('project')).answerCount, 1);
    else await assert.rejects(sync('project'), error => error.status === 409);
    assert.equal(writes, ['guided', 'reset'].includes(mode) ? 0 : 1);
  }
  console.log('PASS reverse projection sync cannot replace guided evidence; ordinary categories survive');
}

async function checkForwardSync() {
  const source = read('src/lib/editorial/syncInterviewAnswers.ts');
  const helpers = between(source, 'const rowKey = ', '/**\n * Rewrite one interview');
  const actual = helpers + '\n' + namedFunction(source, 'rebuildAnswerProjection') + '\n' + namedFunction(source, 'syncAnswersToEditorialInterview') + '\nsyncAnswersToEditorialInterview';
  for (const mode of ['reset-during-read', 'already-reset', 'ordinary']) {
    let canonical = { id: 'post', updatedAt: new Date(0), provenance: { interview: { payload: { answers: [{ questionId: 'q1', prompt: 'Saved question?', answer: 'Saved source evidence.', section: 'what' }] } } } };
    if (mode === 'already-reset') canonical.provenance.interview = { resetId: 'new-reset', payload: { answers: [], followups: [] } };
    let projection = [{ questionId: 'q1', answerText: 'Old projected evidence', isFollowUp: false, createdAt: new Date(0) }];
    const events = [];
    const tx = {
      projectPost: { findUnique: async () => { events.push('read'); return structuredClone(canonical); }, updateMany: async ({ where, data }) => {
        events.push('cas'); assert.deepEqual(where.provenance.equals, canonical.provenance); assert.deepEqual(data.provenance, canonical.provenance);
        if (mode === 'reset-during-read') { canonical.provenance.interview = { resetId: 'new-reset', payload: { answers: [] } }; projection = []; return { count: 0 }; }
        return { count: 1 };
      } },
      editorialInterview: { upsert: async () => { events.push('editorial'); return { id: 'interview' }; } },
      editorialInterviewAnswer: { findMany: async () => projection, deleteMany: async () => { events.push('delete'); projection = []; }, create: async ({ data }) => { events.push('insert'); projection.push(data); } },
    };
    const sync = evaluate(actual, { assertLegacyInterviewAllowed() {}, randomUUID: require('node:crypto').randomUUID,
      SECTION_ENUM: { safeParse: value => ({ success: value === 'what' }) }, prisma: { $transaction: async work => work(tx) } });
    if (mode === 'reset-during-read') {
      await assert.rejects(sync('project'), error => error.status === 409);
      assert.deepEqual(events, ['read', 'cas']); assert.deepEqual(projection, [], 'old canonical read cannot recreate rows after reset');
    } else {
      const result = await sync('project'); assert.equal(result.answersCreated, mode === 'already-reset' ? 0 : 1);
      assert.deepEqual(events.slice(0, 3), ['read', 'cas', 'editorial']);
      if (mode === 'already-reset') assert.deepEqual(projection, [], 'an empty canonical reset clears any stale projection');
      else assert.equal(projection[0].answerText, 'Saved source evidence.');
    }
  }
  console.log('PASS forward projection sync holds canonical CAS before rebuilding; reset races cannot restore removed answer rows');
}

async function checkRoomRename() {
  const source = read('src/app/api/projects/[id]/rooms/[roomId]/route.ts');
  const block = between(source, '// 3b. Cascade to ProjectPost.provenance', '// 4. Cascade to InstagramCampaignPost');
  for (const conflict of [false, true]) {
    const provenance = { interview: { guided: { turns: [{ text: 'original evidence' }] }, payload: { answers: [{ roomName: 'Old room', answer: 'Legacy answer' }] } } };
    const operation = evaluate(`(async () => { ${block} })()`, {
      structuredClone, post: { id: 'post' }, projectId: 'project', oldName: 'Old room', newName: 'New room',
      tx: { projectPost: {
        findFirst: async () => ({ id: 'post', provenance, updatedAt: new Date(0) }),
        updateMany: async ({ where, data }) => {
          assert.equal(where.provenance.equals.interview.payload.answers[0].roomName, 'Old room', 'CAS snapshot must not be mutated while building renamed payload');
          assert.equal(data.provenance.interview.payload.answers[0].roomName, 'New room');
          assert.deepEqual(data.provenance.interview.guided, provenance.interview.guided);
          return { count: conflict ? 0 : 1 };
        },
      } },
    });
    if (conflict) await assert.rejects(operation, error => error.status === 409);
    else await operation;
  }
  console.log('PASS mixed legacy/guided room rename preserves history and fails CAS before a stale JSON replacement');
}

async function checkCompletionAuthorization() {
  const source = read('src/app/api/interview/complete/route.ts');
  for (const allowed of [false, true]) {
    let syncCalls = 0;
    const post = evaluate(namedFunction(source, 'POST') + '\nPOST', {
      legacyInterviewBoundary: async () => null, authOptions: {}, getServerSession: async () => ({ user: { id: 'actor' } }),
      RequestSchema: { safeParse: value => ({ success: true, data: value }) },
      assertProjectWrite: async (actor, project) => { assert.equal(actor, 'actor'); assert.equal(project, 'project'); if (!allowed) throw new Error('Forbidden'); },
      syncEditorialAnswersToProvenance: async () => { syncCalls++; throw Object.assign(new Error('Guided evidence retained'), { status: 409 }); },
      NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) },
    });
    const result = await post({ json: async () => ({ projectId: 'project' }) });
    assert.equal(result.status, allowed ? 409 : 403);
    assert.equal(syncCalls, allowed ? 1 : 0);
  }
  console.log('PASS legacy completion requires write permission and reports guided conflicts');
}

(async () => {
  await checkGenerationMetadata(); await checkSavedEvidenceRead(); await checkLegacySave(); await checkRealtime(); await checkFollowups();
  await checkResetRequestEpochs(); await checkQuestionCaches(); await checkReverseSync(); await checkForwardSync(); await checkRoomRename(); await checkCompletionAuthorization();
})().catch(error => { console.error(error); process.exitCode = 1; });

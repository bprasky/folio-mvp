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
  let authorizations = 0;
  const patch = evaluate(helper + '\npatchGenerationInterview', {
    assertProjectWrite: async (actorId, projectId) => { assert.equal(actorId, 'owner'); assert.equal(projectId, 'project'); authorizations++; },
    prisma: { projectPost: {
      findUnique: async () => ({ updatedAt: new Date(0), provenance: structuredClone(state) }),
      updateMany: async ({ where, data }) => {
        writes++;
        assert.ok(where.provenance.equals, 'CAS must include the JSON snapshot');
        if (writes === 1) {
          state.interview.guided = { version: 3, turns: [{ id: 'first' }, { id: 'accepted-during-save' }] };
          return { count: 0 };
        }
        state = data.provenance;
        return { count: 1 };
      },
    } },
  });
  await patch('project', 'owner', () => ({ status: { phase: 'idle' } }));
  assert.equal(writes, 2);
  assert.equal(authorizations, 1);
  assert.equal(state.interview.guided.version, 3);
  assert.equal(state.interview.guided.turns[1].id, 'accepted-during-save');
  assert.equal(state.interview.payload.answers.length, 0);
  assert.equal(state.unrelated, 'keep');
  assert.equal(state.interview.status.phase, 'idle');
  console.log('PASS generation metadata CAS retries without erasing a concurrent guided turn');
}

async function checkLegacySave() {
  const source = read(routeRoot + 'route.ts');
  const guidedGuard = between(source, 'const existingProvenance = (currentPost.provenance as any) || {};', '// Clearing is DESTRUCTIVE');
  const persistence = between(source, 'const saved = await prisma.$transaction(async (tx) => {', '// Calculate saved count');
  for (const mode of ['guided', 'race', 'projection-failure', 'progress-failure', 'legacy']) {
    const original = { provenance: { interview: { ...(mode === 'guided' ? { guided: { id: 'saved-guided-session' } } : {}), payload: { answers: ['old answer'] } } }, answers: ['old answer'], roomProgress: {} };
    let state = structuredClone(original);
    let transactionCount = 0;
    const writes = [];
    const nextProvenance = { interview: { payload: { answers: ['new answer'] } } };
    let tx;
    const context = {
      projectId: 'project', currentPost: { provenance: state.provenance, updatedAt: new Date(0) },
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
        assert.deepEqual(writes, mode === 'guided' ? [] : ['canonical']);
      }
    }
    assert.equal(transactionCount, mode === 'guided' ? 0 : 1);
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
    async function persist(guided, conflict = false) {
      let writes = 0;
      let captured;
      const provenance = { interview: { payload: { answers: [{ answer: 'saved' }] }, followUps: [], ...(guided ? { guided: { id: 'saved' } } : {}) } };
      const result = await evaluate(`(async () => { ${block} return { status: 200 }; })()`, {
        projectId: 'project', validated: { questionId: 'q1', roomId: 'room1', round: 1 },
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
    outcome = await persist(false);
    assert.equal(outcome.result.status, 200);
    assert.equal(outcome.writes, 1);
  }
  console.log('PASS all three legacy followup writers reject guided sessions and CAS races; ordinary writes preserve evidence');
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
  for (const mode of ['guided', 'race', 'legacy']) {
    let writes = 0;
    const provenance = { interview: { ...(mode === 'guided' ? { guided: { id: 'guided' } } : {}), payload: { answers: [] } } };
    const sync = evaluate(helper + '\nsyncEditorialAnswersToProvenance', {
      assertLegacyInterviewAllowed() {}, ALLOWED_SECTIONS: new Set(['what', 'how']),
      console: { log() {} },
      prisma: {
        editorialInterview: { findUnique: async () => ({ selectedQuestionIds: ['q1'], answers: [{ questionId: 'q1', questionText: 'Question', answerText: 'Answer', questionCategory: 'what', isFollowUp: false }] }) },
        project: { findUnique: async () => ({ images: [] }) },
        projectPost: {
          findUnique: async () => ({ provenance, updatedAt: new Date(0) }),
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
    assert.equal(writes, mode === 'guided' ? 0 : 1);
  }
  console.log('PASS reverse projection sync cannot replace guided evidence; ordinary categories survive');
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
  await checkGenerationMetadata(); await checkLegacySave(); await checkRealtime(); await checkFollowups();
  await checkQuestionCaches(); await checkReverseSync(); await checkRoomRename(); await checkCompletionAuthorization();
})().catch(error => { console.error(error); process.exitCode = 1; });

// Real route and reconciliation service; synthetic provider/DB boundaries only.
// Never loads .env files, credentials, user sessions, or external services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const env = { FOLIO_LIVE_INTERVIEWS: '0', FOLIO_INTERVIEW_RECORDING: '0', FOLIO_INTERVIEW_MEDIA_EXPORTS: '0' };
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, process: { env }, Date, console,
    require(name) {
      if (name in mocks) return mocks[name];
      if (name === 'node:crypto') return require(name);
      throw Error(`Unexpected import: ${name}`);
    },
  }, { filename: file });
  return exports;
}

(async () => {
  let failList = false, failDelete = false, transactionOpen = false, blockedGet = null;
  const limits = [], providerCalls = [], sessions = new Map(), conversations = new Map();
  const addSession = id => {
    sessions.set(id, { id, status: 'active', expiresAt: new Date(0),
      providerIds: { conversationId: id, palId: `pal-${id}` }, payload: { sealedJoin: 'private-token' } });
    conversations.set(id, { conversation_id: id, status: 'active' });
  };
  const store = {
    listLiveSessionsForCleanup: async limit => {
      limits.push(limit);
      if (failList) throw Error('private-database-credentials');
      return [...sessions.values()].filter(session => session.status !== 'ended').slice(0, limit);
    },
    getLiveSession: async id => structuredClone(sessions.get(id)),
    mutateLiveSession: async (id, change, options) => {
      assert.equal(options.cleanup, true, 'machine cleanup retains its explicit maintenance scope');
      transactionOpen = true;
      try {
        const draft = structuredClone(sessions.get(id));
        change(draft); sessions.set(id, draft); return structuredClone(draft);
      } finally { transactionOpen = false; }
    },
  };
  const providerCall = (method, id) => {
    assert.equal(transactionOpen, false, 'no provider request runs in a database transaction');
    providerCalls.push([method, id]);
  };
  class ProviderError extends Error {}
  const service = load('src/lib/live-interview/service.ts', {
    'server-only': {}, '@/lib/prisma': {}, '@/lib/rateLimit': {}, '@/lib/publishing-studio/data': {},
    '@/lib/interview-media/storage': {}, './adapters': {}, './config': {}, './turns': {}, './store': store,
    './provider': {
      ProviderError,
      getConversation: async id => {
        providerCall('get', id);
        if (blockedGet?.id === id) {
          const pending = blockedGet; blockedGet = null;
          pending.entered(); await pending.response;
        }
        return structuredClone(conversations.get(id));
      },
      endConversation: async id => { providerCall('end', id); conversations.get(id).status = 'ended'; },
      deletePal: async id => { providerCall('delete', id); if (failDelete) throw Error('private-provider-response'); },
    },
  });
  const route = load('src/app/api/cron/live-interviews/route.ts', {
    'next/server': { NextResponse: { json: (value, init) => Response.json(value, init) } },
    '@/lib/live-interview/service': service,
  });
  const invoke = authorization => route.GET(new Request('https://folio.test/api/cron/live-interviews', {
    headers: { ...(authorization ? { authorization } : {}), cookie: 'next-auth.session-token=cannot-authorize-cron' },
  }));
  const assertPrivate = response => assert.equal(response.headers.get('cache-control'), 'private, no-store');

  addSession('first'); addSession('second');
  for (const [secret, authorization] of [[undefined, undefined], [undefined, 'Bearer undefined'], ['', 'Bearer '], ['expected', undefined], ['expected', 'Bearer wrong']]) {
    if (secret === undefined) delete env.CRON_SECRET; else env.CRON_SECRET = secret;
    const response = await invoke(authorization);
    assert.equal(response.status, 401); assertPrivate(response);
    assert.deepEqual(await response.json(), { error: 'Unauthorized.' });
  }
  assert.equal(limits.length, 0, 'missing/incorrect secret cannot even select cleanup work');
  assert.equal(providerCalls.length, 0);
  env.CRON_SECRET = 'expected';
  let response = await invoke('Bearer expected');
  assert.equal(response.status, 200); assertPrivate(response);
  assert.deepEqual(await response.json(), { ok: true, checked: 1 });
  assert.deepEqual(limits, [1], 'cron caps the existing cleanup service at one session');
  assert.equal(sessions.get('first').status, 'ended');
  assert.equal(sessions.get('first').payload.sealedJoin, undefined);
  assert.equal(sessions.get('second').status, 'active', 'remaining sessions wait for later invocations');
  assert(providerCalls.some(([method]) => method === 'end'), 'flags-off cleanup still ends the provider call');

  failDelete = true;
  response = await invoke('Bearer expected');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, checked: 1 });
  assert.equal(sessions.get('second').status, 'uncertain', 'provider cleanup failure retains the existing retry reservation');
  assert(!JSON.stringify(sessions.get('second')).includes('private-provider-response'));
  failDelete = false;
  response = await invoke('Bearer expected');
  assert.equal(response.status, 200);
  assert.equal(sessions.get('second').status, 'ended', 'next invocation retries unfinished cleanup');
  const ends = providerCalls.filter(([method]) => method === 'end').length;
  response = await invoke('Bearer expected');
  assert.deepEqual(await response.json(), { ok: true, checked: 0 });
  assert.equal(providerCalls.filter(([method]) => method === 'end').length, ends, 'completed sessions do not restart paid/provider work');

  addSession('overlap');
  let entered, rejectProvider;
  const providerEntered = new Promise(resolve => { entered = resolve; });
  blockedGet = { id: 'overlap', entered, response: new Promise((_, reject) => { rejectProvider = reject; }) };
  const slowAttempt = invoke('Bearer expected');
  await providerEntered;
  const successfulAttempt = await invoke('Bearer expected');
  assert.equal(successfulAttempt.status, 200);
  assert.equal(sessions.get('overlap').status, 'ended');
  assert.equal(sessions.get('overlap').payload.cleanupStage, 'complete');
  rejectProvider(Error('late-private-provider-error'));
  assert.equal((await slowAttempt).status, 200);
  assert.equal(sessions.get('overlap').status, 'ended', 'a late failure cannot downgrade successful overlapping cleanup');
  assert.equal(sessions.get('overlap').payload.cleanupStage, 'complete');
  assert.equal(sessions.get('overlap').payload.sealedJoin, undefined, 'overlap cannot restore joining credentials');
  assert.equal(sessions.get('overlap').payload.notice, undefined, 'late failure cannot replace completion with a pending notice');
  const afterOverlap = providerCalls.length;
  await service.reconcileLiveSession('overlap');
  assert.equal(providerCalls.length, afterOverlap, 'terminal sessions perform no further provider work');

  failList = true;
  response = await invoke('Bearer expected');
  assert.equal(response.status, 503); assertPrivate(response);
  assert.deepEqual(await response.json(), { error: 'Live interview cleanup is temporarily unavailable.' });
  failList = false;
  await service.cleanupLiveSessions();
  assert.equal(limits.at(-1), 100, 'CLI callers retain their existing default batch');
  assert.equal(route.runtime, 'nodejs');
  assert.equal(route.dynamic, 'force-dynamic');
  assert.equal(route.maxDuration, 800);
  const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  assert.deepEqual(config.crons.filter(job => job.path === '/api/cron/live-interviews'), [{ path: '/api/cron/live-interviews', schedule: '* * * * *' }]);
  assert.equal(config.git.deploymentEnabled, false);
  assert.equal(config.buildCommand, 'prisma generate && next build');
  assert(fs.readFileSync('.github/workflows/lint.yml', 'utf8').includes('node scripts/check-live-cleanup.cjs'));
  console.log('PASS scheduled live cleanup: fail-closed bearer auth, flags-off cleanup, one-session batch, retry/idempotency, concurrent completion, generic errors and minutely wiring.');
})().catch(error => { console.error(error); process.exitCode = 1; });

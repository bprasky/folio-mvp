// Actual Prisma/PostgreSQL regression inside test-spotlight-private's isolated
// database. No provider calls; do not run against a configured application DB.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
const { PrismaClient } = require('@prisma/client');

const url = new URL(process.env.DATABASE_URL);
assert.equal(url.hostname, 'localhost');
assert.match(url.searchParams.get('host'), /^\/tmp\/folio-private-[^/]+\/socket$/);
assert.equal(url.pathname, '/' + process.env.FOLIO_TEST_DATABASE);
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const tests = [];
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
let holdInsert;
// Only pause after an actual INSERT to expose the live transaction to a second
// actual reservation. Every query and transaction still goes through Prisma.
const storeDb = { $transaction: work => prisma.$transaction(tx => work(new Proxy(tx, {
  get(target, name) {
    if (name === '$queryRaw') return async (strings, ...values) => {
      const result = await target.$queryRaw(strings, ...values);
      if (holdInsert && strings.join('').trim().startsWith('INSERT INTO live_interview_sessions')) {
        const gate = holdInsert; holdInsert = undefined;
        gate.inserted.resolve(); await gate.release.promise;
      }
      return result;
    };
    return typeof target[name] === 'function' ? target[name].bind(target) : target[name];
  },
})), { timeout: 15000 }) };
const moduleValue = { exports: {} };
const mocks = { 'server-only': {}, '@/lib/prisma': { prisma: storeDb }, '@/lib/permissions': { normalizeRole: role => role.toUpperCase() } };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/live-interview/store.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: moduleValue.exports, module: moduleValue, require: name => {
  assert.ok(name in mocks, `Unexpected store dependency: ${name}`); return mocks[name];
}, structuredClone, Date });
const live = moduleValue.exports;
async function test(name, run) { await run(); tests.push({ name, result: 'passed' }); console.log('PASS ' + name); }
async function waitForBlockedReservation(blockedCount = 1) {
  const deadline = Date.now() + 5000;
  do {
    const rows = await prisma.$queryRaw`SELECT granted FROM pg_locks WHERE locktype='advisory' AND classid=0 AND objid=73119401 AND objsubid=1 AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`;
    if (rows.some(row => row.granted) && rows.filter(row => !row.granted).length >= blockedCount) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  } while (Date.now() < deadline);
  assert.fail('Second reservation did not wait on the actual transaction advisory lock');
}
async function main() {
  const [binding] = await prisma.$queryRaw`SELECT current_database() AS db, current_setting('folio.test_nonce') AS nonce, (SELECT system_identifier::text FROM pg_control_system()) AS system, inet_server_addr() AS address`;
  assert.equal(binding.db, process.env.FOLIO_TEST_DATABASE);
  assert.equal(binding.nonce, process.env.FOLIO_TEST_NONCE);
  assert.equal(binding.system, process.env.FOLIO_TEST_SYSTEM_ID);
  assert.equal(binding.address, null);
  const actorId = randomUUID(), deniedId = randomUUID(), contributorId = randomUUID();
  for (const [id, role] of [[actorId, 'DESIGNER'], [deniedId, 'HOMEOWNER'], [contributorId, 'DESIGNER']]) {
    await prisma.user.create({ data: { id, role, name: 'Live reservation fixture', email: `${id}@example.invalid`, passwordHash: 'fixture-not-a-login', specialties: [], desiredRooms: [] } });
  }
  const request = (extra = {}) => ({ id: randomUUID(), actorId, sourceType: 'designer_bio', sourceId: actorId, canonicalId: actorId,
    status: 'starting', credentialHash: randomUUID(), expiresAt: new Date(Date.now() + 60000), providerIds: {}, payload: { startRequestId: randomUUID() }, ...extra });
  const limits = { maxActive: 1, maxDailyActor: 5 };
  let first;
  await test('Actual Prisma reservation serializes concurrent starts and reuses one committed session', async () => {
    const gate = { inserted: deferred(), release: deferred() }; holdInsert = gate;
    const initial = request();
    const pending = live.createLiveSession(initial, limits);
    // Propagate a SQL failure immediately instead of waiting for a never-reached INSERT.
    await Promise.race([gate.inserted.promise, pending.then(() => { throw Error('Reservation completed before hold'); })]);
    const competing = live.createLiveSession(request(), limits);
    const reservations = Promise.all([pending, competing]);
    // Preserve immediate query failures while observing the actual lock wait.
    const failed = reservations.then(() => { throw Error('Reservations completed before lock release'); });
    let observed;
    try { await Promise.race([waitForBlockedReservation(), failed]); }
    catch (error) { observed = error; }
    finally { gate.release.resolve(); }
    const results = await reservations;
    if (observed) throw observed;
    assert.equal(results[0].created, true); assert.equal(results[1].created, false);
    assert.equal(results[0].session.id, results[1].session.id); first = results[0].session;
    assert.equal(await prisma.liveInterviewSession.count({ where: { actorId } }), 1);
    const retry = await live.createLiveSession({ ...initial, id: randomUUID() }, limits);
    assert.equal(retry.created, false); assert.equal(retry.session.id, first.id);
  });
  await test('Quota rollback releases the transaction lock and preserves the existing session', async () => {
    await assert.rejects(live.createLiveSession(request({ sourceType: 'project', sourceId: randomUUID() }), limits), error => error.status === 429);
    assert.equal(await prisma.liveInterviewSession.count({ where: { actorId } }), 1);
    const [lock] = await prisma.$transaction(tx => tx.$queryRaw`SELECT pg_try_advisory_xact_lock(73119401) AS acquired`);
    assert.equal(lock.acquired, true);
  });
  await test('Disallowed actor roles cannot reserve a live interview', async () => {
    await assert.rejects(live.createLiveSession(request({ actorId: deniedId, sourceId: deniedId }), limits), error => error.status === 403);
    assert.equal(await prisma.liveInterviewSession.count({ where: { actorId: deniedId } }), 0);
  });
  for (const [firstKind, competingKind] of [['project', 'project_guide'], ['project_guide', 'project']]) {
    await test(`Actual Prisma ${firstKind} reservation excludes concurrent ${competingKind} calls from either actor`, async () => {
      const gate = { inserted: deferred(), release: deferred() }; holdInsert = gate;
      const projectId = randomUUID(), aliasLimits = { maxActive: 10, maxDailyActor: 10 };
      const firstCall = live.createLiveSession(request({ sourceType: firstKind, sourceId: projectId }), aliasLimits);
      await Promise.race([gate.inserted.promise, firstCall.then(() => { throw Error('Reservation completed before hold'); })]);
      const sameActor = live.createLiveSession(request({ sourceType: competingKind, sourceId: projectId }), aliasLimits);
      const otherActor = live.createLiveSession(request({ actorId: contributorId, sourceType: competingKind, sourceId: projectId }), aliasLimits);
      // Capture all rejections before observing the real lock wait. A precheck
      // without the transaction lock would incorrectly insert a second row.
      const outcomes = Promise.allSettled([firstCall, sameActor, otherActor]);
      let observed;
      try { await waitForBlockedReservation(2); }
      catch (error) { observed = error; }
      finally { gate.release.resolve(); }
      const results = await outcomes;
      if (observed) throw observed;
      assert.equal(results[0].status, 'fulfilled'); assert.equal(results[0].value.created, true);
      for (const result of results.slice(1)) { assert.equal(result.status, 'rejected'); assert.equal(result.reason.status, 409); }
      const rows = await prisma.liveInterviewSession.findMany({ where: { sourceId: projectId } });
      assert.equal(rows.length, 1); assert.equal(rows[0].sourceType, firstKind); assert.equal(rows[0].actorId, actorId);
    });
  }
  await test('Daily allowance counts provider calls, excludes confirmed pre-provider failures and reports reset time', async () => {
    await prisma.liveInterviewSession.updateMany({ where: { actorId }, data: { status: 'failed', providerIds: {} } });
    const dailyLimits={maxActive:10,maxDailyActor:1};
    const a=await live.createLiveSession(request({sourceId:randomUUID()}),dailyLimits);
    assert.equal(a.created,true,'confirmed failures did not consume the daily allowance');
    await prisma.liveInterviewSession.update({where:{id:a.session.id},data:{status:'ended',providerIds:{conversationId:'synthetic-paid-conversation'}}});
    await assert.rejects(live.createLiveSession(request({sourceId:randomUUID()}),dailyLimits),error=>{
      assert.equal(error.code,'LIVE_DAILY_LIMIT');assert.equal(error.status,429);
      assert.equal(Date.parse(error.retryAt),a.session.createdAt.getTime()+86400000);return true;
    });
    await prisma.liveInterviewSession.update({where:{id:a.session.id},data:{createdAt:new Date(Date.now()-86401000)}});
    assert.equal((await live.createLiveSession(request({sourceId:randomUUID()}),dailyLimits)).created,true);
  });
  await prisma.user.deleteMany({ where: { id: { in: [actorId, deniedId, contributorId] } } });
}
main().then(() => fs.writeFileSync('tasks/spotlight-private-live-store.json', JSON.stringify({ status: 'passed', tests }, null, 2) + '\n'))
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

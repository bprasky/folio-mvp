const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { fork } = require('node:child_process');
const { resolve } = require('node:path');
const h = require('./harness.cjs');
const { factories } = require('./fixtures.cjs');
const { PrismaClient } = require('@prisma/client');
if (!h.target) throw Error('CORE_TEST_DATABASE_URL and explicit disposable acknowledgement are required; this suite never skips');

function worker() {
  const env = { ...process.env }; delete env.DATABASE_URL; delete env.DIRECT_URL;
  const child = fork(resolve('scripts/core/rollout-worker.cjs'), [], { env, execArgv: ['--import', 'tsx'], stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true });
  const pending = new Map();
  let waiting = false, notifyWaiting;
  const ready = new Promise((resolveReady, reject) => {
    child.once('error', reject); child.once('exit', code => reject(Error(`Worker exited ${code}`)));
    child.on('message', message => { if (message.ready) resolveReady(); else if (message.waiting) { waiting = true; notifyWaiting?.(); } else { const resolveJob = pending.get(message.key); pending.delete(message.key); resolveJob?.(message); } });
  });
  return { stop: () => child.disconnect(), release: () => { waiting = false; child.send({ action: 'release' }); },
    paused: () => waiting ? Promise.resolve() : new Promise((resolvePause, reject) => {
      const timer = setTimeout(() => reject(Error('Worker did not reach provider boundary')), 30000);
      notifyWaiting = () => { clearTimeout(timer); resolvePause(); };
    }), run: async job => {
    await ready; const key = randomUUID();
    return new Promise((resolveJob, reject) => {
      const timer = setTimeout(() => reject(Error('Database worker timed out')), 30000);
      pending.set(key, value => { clearTimeout(timer); resolveJob(value); }); child.send({ ...job, key });
    });
  } };
}

test('rollout independent PostgreSQL workers: atomic credits, creation identity, tag/selection consistency and cascades', { timeout: 120000 }, async t => {
  const db = new PrismaClient({ datasources: { db: { url: h.target } } }); h.useDatabase(db);
  const f = factories(db), a = await f.user(), b = await f.user(), org = await f.organization();
  await f.membership(a.id, org.id); await f.membership(b.id, org.id);
  const left = worker(), right = worker(); const prefix = `rollout-${randomUUID()}`;
  const requestId = randomUUID(), payload = { title: prefix, projectStatus: 'new_project', credits: [{ role: 'Architect', name: 'Fixture collaborator' }] };
  let project, roomA, roomB, firstImage, secondImage, tag, selection;
  try {
    await t.test('simultaneous project creates have one committed project and one credit record; lost acknowledgement replays', async () => {
      const job = { action: 'project', actorId: a.id, orgId: org.id, requestId, payload };
      const results = await Promise.all([left.run(job), right.run(job)]);
      results.forEach(value => assert.equal(value.error, undefined, value.error));
      assert.notEqual(results[0].pid, results[1].pid, 'different backend connections');
      assert.equal(results[0].result.id, results[1].result.id);
      project = await db.project.findUniqueOrThrow({ where: { id: results[0].result.id } });
      assert.equal(await db.project.count({ where: { title: prefix } }), 1);
      assert.equal(await db.projectPost.count({ where: { projectId: project.id } }), 1);
      assert.deepEqual((await db.projectPost.findUnique({ where: { projectId: project.id } })).credits, payload.credits);
      assert.equal((await left.run(job)).result.id, project.id);
      const conflict = await right.run({ ...job, payload: { ...payload, title: prefix + ' changed' } });
      assert.match(conflict.error, /different details/); assert.equal(conflict.id, project.id);
      assert.equal(await db.project.count({ where: { title: prefix + ' changed' } }), 0);
      const separate = await right.run({ ...job, requestId: randomUUID() });
      assert.notEqual(separate.result.id, project.id, 'same title may be a separate intentional creation');
      const otherActor = await right.run({ ...job, actorId: b.id });
      assert.notEqual(otherActor.result.id, project.id, 'actor-scoped identity');
    });
    await t.test('credit failure rolls the project back; same request succeeds after recovery', async () => {
      // A real PostgreSQL constraint trigger, not a mocked create failure.
      await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION rollout_reject_credit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.credits::text LIKE '%rollout-force-rollback%' THEN RAISE EXCEPTION 'rollout forced credit failure'; END IF; RETURN NEW; END $$`);
      await db.$executeRawUnsafe(`CREATE TRIGGER rollout_credit_failure BEFORE INSERT ON project_posts FOR EACH ROW EXECUTE FUNCTION rollout_reject_credit()`);
      const badPayload = { ...payload, title: prefix + ' rollback', credits: [{ role: 'Architect', name: 'rollout-force-rollback' }] };
      const job = { action: 'project', actorId: a.id, orgId: org.id, requestId: randomUUID(), payload: badPayload };
      try {
        assert.match((await left.run(job)).error, /rollout forced credit failure/);
        assert.equal(await db.project.count({ where: { title: badPayload.title } }), 0);
      } finally { await db.$executeRawUnsafe('DROP TRIGGER rollout_credit_failure ON project_posts'); await db.$executeRawUnsafe('DROP FUNCTION rollout_reject_credit()'); }
      const retried = await right.run(job); assert.equal(retried.error, undefined, retried.error);
      assert.equal(await db.projectPost.count({ where: { projectId: retried.result.id } }), 1);
    });
    await t.test('room retries coalesce across workers; changed payload conflicts; a fresh operation allows the same name', async () => {
      const job = { action: 'room', actorId: a.id, projectId: project.id, payload: { name: 'Living', requestId: randomUUID() } };
      const values = await Promise.all([left.run(job), right.run(job)]);
      values.forEach(value => assert.equal(value.error, undefined, value.error));
      assert.equal(values[0].result.id, values[1].result.id); roomA = values[0].result;
      assert.equal(await db.room.count({ where: { projectId: project.id } }), 1);
      assert.match((await right.run({ ...job, payload: { ...job.payload, name: 'Kitchen' } })).error, /different details/);
      roomB = (await right.run({ ...job, payload: { ...job.payload, requestId: randomUUID() } })).result;
      assert.notEqual(roomA.id, roomB.id);
    });
    await t.test('competing tag moves commit one location and its linked selection; stale and bare requests cannot overwrite', async () => {
      firstImage = await f.image(project.id, { roomId: roomA.id }); secondImage = await f.image(project.id, { roomId: roomB.id, url: 'https://storage.test/second.jpg' });
      const product = await f.product();
      tag = await db.productTag.create({ data: { imageId: firstImage.id, productId: product.id, x: 10, y: 20 } });
      selection = await db.selection.create({ data: { projectId: project.id, roomId: roomA.id, productTagId: tag.id, productName: product.name, photo: firstImage.url } });
      const expected = { imageId: firstImage.id, x: 10, y: 20 };
      const job = { action: 'tag', actorId: a.id, payload: { id: tag.id, imageId: secondImage.id, x: 30, y: 40, expected } };
      const values = await Promise.all([left.run(job), right.run({ ...job, payload: { ...job.payload, x: 70 } })]);
      assert.deepEqual(values.map(value => value.result.status).sort(), [200, 409]);
      const saved = await db.productTag.findUniqueOrThrow({ where: { id: tag.id } });
      const linked = await db.selection.findUniqueOrThrow({ where: { id: selection.id } });
      assert.equal(linked.roomId, roomB.id); assert.equal(linked.photo, secondImage.url);
      assert.equal((await db.projectImage.findUnique({ where: { id: secondImage.id } })).noProducts, false);
      assert.equal((await left.run({ ...job, payload: { id: tag.id, x: 99, y: 99 } })).result.status, 428);
      assert.equal((await left.run({ ...job, payload: { ...job.payload, x: saved.x } })).result.status, 200, 'identical uncertain-result retry');
      await right.run({ action: 'image-room', projectId: project.id, imageId: secondImage.id, roomId: null });
      assert.equal((await db.selection.findUnique({ where: { id: selection.id } })).roomId, null);
      assert.equal(await db.selection.count({ where: { productTagId: tag.id } }), 1);
    });
    await t.test('selection-write failure rolls back the tag and target review state', async () => {
      const destination = await f.image(project.id, { url: 'https://storage.test/rollback-target.jpg', roomId: roomA.id });
      const before = await db.productTag.findUniqueOrThrow({ where: { id: tag.id } });
      await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION rollout_reject_selection() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.photo LIKE '%rollback-target.jpg' THEN RAISE EXCEPTION 'rollout forced selection failure'; END IF; RETURN NEW; END $$`);
      await db.$executeRawUnsafe(`CREATE TRIGGER rollout_selection_failure BEFORE UPDATE ON selections FOR EACH ROW EXECUTE FUNCTION rollout_reject_selection()`);
      try {
        const failed = await left.run({ action: 'tag', actorId: a.id, payload: { id: tag.id, imageId: destination.id, expected: { imageId: before.imageId, x: before.x, y: before.y } } });
        assert.equal(failed.result.status, 500);
        assert.deepEqual(await db.productTag.findUnique({ where: { id: tag.id } }), before);
        assert.equal((await db.projectImage.findUnique({ where: { id: destination.id } })).noProducts, true);
      } finally { await db.$executeRawUnsafe('DROP TRIGGER rollout_selection_failure ON selections'); await db.$executeRawUnsafe('DROP FUNCTION rollout_reject_selection()'); }
    });
    await t.test('competing generators: expired worker cannot save over or unlock a newer lease', async () => {
      await h.login(a);
      const context = { params: { projectId: project.id } };
      let response = await h.route('posting/project/[projectId]/init').POST(h.request({}), context);
      assert.equal(response.status, 200, await response.text());
      const answers = ['We moved the doorway to bring the garden into view.', 'The oak chair gives us a place to read in the afternoon.', 'The room is arranged around a quiet route through the house.'].map((answer, i) => ({ questionId: 'race-q-' + i, question: 'What changed in this room?', answer, section: 'designIntent', role: 'DESIGNER', roomId: roomA.id }));
      response = await h.route('posting/project/[projectId]/interview').POST(h.request({ answers, selectedQuestionIds: answers.map(answer => answer.questionId) }), context);
      assert.equal(response.status, 200, await response.text());
      const narrative = 'The doorway now faces the garden. A chair sits beside the opening, leaving a clear route through the room. The designer arranged this place for reading in afternoon light. The change follows the daily pattern described in the interview.';
      const article = { lead: { title: 'A Door Opens Toward the Garden', kicker: 'A Door Opens Toward the Garden', deck: 'A changed doorway brings afternoon reading closer to the garden.' }, sections: [0, 1, 2].map(() => ({ type: 'narrative', heading: 'Living', body: narrative })), galleryChapters: [{ title: 'Living', imageIds: [firstImage.id], body: [narrative, narrative] }], pullQuotes: [], credits: [] };
      const job = { action: 'generate', actorId: a.id, projectId: project.id, article, hold: true };
      const oldRun = left.run(job); await Promise.race([left.paused(), oldRun.then(result => { throw Error('Old worker returned before provider boundary: ' + JSON.stringify(result)); })]);
      const oldPost = await db.projectPost.findUniqueOrThrow({ where: { projectId: project.id } });
      assert.equal(oldPost.provenance.interview.status.phase, 'generating');
      const probe = worker();
      try { assert.equal((await probe.run({ ...job, hold: false })).result.status, 202, 'force respects a live owner'); } finally { probe.stop(); }
      const expired = structuredClone(oldPost.provenance); expired.interview.status.startedAt = Date.now() - 901000;
      await db.projectPost.update({ where: { id: oldPost.id }, data: { provenance: expired } });
      const newRun = right.run(job); await Promise.race([right.paused(), newRun.then(result => { throw Error('New worker returned before provider boundary: ' + JSON.stringify(result)); })]);
      const newer = await db.projectPost.findUniqueOrThrow({ where: { id: oldPost.id } });
      assert.notEqual(newer.provenance.interview.status.requestId, oldPost.provenance.interview.status.requestId);
      left.release(); const oldResult = await oldRun;
      assert.equal(oldResult.result.status, 409, JSON.stringify(oldResult));
      const afterOld = await db.projectPost.findUniqueOrThrow({ where: { id: oldPost.id } });
      assert.deepEqual(afterOld.provenance.interview.status, newer.provenance.interview.status, 'old finally block cannot unlock new owner');
      assert.deepEqual(afterOld.expandedBlocks, oldPost.expandedBlocks, 'old worker cannot persist output');
      right.release(); const newResult = await newRun;
      assert.equal(newResult.result.status, 200, JSON.stringify(newResult));
      const completed = await db.projectPost.findUniqueOrThrow({ where: { id: oldPost.id } });
      assert.notEqual(completed.provenance.interview.status?.phase, 'generating');
      assert.ok(completed.provenance.interview.generatedAt); assert.ok(completed.expandedBlocks.galleryChapters.length);
    });
    await t.test('project deletion cascades through rooms, tags, images, linked selections and credits', async () => {
      await require('../../src/lib/spotlight/deletion.ts').deleteProjectWithSpotlightGuard(project.id);
      for (const [model, where] of [['room', { projectId: project.id }], ['projectImage', { projectId: project.id }], ['selection', { projectId: project.id }], ['projectPost', { projectId: project.id }], ['productTag', { id: tag.id }]]) assert.equal(await db[model].count({ where }), 0, model);
    });
  } finally {
    left.stop(); right.stop();
    await db.project.deleteMany({ where: { designerOrgId: org.id } });
    await db.organization.delete({ where: { id: org.id } });
    await db.user.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    await db.$disconnect();
  }
});

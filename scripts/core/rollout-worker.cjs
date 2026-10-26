// Independent process/Prisma pool for disposable-database race verification.
const h = require('./harness.cjs');
if (!h.target) throw Error('Disposable PostgreSQL is required');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient({ datasources: { db: { url: h.target } } });
h.useDatabase(db);
let activeKey, hold, held, releaseProvider;
const Fixture = require('@anthropic-ai/sdk');
class PausedFixture extends Fixture {
  constructor(...args) {
    super(...args); const original = this.messages.create;
    this.messages.create = async input => {
      if (hold && !held) {
        held = true; process.send({ waiting: activeKey });
        await new Promise(resolve => { releaseProvider = resolve; });
      }
      return original(input);
    };
  }
}
require.cache[require.resolve('@anthropic-ai/sdk')].exports = PausedFixture;
process.on('message', async job => {
  if (job.action === 'release') { releaseProvider?.(); return; }
  activeKey = job.key; hold = !!job.hold; held = false;
  try {
    const [{ pid }] = await db.$queryRawUnsafe('SELECT pg_backend_pid() AS pid');
    let result;
    if (job.action === 'project') result = await require('../../src/lib/projects/createProject.ts').createProjectOnce(job.actorId, job.orgId, job.requestId, job.payload);
    else if (job.action === 'room') result = await require('../../src/lib/projects/createRoom.ts').createRoomOnce(job.actorId, job.projectId, job.payload);
    else if (job.action === 'tag') {
      await h.login(await db.user.findUniqueOrThrow({ where: { id: job.actorId } }));
      const response = await h.route('tag-product-to-image').PATCH(h.request(job.payload, 'PATCH'));
      result = { status: response.status, body: await response.json() };
    } else if (job.action === 'image-room') {
      result = await require('../../src/lib/projects/updateImageRoom.ts').updateImageRoom(job.projectId, job.imageId, job.roomId);
    } else if (job.action === 'generate') {
      await h.login(await db.user.findUniqueOrThrow({ where: { id: job.actorId } }));
      h.setArticle(job.article);
      const response = await h.route('posting/project/[projectId]/interview/generate').POST(h.request({ forceOverwriteDraft: true, includeBio: false, includeProjectHistory: false }), { params: { projectId: job.projectId } });
      result = { status: response.status, body: await response.json() };
    } else throw Error('Unknown worker action');
    process.send({ key: job.key, pid, result });
  } catch (error) { process.send({ key: job.key, error: error.message, code: error.code, id: error.id }); }
});
process.on('disconnect', async () => { await db.$disconnect(); process.exit(0); });
process.send({ ready: true });

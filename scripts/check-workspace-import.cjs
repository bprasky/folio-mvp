// Real routes, extraction, worker, project creation and review with bounded external doubles.
// Import rows use PGlite/PostgreSQL JSONB for real CAS behavior. Other models are orchestration
// doubles: this does not claim deployed cron, real provider delivery or Prisma transaction proof.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const { memoryDatabase } = require('./core/memory-db.cjs');
const { randomUUID, createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
let db, pg, authUser = 'owner', now = Date.now(), sendFails = false, sends = [], generations = 0, pageCalls = [];
const env = { CRON_SECRET: 'synthetic-cron', RESEND_API_KEY: 'synthetic-resend', ANTHROPIC_ENABLED: 'false', NEXTAUTH_URL: 'https://folio.test' };
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
const html = {
  '/': '<html><header><img src="/logo.png" alt="Studio logo"></header><main><h1>North Studio</h1><p>A small architecture practice creating thoughtful places for everyday life.</p><a href="/about">About</a><a href="/work">Projects</a><a href="/team/jane">Jane Designer</a></main></html>',
  '/about': '<main><h1>About North Studio</h1><p>We are an architecture practice shaped by light, materials, and the way people live.</p></main>',
  '/team/jane': '<main><h1>Jane Designer</h1><p>Jane studied architecture and established a practice focused on generous, adaptable homes.</p></main>',
  '/work': '<main><a href="/work/harbor">Harbor House</a><a href="/work/court">Court House</a></main>',
  '/work/harbor': '<main><h1>Harbor House</h1><p>The home opens toward the harbor through a sequence of bright, connected rooms.</p><img src="/harbor.png" alt="Harbor living room"></main>',
  '/work/court': '<main><h1>Court House</h1><p>A quiet courtyard brings daylight into the center of this home in the city.</p><img src="/court.png" alt="Courtyard"></main>',
};
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3foAAAAASUVORK5CYII=', 'base64');
let failedPage;
const cache = new Map();
const facade = new Proxy({}, { get: (_, key) => typeof db[key] === 'function' ? db[key].bind(db) : db[key] });
const contextHash = async id => {
  const project = await db.project.findUniqueOrThrow({ where: { id } });
  const images = await db.projectImage.findMany({ where: { projectId: id } });
  return createHash('sha256').update(JSON.stringify([project.title, project.description, images.map(i => [i.id, i.roomId])])).digest('hex');
};
const guidedStore = {
  objectValue: value => value && typeof value === 'object' && !Array.isArray(value) ? value : {},
  ensureGuidedPost: async (projectId, userId) => {
    assert.equal((await db.project.findUniqueOrThrow({ where: { id: projectId } })).ownerId, userId);
    return await db.projectPost.findUnique({ where: { projectId } }) || db.projectPost.create({ data: { projectId, slug: projectId, status: 'DRAFT' } });
  },
};
function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, {
    exports, process: { env }, console, Error, Date: Clock, URL, URLSearchParams, Request, Response, Buffer, structuredClone, setTimeout, clearTimeout,
    fetch: () => { throw Error('Unexpected network request'); },
    require(name) {
      if (name.startsWith('.')) name = '@/' + path.relative(path.resolve('src'), path.resolve(path.dirname(file), name)).replaceAll('\\', '/');
      if (name === '@/lib/prisma') return { prisma: facade };
      if (name === 'server-only') return {};
      if (name === '@/lib/spotlight/legacyBoundary') return { assertLegacyInterviewAllowed: () => {} };
      if (name === '@/lib/interview') return { ...load('src/lib/interview/generateQuestions.ts'), getContextLevelDescription: () => 'Synthetic context', getContextUpgradeSuggestion: () => null };
      if (name === '@/lib/interview/contextLevel') return { assessProjectContext: async id => { const p = await db.project.findUniqueOrThrow({ where: { id } }); return { projectTitle: p.title, projectDescription: p.description, level: 1, rooms: [], materialThemes: [], projectSize: {} }; } };
      if (name === '@/lib/interview/generateAllRoomQuestions' || name === '@/lib/interview/distillInterviewFacts') return {};
      if (name === '@/lib/interview/generateProjectQuestions') return { generateProjectQuestions: async () => { throw Error('Cached opening questions must not call a new generator'); }, buildFallbackProjectQuestions: () => { throw Error('Expected the saved opening plan'); } };
      if (name === 'next-auth') return { getServerSession: async () => authUser ? { user: { id: authUser } } : null };
      if (name === '@/app/api/auth/[...nextauth]/options') return {};
      if (name === 'next/server') return { NextResponse: Response };
      if (name === '@/lib/server/render-product') return { hasRenderWorker: () => false };
      if (name === '@/lib/server/safe-product-url') return {
        validateProductUrl: async url => { assert.equal(new URL(url).hostname, 'studio.test'); }, parseProductUrl: url => new URL(url),
        safeProductResource: async url => {
          pageCalls.push(url); const pathname = new URL(url).pathname;
          if (failedPage === pathname) throw Error('Synthetic unavailable page');
          if (pathname.endsWith('.png')) return { status: 200, headers: { 'content-type': 'image/png' }, body: png };
          return { status: html[pathname] ? 200 : 404, headers: { 'content-type': 'text/html' }, body: Buffer.from(html[pathname] || '') };
        },
      };
      if (name === '@/lib/storage') return { saveBufferToProjectStorage: async ({ projectId, storageId }) => ({ publicUrl: `/api/project-photos/${projectId}/${storageId}` }) };
      if (name === '@/lib/posting/slug') return { makeSlug: (_title, id) => id };
      if (name === '@/lib/authz/access') return { assertProjectWrite: async (actor, id) => assert.equal((await db.project.findUniqueOrThrow({ where: { id } })).ownerId, actor) };
      if (name === '@/lib/interview/guided/store') return guidedStore;
      if (name === '@/lib/interview/guided/preparation') return {
        readGuidedContext: async id => ({ contextFingerprint: await contextHash(id) }),
        prepareGuidedProjectPlan: async id => { generations++; return { contextFingerprint: await contextHash(id), rooms: [], minimumTotalAnswers: 3,
          questions: ['CLIENT_BRIEF', 'SCOPE_PARAMETERS', 'DESIGN_DIRECTION', 'SIGNATURE_IDENTITY', 'SURPRISE_PIVOT'].map((category, i) => ({ id: String(i), text: ['What did the clients hope to create?', 'What defined the scope of this project?', 'What guided the design?', 'Which detail feels most like your work?', 'What discovery shaped this project?'][i], category, roomId: null, sourceImageIds: [], sourceAnswerIds: [], status: 'pending', kind: 'prepared' })) }; },
      };
      if (name === '@/lib/designer-bio/questions') return { generateWebsiteContextQuestions: async () => [{ id: 'bio-1', question: 'What shaped your practice?', round: 'base' }] };
      if (name === '@/lib/email/sendEmail') return { sendEmail: async message => {
        const row = (await db.importSession.findMany()).find(row => message.idempotencyKey.endsWith(row.id));
        assert.ok(row.processingMeta.notification.firstAttemptAt, 'send time must be durable before provider call');
        assert.deepEqual(row.processingMeta.notification.message, { to: message.to, subject: message.subject, html: message.html });
        sends.push(message); return { success: !sendFails };
      } };
      if (name.startsWith('@/')) return load(path.resolve('src', name.slice(2)) + '.ts');
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
      return require(name);
    },
  }, { filename: file });
  return exports;
}
const store = load('src/lib/workspace-import/store.ts');
const processor = load('src/lib/workspace-import/processor.ts');
const review = load('src/lib/workspace-import/review.ts');
const prepared = load('src/lib/workspace-import/prepared.ts');
const startRoute = load('src/app/api/onboarding/workspace/route.ts');
const detailRoute = load('src/app/api/onboarding/workspace/[id]/route.ts');
const extraction = load('src/lib/workspace-import/extract.ts');
const json = value => JSON.parse(JSON.stringify(value));
function whereSql(where = {}, values = []) {
  const terms = [];
  for (const [key, value] of Object.entries(where)) {
    if (key === 'AND') { for (const part of value) terms.push(whereSql(part, values).sql); }
    else if (key === 'processingMeta') {
      values.push(value.path ? JSON.stringify(value.path) : JSON.stringify(value.equals));
      if (value.path) { values.pop(); values.push(value.path, JSON.stringify(value.equals)); terms.push(`"processingMeta" #> $${values.length - 1}::text[] = $${values.length}::jsonb`); }
      else terms.push(`"processingMeta" = $${values.length}::jsonb`);
    } else if (key === 'createdAt' && value.gte) { values.push(value.gte.toISOString()); terms.push(`"createdAt" >= $${values.length}::timestamptz`); }
    else { values.push(value); terms.push(`"${key}" = $${values.length}`); }
  }
  return { sql: terms.join(' AND ') || 'true', values };
}
async function fixture() {
  db = memoryDatabase(); authUser = 'owner'; sends = []; generations = 0; pageCalls = []; failedPage = undefined; sendFails = false;
  pg ||= new PGlite();
  await pg.exec('DROP TABLE IF EXISTS runs; CREATE TABLE runs (id text PRIMARY KEY, "userId" text, "sourceType" text, "sourceUrl" text, status text, "processingMeta" jsonb, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(), "completedAt" timestamptz)');
  const read = async ({ where, take } = {}) => { const query = whereSql(where); return (await pg.query(`SELECT * FROM runs WHERE ${query.sql} ORDER BY "updatedAt" ASC ${take ? 'LIMIT ' + Number(take) : ''}`, query.values)).rows; };
  db.importSession = {
    findMany: read, findUnique: async args => (await read(args))[0] || null, findFirst: async args => (await read(args))[0] || null,
    count: async args => (await read(args)).length,
    create: async ({ data }) => { const entries = Object.entries(data); await pg.query(`INSERT INTO runs (${entries.map(([key]) => `"${key}"`).join(',')}) VALUES (${entries.map((_, i) => '$' + (i + 1)).join(',')})`, entries.map(([key, value]) => key === 'processingMeta' ? JSON.stringify(value) : value)); return (await read({ where: { id: data.id } }))[0]; },
    updateMany: async ({ where, data }) => { const values = []; const setters = Object.entries(data).map(([key, value]) => { values.push(key === 'processingMeta' ? JSON.stringify(value) : value); return `"${key}" = $${values.length}`; });
      const query = whereSql(where, values); const result = await pg.query(`UPDATE runs SET ${setters.join(',')}, "updatedAt" = now() WHERE ${query.sql} RETURNING id`, values); return { count: result.rows.length }; },
  };
  // Only service ordering is modeled for these transactions; PostgreSQL row CAS above is real.
  let queue = Promise.resolve();
  db.$transaction = work => { const result = queue.then(() => work(db)); queue = result.catch(() => {}); return result; };
  db.$executeRaw = async sql => { assert.match(sql.join(''), /pg_advisory_xact_lock/); return 1; };
  await db.user.create({ data: { id: 'owner', name: 'Jane Designer', email: 'jane@studio.test', role: 'ARCHITECT' } });
  await db.organization.create({ data: { id: 'firm', name: 'North Studio', type: 'ARCHITECTURE_FIRM', status: 'CLAIMED' } });
  await db.organizationUser.create({ data: { userId: 'owner', organizationId: 'firm', role: 'OWNER', isActive: true } });
  // Cross-VM JSON is compared as data, as PostgreSQL JSONB does.
  const model = db.projectPost;
  db.projectPost = new Proxy(model, { get: (target, method) => method !== 'updateMany' ? target[method] : async args => {
    const { provenance, ...where } = args.where; const current = await target.findUnique({ where: { id: where.id } });
    const expected = provenance?.equals === require('@prisma/client').Prisma.DbNull ? null : provenance?.equals;
    if (provenance && !isDeepStrictEqual(json(current?.provenance), json(expected))) return { count: 0 };
    return target.updateMany({ ...args, where });
  } });
}
const input = () => ({ orgId: 'firm', website: 'studio.test', sections: ['business', 'bio', 'projects'], consent: true, requestId: randomUUID() });
const request = body => new Request('https://folio.test/api/onboarding/workspace', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const rowFor = id => db.importSession.findUnique({ where: { id } });

(async () => {
  assert.equal(extraction.websiteUrl('studio.test/team/jane', 'https://studio.test'), 'https://studio.test/team/jane');
  assert.equal(extraction.extractWebsitePage(html['/about'], 'https://studio.test/about', 'Jane Designer').personalBio, undefined);
  assert.equal(extraction.extractWebsitePage('<a href="https://elsewhere.test/work/a">Other</a><a href="/news/a">News</a>', 'https://studio.test').links.length, 0);
  await fixture();
  authUser = null; assert.equal((await startRoute.POST(request(input()))).status, 401); authUser = 'owner';
  assert.equal((await startRoute.POST(request({ ...input(), consent: false }))).status, 400);
  assert.equal((await startRoute.POST(request({ ...input(), orgId: 'other' }))).status, 403);
  assert.equal((await startRoute.POST(request({ ...input(), bioUrl: 'https://elsewhere.test/me' }))).status, 400);
  const original = input(); const [a, b] = await Promise.all([store.createWorkspaceImport('owner', original), store.createWorkspaceImport('owner', original)]);
  assert.equal(a, b); assert.equal(await db.importSession.count(), 1);
  await assert.rejects(store.createWorkspaceImport('owner', { ...original, sections: ['business'] }), { status: 409 });
  await assert.rejects(store.createWorkspaceImport('owner', input()), { status: 409 });
  authUser = 'outsider'; assert.equal((await detailRoute.GET(request({}), { params: { id: a } })).status, 404); authUser = 'owner';
  await Promise.all([processor.processWorkspaceImports(), processor.processWorkspaceImports()]);
  let row = await rowFor(a); assert.equal(row.status, 'COMPLETED'); assert.equal(row.processingMeta.projects.length, 2);
  assert.match(row.processingMeta.profile.logo || '', /^data:image\/png;base64,/, 'logo is decoded into a safe review candidate');
  assert.equal(await db.project.count(), 2); assert.equal(await db.projectImage.count(), 2); assert.equal(sends.length, 1); assert.equal(generations, 2);
  for (const project of await db.project.findMany()) { assert.equal(project.status, 'draft'); assert.equal(project.timeline, null); assert.equal(project.isPublic, false); assert.equal(project.publishedAt, null); assert.equal(project.designerOrgId, 'firm'); }
  for (const post of await db.projectPost.findMany()) { assert.equal(post.status, 'DRAFT'); assert.equal(post.provenance.interview, undefined); }
  assert.equal((await db.organization.findUnique({ where: { id: 'firm' } })).description, null, 'business drafts stay private until reviewed');
  assert.equal(await db.designerBio.count(), 0, 'bio is staged separately');
  let view = await review.readImportReview('owner', a); assert.equal(view.run.lease, undefined); assert.equal(view.run.notification.message, undefined);
  await review.reviewImport('owner', a, { action: 'business', version: view.business.updatedAt.toISOString(), description: 'Reviewed business description', location: 'Brooklyn', useLogo: false });
  assert.equal((await db.organization.findUnique({ where: { id: 'firm' } })).description, 'Reviewed business description');
  await assert.rejects(review.reviewImport('owner', a, { action: 'business', version: '2000-01-01T00:00:00.000Z', description: 'Stale edit', location: '', useLogo: false }), { status: 409 });
  await review.reviewImport('owner', a, { action: 'bio', version: null, bio: row.processingMeta.profile.bio });
  assert.equal((await db.designerBio.findUnique({ where: { userId: 'owner' } })).folioBio, null);
  const project = (await db.project.findMany())[0]; assert.ok(await prepared.readPreparedProject(project.id));
  const legacy = await load('src/lib/editorial/getInterviewQuestions.ts').getInterviewQuestionsGroupedByRoom(project.id, { phase: 'project' });
  assert.equal(legacy.rooms[0].questions.length, 5);
  assert.match(legacy.rooms[0].questions[0].id, /^project-CLIENT_BRIEF-/);
  assert.equal(legacy.rooms[0].questions[0].questionText, (await prepared.readPreparedProject(project.id)).questions[0].text);
  const source = { name: 'Jane Designer', bio: 'My background', sourceUrl: 'https://studio.test/team/jane' };
  const storedBio = (await pg.query('SELECT $1::jsonb AS data', [JSON.stringify({ ...source, _folioPreparation: { role: 'ARCHITECT', fingerprint: prepared.bioSourceFingerprint(source), questions: [{ id: 'bio-1', question: 'What shaped your practice?', round: 'base' }] } })])).rows[0].data;
  assert.equal(prepared.readPreparedBio(storedBio, 'ARCHITECT').length, 1, 'cached bio questions survive real JSONB key ordering');
  assert.equal(prepared.readPreparedBio({ ...storedBio, bio: 'Edited background' }, 'ARCHITECT'), null);
  assert.equal(prepared.readPreparedBio(storedBio, 'BUILDER'), null);
  await db.project.update({ where: { id: project.id }, data: { description: 'Changed by the owner' } }); assert.equal(await prepared.readPreparedProject(project.id), null);
  const again = await store.createWorkspaceImport('owner', input()); await processor.processWorkspaceImports();
  assert.equal(await db.project.count(), 2, 'another run reuses source projects'); assert.equal((await db.project.findUnique({ where: { id: project.id } })).description, 'Changed by the owner');
  assert.equal((await rowFor(again)).processingMeta.projects.filter(p => p.preparation).length, 0);
  console.log('PASS auth, explicit consent, active business permissions, request replay, JSONB worker claims, separate private drafts, review and edit preservation');

  await fixture(); failedPage = '/work/court'; const partial = await store.createWorkspaceImport('owner', input()); await processor.processWorkspaceImports();
  row = await rowFor(partial); assert.equal(row.status, 'COMPLETED'); assert.equal(await db.project.count(), 1); assert.ok(row.processingMeta.pages.some(p => p.status === 'failed'));
  failedPage = undefined; await review.reviewImport('owner', partial, { action: 'retry' }); await processor.processWorkspaceImports();
  assert.equal(await db.project.count(), 2); assert.equal(sends.length, 1, 'manual retry does not resend accepted email');
  await fixture(); sendFails = true; const mail = await store.createWorkspaceImport('owner', input()); await processor.processWorkspaceImports();
  row = await rowFor(mail); assert.equal(row.processingMeta.phase, 'notify'); assert.equal(sends.length, 1);
  await processor.processWorkspaceImports(); assert.equal(sends.length, 1, 'honor retry delay'); now += 6 * 60_000; sendFails = false; await processor.processWorkspaceImports();
  assert.equal(sends.length, 2); assert.deepEqual(sends[0], sends[1], 'ambiguous provider retry keeps identical payload and key');
  await fixture(); sendFails = true; const expiredMail = await store.createWorkspaceImport('owner', input()); await processor.processWorkspaceImports();
  now += 24 * 60 * 60_000; await processor.processWorkspaceImports();
  assert.equal(sends.length, 1, 'never resubmit an ambiguous message outside the provider key window');
  assert.equal((await rowFor(expiredMail)).processingMeta.notification.status, 'failed');
  console.log('PASS partial-page recovery, duplicate-project avoidance, delayed email retry and immutable provider payload');

  await fixture(); const interrupted = await store.createWorkspaceImport('owner', input()); row = await rowFor(interrupted);
  let run = structuredClone(row.processingMeta); run.lease = { token: 'old-worker', until: new Clock(now + 60000).toISOString() }; await store.saveImport(interrupted, row.processingMeta, run);
  await processor.processWorkspaceImports(); assert.equal(pageCalls.length, 0, 'a live lease excludes another worker');
  const stale = json(run); now += 7 * 60_000; await processor.processWorkspaceImports();
  assert.equal((await rowFor(interrupted)).status, 'COMPLETED'); await assert.rejects(store.saveImport(interrupted, stale, run), { status: 409 });
  await fixture(); const revoked = await store.createWorkspaceImport('owner', input()); await db.organizationUser.updateMany({ where: { userId: 'owner' }, data: { isActive: false } }); await processor.processWorkspaceImports();
  assert.equal((await rowFor(revoked)).status, 'FAILED'); assert.equal(await db.project.count(), 0); assert.equal(pageCalls.length, 0);
  console.log('PASS expiring lease recovery, stale worker fencing and revoked access before external calls');
  await pg.close();
})().catch(async error => { console.error(error); if (pg) await pg.close(); process.exitCode = 1; });

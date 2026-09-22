const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { if (!(name in mocks)) throw Error(name); return mocks[name]; }, process: { env: {} }, Date, URLSearchParams, console });
  return exports;
}
(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite();
  try {
    await pg.exec('CREATE TABLE projects (id TEXT PRIMARY KEY); INSERT INTO projects VALUES (\'p\');');
    await pg.exec(fs.readFileSync('prisma/migrations/20260421103012_record_bucket_b_editorial_drafts/migration.sql', 'utf8'));
    // Minimal existing export columns exercise the handoff; release storage uses the exact migration above.
    await pg.exec('CREATE TABLE instagram_exports (id TEXT PRIMARY KEY, "projectId" TEXT, "designerId" TEXT, config JSONB, headline TEXT, caption TEXT, status TEXT, "updatedAt" TIMESTAMP DEFAULT NOW());');
    await pg.query('INSERT INTO instagram_exports (id,"projectId","designerId",config,headline,caption,status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['export-r1', 'p', 'owner', JSON.stringify({ studioCardId: 'room:p:r1' }), 'Saved lighting headline', 'The original hand-edited caption.', 'draft']);
    const rows = async (sql, args = []) => (await pg.query(sql, args)).rows;
    const overview = 'A coastal house brings sheltered courtyards, generous family spaces and a quiet palette together through a coherent architectural plan.';
    const project = { id: 'p', title: 'House', ownerId: 'owner', designerId: 'owner', post: { excerpt: overview } };
    const cards = [
      { id: 'project:p', revision: 'intro-v1', title: 'House', caption: overview },
      { id: 'room:p:r1', revision: 'room1-v1', title: 'Living room', roomId: 'r1', caption: 'We rejected a brass chandelier when its weight distorted the ceiling beams, choosing lighter glass instead.' },
      { id: 'room:p:r2', revision: 'room2-v1', title: 'Kitchen', roomId: 'r2', caption: 'Testing green tiles revealed reflections near the counter, so muted terracotta became our final backsplash finish.' },
    ].map(card => ({ ...card, canPolish: true, imageUrl: 'photo' }));
    const db = {
      user: { findUnique: async () => ({ role: 'DESIGNER' }) },
      project: { findFirst: async ({ where }) => where.id === 'p' && where.designerOrgId === null ? project : null, findMany: async () => [project] },
      instagramExport: { findMany: async ({ where }) => rows('SELECT * FROM instagram_exports WHERE "projectId"=$1 AND "designerId"=$2 ORDER BY "updatedAt" DESC,id', [where.projectId, where.designerId]) },
      editorialDraft: {
        findUnique: async ({ where }) => (await rows('SELECT * FROM editorial_drafts WHERE id=$1', [where.id]))[0] || null,
        findMany: async ({ where }) => rows('SELECT * FROM editorial_drafts WHERE id=ANY($1::text[]) AND status=$2', [where.id.in, where.status]),
        create: async ({ data }) => rows('INSERT INTO editorial_drafts (id,"projectId",status,version,"rawState") VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *', [data.id, data.projectId, data.status, data.version, JSON.stringify(data.rawState)]),
        updateMany: async ({ where, data }) => ({ count: (await rows('UPDATE editorial_drafts SET version=$1,"rawState"=$2::jsonb,"updatedAt"=$3 WHERE id=$4 AND version=$5 AND status=$6 RETURNING id', [data.version, JSON.stringify(data.rawState), data.updatedAt, where.id, where.version, where.status])).length }),
      },
    };
    db.$transaction = async callback => { await pg.exec('BEGIN ISOLATION LEVEL SERIALIZABLE'); try { const result = await callback(db); await pg.exec('COMMIT'); return result; } catch (error) { await pg.exec('ROLLBACK'); throw error; } };
    class AccessError extends Error { constructor(message, status) { super(message); this.status = status; } }
    const model = load('src/lib/publishing-studio/release-plan.ts', {});
    const mocks = { 'server-only': {}, crypto: require('node:crypto'), '@prisma/client': require('@prisma/client'), '@/lib/prisma': { prisma: db },
      '@/lib/permissions': { canAccessDesignerTools: role => role === 'DESIGNER' },
      './data': { StudioAccessError: AccessError, resolvePublishingStudioContext: async () => ({ id: null, canWriteCampaigns: false }) },
      './feed': { configObject: value => value && typeof value === 'object' ? value : {}, buildStudioFeed: () => cards }, './release-plan': model };
    const instance = () => load('src/lib/publishing-studio/release-plan-service.ts', mocks);
    const first = instance();
    assert.equal((await first.readReleasePlan('owner', 'p')).plan, null);
    assert.equal((await rows('SELECT * FROM editorial_drafts')).length, 0, 'Read-only opening leaves SQL storage empty');
    const selected = [cards[0], cards[2], cards[1]].map((card, index) => ({ sourceId: card.id, revision: card.revision, planningDate: `2026-10-${String(index + 1).padStart(2, '0')}` }));
    await first.saveReleasePlan('owner', { projectId: 'p', expectedVersion: 0, items: selected });
    const second = instance();
    const resumed = await second.readReleasePlan('owner', 'p');
    assert.deepEqual(JSON.parse(JSON.stringify(resumed.plan.items)), selected, 'Fresh service instance restores selected room order and dates from JSONB');
    assert.equal(resumed.plan.version, 1);
    assert.equal(resumed.options.find(option => option.roomId === 'r1').caption, 'The original hand-edited caption.');
    assert.match(resumed.options.find(option => option.roomId === 'r1').editorHref, /export=export-r1/);
    await pg.query('UPDATE instagram_exports SET caption=$1 WHERE id=$2', ['A newer caption saved in the individual editor.', 'export-r1']);
    assert.equal((await instance().readReleasePlan('owner', 'p')).options.find(option => option.roomId === 'r1').caption, 'A newer caption saved in the individual editor.');
    await assert.rejects(first.saveReleasePlan('owner', { projectId: 'p', expectedVersion: 0, items: selected }), error => error.status === 409);
    const fewer = [selected[0], selected[2]];
    await second.saveReleasePlan('owner', { projectId: 'p', expectedVersion: 1, items: fewer });
    assert.deepEqual(JSON.parse(JSON.stringify((await instance().readReleasePlan('owner', 'p')).plan.items)), fewer);
    cards[1].revision = 'source-changed';
    await assert.rejects(second.saveReleasePlan('owner', { projectId: 'p', expectedVersion: 2, items: fewer }), error => error.status === 409);
    const persisted = (await rows('SELECT * FROM editorial_drafts'))[0];
    assert.equal(persisted.version, 2); assert.deepEqual(persisted.rawState.items, fewer, 'Rejected stale source leaves persisted choices intact');
    assert.equal(persisted.status, 'release_plan'); assert.equal(persisted.rawState.actor, 'owner'); assert.equal(persisted.rawState.kind, 'studio_release_plan_v1');
    await pg.query('INSERT INTO editorial_drafts (id,"projectId",status,"rawState") VALUES ($1,$2,$3,$4)', ['ordinary-editorial', 'p', 'draft', JSON.stringify({ galleryChapters: [{ title: 'Existing editorial' }] })]);
    assert.equal((await instance().listReleasePlans('owner')).plans.length, 1, 'Other editorial drafts are not release plans');
    assert.equal((await rows('SELECT "rawState" FROM editorial_drafts WHERE id=$1', ['ordinary-editorial']))[0].rawState.galleryChapters[0].title, 'Existing editorial');
    console.log('PASS PostgreSQL release storage: exact migration, JSONB reload/order/dates, existing editor edits, version CAS, stale-source rollback and namespaced coexistence. Independent concurrent connections are not simulated.');
  } finally { await pg.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

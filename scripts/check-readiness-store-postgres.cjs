const fs = require('fs');
const assert = require('assert/strict');
const Module = require('module');
const ts = require('typescript');
const { Prisma } = require('@prisma/client');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
  const entry = process.env.READINESS_PGLITE_PATH || require.resolve('@electric-sql/pglite');
  const { PGlite } = await import(pathToFileURL(path.resolve(entry)).href);
  const db = new PGlite();
  try {
    await db.exec(fs.readFileSync('docs/reviews/studio-readiness-proposed.sql', 'utf8'));
    await db.exec(`CREATE TABLE users(id text,role text,"operatingAsOrgId" text);
      CREATE TABLE organization_users("userId" text,"organizationId" text,"isActive" boolean,role text);
      CREATE TABLE projects(id text,"designerOrgId" text,"ownerId" text,"designerId" text,"isPublic" boolean);
      CREATE TABLE project_posts("projectId" text,status text);
      CREATE TABLE project_images(id text,"projectId" text);
      CREATE TABLE rooms(id text,"projectId" text);
      INSERT INTO users VALUES ('actor','DESIGNER',NULL),('intruder','DESIGNER',NULL);
      INSERT INTO projects VALUES ('project',NULL,'actor','actor',true);
      INSERT INTO project_posts VALUES ('project','PUBLISHED');`);
    const adapt = client => ({
      $queryRaw: async (parts, ...values) => { const query = Array.isArray(parts) ? Prisma.sql(parts, ...values) : parts; return (await client.query(query.text, query.values)).rows; },
      $executeRaw: async (parts, ...values) => { const query = Prisma.sql(parts, ...values); return (await client.query(query.text, query.values)).affectedRows; },
      project: { findMany: async () => [{ id: 'project' }] },
    });
    const fakePrisma = { $transaction: fn => db.transaction(tx => fn(adapt(tx))) };
    const file = 'src/lib/publishing-studio/readiness/store.ts';
    let currentSource = 'source-a';
    const mod = new Module(file, module);
    mod.require = id => id === 'server-only' ? {} : id === '@/lib/prisma' ? { prisma: fakePrisma }
      : id === '@/lib/permissions' ? { canAccessDesignerTools: role => ['DESIGNER','ADMIN'].includes(role) }
      : id === './sources' ? { loadCandidateSources: async (_actor, tx) => { assert.ok(tx, 'source reload must use transaction'); return { workspace: { id: null }, sources: [{ key: 'project:project', fingerprint: currentSource }] }; }, sourceVersion: source => source.fingerprint } : require(id);
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file);
    const store = mod.exports;
    const candidate = { id: 'candidate', version: 1, sourceVersion: 'source-a', sourceKey: 'project:project', designerId: 'actor', organizationId: null, projectIds: ['project'], dimensions: { story: 4 }, score: 80, blockers: [], readiness: 'quick', dismissed: false };
    delete process.env.STUDIO_EDITORIAL_READINESS;
    await assert.rejects(store.saveCandidate(candidate, null, 'generated'), /not enabled/);
    await assert.rejects(store.listStoredCandidates('actor', null), /not enabled/);
    await assert.rejects(store.appendEvent(candidate, 'shown'), /not enabled/);
    process.env.STUDIO_EDITORIAL_READINESS = 'true';
    await db.exec(`ALTER TABLE studio_candidate_events ADD CONSTRAINT test_secondary_failure CHECK (kind <> 'scored')`);
    await assert.rejects(store.saveCandidate(candidate, null, 'generated', {}, [{ kind: 'scored' }]), e => e.code === '23514');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM studio_candidates')).rows[0].n, 0, 'secondary event failure rolls back candidate');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM studio_candidate_versions')).rows[0].n, 0, 'secondary event failure rolls back snapshot');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM studio_candidate_events')).rows[0].n, 0, 'secondary event failure rolls back primary event');
    await db.exec('ALTER TABLE studio_candidate_events DROP CONSTRAINT test_secondary_failure');
    await store.saveCandidate(candidate, null, 'generated', {}, [{ kind: 'scored' }, { kind: 'ready' }]);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM studio_candidate_events')).rows[0].n, 3);
    await assert.rejects(store.saveCandidate(candidate, null, 'generated'), store.CandidateConflictError);
    await store.appendEvent(candidate, 'shown', { score: -1 }, 'shown-id');
    await store.appendEvent(candidate, 'shown', { score: -1 }, 'shown-id');
    assert.equal((await db.query(`SELECT payload FROM studio_candidate_events WHERE id='shown-id'`)).rows[0].payload.score, 80);
    await assert.rejects(store.appendEvent(candidate, 'opened', {}, 'shown-id'), store.CandidateConflictError);
    await assert.rejects(store.saveCandidate({ ...candidate, designerId: 'intruder', version: 2 }, 1, 'edited'));
    currentSource = 'source-b';
    await assert.rejects(store.saveCandidate({ ...candidate, version: 2 }, 1, 'edited'), store.CandidateConflictError);
    await store.saveCandidate({ ...candidate, version: 2, sourceVersion: 'source-b' }, 1, 'edited');
    await assert.rejects(store.appendEvent(candidate, 'opened'), store.CandidateConflictError);
    await assert.rejects(store.saveCandidate({ ...candidate, version: 2 }, 1, 'edited'), store.CandidateConflictError);
    assert.equal((await store.listStoredCandidates('actor', null))[0].version, 2);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM studio_candidate_versions')).rows[0].n, 2);
    await db.exec(`UPDATE project_posts SET status='DRAFT'`);
    await assert.rejects(store.appendEvent({ ...candidate, version: 2, sourceVersion: 'source-b' }, 'opened'), /no longer published/);
    await db.exec(`UPDATE project_posts SET status='PUBLISHED'; UPDATE projects SET "isPublic"=false`);
    await assert.rejects(store.saveCandidate({ ...candidate, version: 3 }, 2, 'edited'), /source access/);
    await db.exec(`UPDATE projects SET "isPublic"=true`);
    await db.exec(`UPDATE users SET "operatingAsOrgId"='changed' WHERE id='actor'`);
    await assert.rejects(store.appendEvent({ ...candidate, version: 2, sourceVersion: 'source-b' }, 'opened'));
    console.log('PASS real store against disposable PostgreSQL: immutable version history, optimistic conflicts, actor/source ownership, workspace change denial, idempotent exact-version events, authoritative scores, latest list.');
  } finally { await db.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

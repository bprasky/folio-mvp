// Real catalog/list queries in disposable PostgreSQL, with authenticated page/API
// boundaries and source authorization doubled. No .env, provider or production IO.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const env = { FOLIO_LIVE_INTERVIEWS: '0', FOLIO_INTERVIEW_RECORDING: '0', FOLIO_INTERVIEW_MEDIA_EXPORTS: '0' };
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, {
    exports, process: { env }, console, URL, Date,
    require(name) {
      if (name in mocks) return mocks[name];
      if (['crypto', 'zod', 'react', 'react/jsx-runtime'].includes(name)) return require(name);
      throw Error(`Unexpected import: ${name}`);
    },
  }, { filename: file });
  return exports;
}

(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite();
  try {
    const queries = [];
    const db = { $queryRaw: async (strings, ...values) => {
      const sql = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
      queries.push(sql);
      return (await pg.query(sql, values)).rows;
    } };
    const types = load('src/lib/interview-media/types.ts');
    const live = load('src/lib/live-interview/store.ts', {
      'server-only': {}, '@/lib/prisma': { prisma: db }, '@/lib/permissions': { normalizeRole: role => role },
    });
    const store = load('src/lib/interview-media/store.ts', {
      'server-only': {}, '@/lib/prisma': { prisma: db }, '@/lib/live-interview/store': live, './types': types,
    });
    const service = load('src/lib/interview-media/service.ts', {
      'server-only': {}, '@/lib/live-interview/store': live, './store': store, './types': types, './storage': {}, './plan': {},
      '@/lib/live-interview/adapters': { resolveMediaSource: async (actor, source) => {
        assert.equal(actor, 'owner'); assert.equal(source.sourceId, 'owner'); return { images: [] };
      } },
    });
    let signedInActor = 'owner', libraryMounts = 0;
    const auth = { getServerSession: async () => signedInActor ? { user: { id: signedInActor } } : null };
    const pageMocks = {
      'next-auth': auth, '@/app/api/auth/[...nextauth]/options': { authOptions: {} },
      'next/navigation': { redirect: path => { throw Error(`redirect:${path}`); } },
      'next/link': ({ children, ...props }) => React.createElement('a', props, children),
      '@/lib/interview-media/store': store,
      '@/lib/publishing-studio/expertise/flag': { expertiseEnabled: () => false },
      '@/components/publishing-studio/PublishingStudio': { PublishingStudio: () => React.createElement('p', null, 'Saved Studio work') },
      '@/components/publishing-studio/ReadinessStudio': { ReadinessStudio: () => React.createElement('p', null, 'Studio suggestions') },
      '@/components/publishing-studio/InterviewMediaLibrary': { InterviewMediaLibrary: () => {
        libraryMounts++; return React.createElement('p', null, 'Recording library');
      } },
    };
    const studio = load('src/app/designer/studio/page.tsx', pageMocks).default;
    const mediaPage = load('src/app/designer/studio/media/page.tsx', pageMocks).default;
    const http = load('src/lib/interview-media/http.ts', {
      'server-only': {}, 'next-auth': auth, '@/app/api/auth/[...nextauth]/options': { authOptions: {} },
      'next/server': { NextResponse: { json: (value, init) => Response.json(value, init) } }, './types': types,
    });
    const route = load('src/app/api/interview-media/route.ts', {
      '@/lib/interview-media/http': http, '@/lib/interview-media/service': service,
    });
    const getLibrary = () => route.GET(new Request('https://folio.test/api/interview-media'));

    assert.equal(await store.mediaSchemaReady(), false);
    const studioBefore = renderToStaticMarkup(await studio({}));
    assert(studioBefore.includes('Saved Studio work'));
    assert(!studioBefore.includes('/designer/studio/media'), 'unavailable recordings navigation stays hidden');
    const mediaBefore = renderToStaticMarkup(await mediaPage());
    assert(mediaBefore.includes('not available yet'));
    assert(mediaBefore.includes('href="/designer/studio"'));
    assert.equal(libraryMounts, 0, 'unavailable page never mounts its polling library');
    const unavailable = await getLibrary();
    assert.equal(unavailable.status, 503);
    assert(queries.every(sql => sql.trimStart().startsWith('SELECT') && sql.includes('to_regclass')), 'absent schema only receives read-only catalog queries');

    await pg.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE TABLE users(id text PRIMARY KEY, role text); INSERT INTO users VALUES ('owner','DESIGNER'),('other','DESIGNER');");
    await pg.exec(fs.readFileSync('prisma/migrations/20261001120000_live_interview_private_media/migration.sql', 'utf8'));
    assert.equal(await store.mediaSchemaReady(), true, 'readiness updates immediately after migration');
    await pg.exec('ALTER TABLE interview_media_records RENAME TO pending_media_records');
    assert.equal(await store.mediaSchemaReady(), false, 'both required tables must exist');
    await pg.exec('ALTER TABLE pending_media_records RENAME TO interview_media_records');
    await pg.query(`INSERT INTO live_interview_sessions (id,"actorId","sourceType","sourceId","canonicalId",status,"credentialHash","expiresAt")
      VALUES ('session','owner','designer_bio','owner','owner','ended','fixture-hash',now())`);
    await pg.query(`INSERT INTO interview_media_records (id,"actorId","sessionId",kind,state,payload)
      VALUES ('recording','owner','session','capture','ready',$1::jsonb)`, [JSON.stringify({
      source: { sourceType: 'designer_bio', sourceId: 'owner', canonicalId: 'owner' },
      mimeType: 'audio/webm', offsetMs: 0, durationMs: 1000, speakerId: 'owner', transcript: [{ text: 'Saved words.' }],
    })]);
    assert(renderToStaticMarkup(await studio({})).includes('/designer/studio/media'), 'flags off preserve archive navigation');
    renderToStaticMarkup(await mediaPage());
    assert.equal(libraryMounts, 1, 'flags off preserve the media library');
    const available = await getLibrary();
    assert.equal(available.status, 200);
    const result = await available.json();
    assert.equal(result.items[0].id, 'recording');
    assert.equal(result.items[0].transcript[0].text, 'Saved words.', 'flags off preserve existing archive reads');
    signedInActor = 'other';
    assert.deepEqual((await (await getLibrary()).json()).items, [], 'another actor cannot read the archive');
    signedInActor = null;
    const beforeAuth = queries.length;
    assert.equal((await getLibrary()).status, 401);
    await assert.rejects(mediaPage(), /redirect:\/auth\/signin/);
    await assert.rejects(studio({}), /redirect:\/auth\/signin/);
    assert.equal(queries.length, beforeAuth, 'authenticate before any readiness or archive lookup');
    console.log('PASS media rollout: missing schema hides navigation/polling, returns 503; flags-off archives retain ownership and auth checks.');
  } finally { await pg.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

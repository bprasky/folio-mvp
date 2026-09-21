const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { if (!(name in mocks)) throw Error(name); return mocks[name]; }, console });
  return exports;
}
(async () => {
  let session = null, writes = 0, failure, invalidations = [];
  class StoryError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
  const next = { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200, headers: options?.headers }) } };
  const http = load('src/lib/publishing-studio/story-http.ts', { 'server-only': {}, 'next-auth': { getServerSession: async () => session }, 'next/server': next,
    '@/app/api/auth/[...nextauth]/options': { authOptions: {} }, './story-service': { StoryError }, './data': { StudioAccessError: class extends Error {} } });
  const route = load('src/app/api/publishing-studio/stories/[id]/route.ts', { 'next/server': next, 'next/cache': { revalidatePath: path => invalidations.push(path) },
    '@/lib/publishing-studio/story-http': http, '@/lib/publishing-studio/story-service': {
      readStory: async actor => { assert.equal(actor, 'owner'); return { id: 'story' }; },
      changeStory: async (actor, id, body) => { assert.equal(actor, 'owner'); assert.equal(id, 'story'); if (failure) throw failure; writes++; return { id, publishedUrl: body.action === 'publish' ? '/stories/public' : null }; },
    } });
  const context = { params: { id: 'story' } }, request = action => ({ json: async () => ({ action, revision: 3 }) });
  assert.equal((await route.PATCH(request('save'), context)).status, 401); assert.equal(writes, 0);
  session = { user: { id: 'owner' } };
  const read = await route.GET({}, context); assert.equal(read.headers['Cache-Control'], 'private, no-store'); assert.equal(writes, 0);
  await route.PATCH(request('save'), context); assert.deepEqual(invalidations, ['/designer/studio']);
  invalidations = []; await route.PATCH(request('discard'), context);
  assert.deepEqual(invalidations, ['/designer/studio'], 'discard refreshes saved interviews without touching public profiles');
  invalidations = []; failure = new StoryError('stale', 409);
  assert.equal((await route.PATCH(request('publish'), context)).status, 409); assert.deepEqual(invalidations, []);
  failure = null; await route.PATCH(request('publish'), context);
  assert.deepEqual(invalidations, ['/designer/studio', '/designer/owner', '/profile/owner', '/stories/public']);
  console.log('PASS: story HTTP auth, read-only no-store reads, stale error propagation and success-only publication revalidation.');
})().catch(error => { console.error(error); process.exitCode = 1; });

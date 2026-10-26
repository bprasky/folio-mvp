// Real route + validators. Synthetic authorization/storage/database, no external IO.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let actor = 'viewer', storage = 0, failStorage = false, failWrite = false;
const rows = new Map(), objects = new Set();
function load(path, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: name => { if (!(name in mocks)) throw Error(name); return mocks[name]; },
    console, Buffer, setTimeout, clearTimeout, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://storage.test' } },
    fetch: () => { throw Error('Unexpected external fetch'); }, AbortSignal,
  });
  return exports;
}
const input = load('src/lib/server/project-image-input.ts', { './safe-product-url': {} });
const photo = load('src/lib/files/projectPhoto.ts', {});
const route = load('src/app/api/projects/[id]/images/route.ts', {
  '@/lib/persistence/requestIdentity': load('src/lib/persistence/requestIdentity.ts', { 'node:crypto': require('node:crypto') }), '@/lib/files/projectPhoto': photo,
  '@/lib/server/project-image-input': input, '@/lib/server/safe-product-url': { UnsafeProductUrl: class extends Error {} },
  'next/server': { NextResponse: { json: (value, init) => Response.json(value, init) } },
  'next-auth': { getServerSession: async () => actor ? { user: { id: actor } } : null },
  '@/app/api/auth/[...nextauth]/options': { authOptions: {} },
  '@/lib/authz/access': { assertProjectWrite: async id => { if (id !== 'owner') throw Error('Forbidden'); } },
  '@/lib/prisma': { prisma: { projectImage: {
    findUnique: async ({ where }) => rows.get(where.id) || null,
    create: async ({ data }) => {
      if (failWrite) { failWrite = false; throw Error('Injected database failure'); }
      const id = data.id || `image-${rows.size}`;
      if (rows.has(id)) throw Object.assign(Error('Unique'), { code: 'P2002' });
      const row = { ...data, id }; rows.set(id, row); return row;
    },
  } } },
  '@/lib/storage': { saveBufferToProjectStorage: async ({ storageId }) => {
    storage++; if (failStorage) { failStorage = false; throw Error('Injected storage failure'); }
    objects.add(storageId); return { publicUrl: `https://storage.test/${storageId}` };
  } },
  '@/lib/search/indexMoment': { indexMoment: async () => { throw Error('Injected indexing failure'); } },
  'next/cache': { revalidatePath() {} },
});
const payload = { imageData: 'aW1hZ2U=', mimeType: 'image/png', name: 'Synthetic photo', deduplicate: true };
const upload = (changes = {}, id = 'project') => route.POST(new Request('https://folio.test/upload', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, ...changes }),
}), { params: { id } });
(async () => {
  assert.equal((await upload()).status, 403); actor = null; assert.equal((await upload()).status, 401); assert.equal(storage, 0);
  actor = 'owner';
  for (const bad of [{ mimeType: 'application/pdf' }, { imageData: Buffer.alloc(photo.PROJECT_PHOTO_MAX_BYTES + 1).toString('base64') }, { imageData: '' }]) assert.ok([400, 413, 422].includes((await upload(bad)).status));
  assert.equal(storage, 0);
  failStorage = true; assert.equal((await upload()).status, 500); assert.equal(rows.size, 0);
  failWrite = true; assert.equal((await upload()).status, 500); assert.equal(rows.size, 0);
  const responses = await Promise.all([upload(), upload()]);
  assert.ok(responses.every(response => response.ok));
  const first = (await responses[0].json()).image;
  assert.match(first.id, /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(rows.size, 1); assert.equal(objects.size, 1, 'database retry uses the same storage identity');
  // Discard success as if the connection died after commit; repeat with the same bytes.
  const before = storage;
  assert.equal((await (await upload()).json()).image.id, first.id);
  assert.equal(storage, before); assert.equal(rows.size, 1);
  assert.notEqual((await (await upload({}, 'second-project')).json()).image.id, first.id);
  actor = null; assert.equal((await upload()).status, 401); assert.equal(rows.size, 2);
  console.log('PASS upload interruptions: auth, type/size validation, storage/database failures, concurrent/lost-response retries, project isolation and indexing failure. Simulated services only.');
})().catch(error => { console.error(error); process.exitCode = 1; });

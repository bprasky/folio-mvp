// Real GET handler, role normalizer and published filter; synthetic auth/Prisma.
// Run with node --experimental-vm-modules scripts/check-project-list-privacy.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
let actor = null, storedRole = 'DESIGNER', reads = 0, failRead = false;
const rows = [
  { id: 'fixture-own-draft', designerId: 'owner', status: 'draft', isPublic: false, publishedAt: null, images: [{ id: 'private-photo', tags: [{ id: 'private-tag' }] }] },
  { id: 'fixture-other-active', designerId: 'other', status: 'active', isPublic: false, publishedAt: null, images: [{ id: 'other-private-photo' }] },
  { id: 'fixture-public', designerId: 'other', status: 'published', isPublic: true, publishedAt: '2026-01-01', images: [{ id: 'public-photo' }] },
];
// Schemas are evaluated at module load, but this suite calls only GET. Mutation
// validation is covered by the core authorization suite, not these inert doubles.
const field = { optional() { return this; }, nullable() { return this; }, min() { return this; }, unwrap() { return this; } };
function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(clause => matches(row, clause));
    if (value && typeof value === 'object' && 'not' in value) return row[key] !== value.not;
    return row[key] === value;
  });
}
const mocks = {
  '@/lib/projects/createProject': { createProjectOnce: () => { throw Error('Unexpected project creation in GET checks'); }, CreationConflict: class extends Error {} },
  '@/lib/persistence/requestIdentity': { requestIdentity: () => { throw Error('Unexpected create identity'); } },
  zod: { z: { string: () => field, object: () => ({}) } },
  'next/server': { NextRequest: Request, NextResponse: { json: (data, init) => Response.json(data, init) } },
  'next-auth': { getServerSession: async () => actor && { user: { id: actor, role: 'ADMIN' } } },
  '@/app/api/auth/[...nextauth]/options': { authOptions: {} },
  '@/lib/prisma': { prisma: {
    user: { findUnique: async () => ({ role: storedRole }) },
    project: { findMany: async ({ where }) => {
      reads++;
      if (failRead) throw new Error('Fixture database outage');
      return structuredClone(rows.filter(row => matches(row, where)));
    } },
  } },
  '@/lib/orgPermissions': { can: () => false, isOrgRole: () => false, canCreateFirmProject: () => false },
  '@/lib/supabaseServer': { supabaseServer: null },
  '@/lib/analytics': { logPassiveEvent: () => { throw Error('Unexpected analytics'); } },
  './normalizeCreatePayload': { CanonicalCreateSchema: { shape: new Proxy({}, { get: () => field }) }, CompletionDateSchema: null, normalizeCreatePayload: () => { throw Error('Unexpected create'); } },
  '@/lib/dbEnv': { logDbEnv: () => {} },
  '@/lib/authz/access': { assertProjectWrite: () => { throw Error('Unexpected write'); }, assertProjectDelete: () => { throw Error('Unexpected delete'); } },
  '@/domain/project/enums': { CLIENT_BY_LABEL: null, PROJECT_TYPE_BY_LABEL: null, DEFAULTS: null },
  '@/lib/posting/slug': { makeSlug: () => { throw Error('Unexpected slug'); } },
  '@/lib/spotlight/deletion': { deleteProjectWithSpotlightGuard: () => { throw Error('Unexpected delete'); } },
  '@/lib/spotlight/gate': { SpotlightConflict: class extends Error {} },
};
const context = vm.createContext({ URL, Request, Response, Error, console: { error() {} }, process: { env: { NODE_ENV: 'test' } } });
const modules = new Map();
function compile(source) {
  // Reuse the installed compiler on supported repository Node 20/22 runtimes.
  // Node 24's built-in eraser permits this isolated check without npm services.
  try {
    const ts = require('typescript');
    return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    return require('node:module').stripTypeScriptTypes(source);
  }
}
async function load(name) {
  if (modules.has(name)) return modules.get(name);
  if (Object.hasOwn(mocks, name)) {
    const values = mocks[name];
    const module = new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
    modules.set(name, module);
    return module;
  }
  const real = {
    route: 'src/app/api/projects/route.ts',
    '@/lib/permissions': 'src/lib/permissions.ts',
    '@/lib/post/publicPost': 'src/lib/post/publicPost.ts',
    '@/server/queries/filters': 'src/server/queries/filters.ts',
  }[name];
  assert.ok(real, `Unexpected dependency: ${name}`);
  const module = new vm.SourceTextModule(compile(fs.readFileSync(path.join(root, real), 'utf8')), { context, identifier: real });
  modules.set(name, module);
  await module.link(load);
  return module;
}
async function main() {
  const route = await load('route'); await route.evaluate();
  let passed = 0;
  const check = async (name, work) => {
    actor = null; storedRole = 'DESIGNER'; reads = 0; failRead = false;
    await work(); passed++; console.log('PASS ' + name);
  };
  const get = query => route.namespace.GET(new Request('http://folio.test/api/projects' + query));
  const ids = async response => { assert.equal(response.status, 200); return (await response.json()).map(row => row.id); };
  await check('anonymous and signed-in public lists omit private projects, images and tags', async () => {
    for (actor of [null, 'owner', 'other']) {
      assert.deepEqual(await ids(await get('')), ['fixture-public']);
      const serialized = JSON.stringify(await (await get('?designerId=owner')).json());
      assert.equal(serialized, '[]');
    }
  });
  await check('anonymous draft and mine parameters cannot expose saved projects', async () => {
    for (const query of ['?includeDrafts=true', '?includeDrafts=true&designerId=owner', '?mine=true', '?mine=true&includeDrafts=true']) {
      assert.equal((await get(query)).status, 401);
    }
    assert.equal(reads, 0);
  });
  await check('designer can resume own draft through legacy and canonical lists', async () => {
    actor = 'owner';
    for (const query of ['?includeDrafts=true', '?includeDrafts=true&designerId=owner', '?mine=true&designerId=other']) {
      const response = await get(query); assert.equal(response.status, 200);
      const data = await response.json();
      assert.deepEqual(data, [rows[0]]);
    }
  });
  await check('another designer and a stale admin session cannot request private work', async () => {
    actor = 'other';
    assert.equal((await get('?includeDrafts=true&designerId=owner')).status, 403);
    assert.equal(reads, 0);
    assert.deepEqual(await ids(await get('?includeDrafts=true')), ['fixture-other-active', 'fixture-public']);
  });
  await check('current database admin retains all-designer and selected-designer access', async () => {
    actor = 'admin'; storedRole = 'ADMIN';
    assert.deepEqual(await ids(await get('?includeDrafts=true')), rows.map(row => row.id));
    assert.deepEqual(await ids(await get('?includeDrafts=true&designerId=owner')), ['fixture-own-draft']);
    assert.deepEqual(await ids(await get('?mine=true&includeDrafts=true')), []);
  });
  await check('database failure does not return a successful empty list', async () => {
    failRead = true;
    const response = await get(''); assert.equal(response.status, 500);
    assert.equal((await response.json()).error, 'Failed to fetch projects');
  });
  console.log(`Project listing privacy: ${passed} checks passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });

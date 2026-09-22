const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const stamp = '2026-09-21T12:00:00.000Z';
async function run(options = {}) {
  const rows = [{ id: 'draft', designerId: 'actor', status: 'draft', updatedAt: new Date(stamp), imageUrls: [], exportedAt: null,
    project: { designerOrgId: null, ownerId: 'actor', designerId: 'actor' }, ...options.row },
  { id: 'untouched', designerId: 'actor', status: 'draft' }];
  const calls = [], invalidations = [];
  class Access extends Error { constructor(message, status) { super(message); this.status = status; } }
  const same = (row, where) => Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(item => same(row, item));
    if (key === 'imageUrls') return row.imageUrls.length === 0;
    if (key === 'updatedAt') return row.updatedAt.getTime() === value.getTime();
    if (value && typeof value === 'object') return same(row[key], value);
    return row[key] === value;
  });
  const tx = { user: { findUnique: async () => ({ role: options.freshRole || 'DESIGNER' }) },
    instagramExport: { deleteMany: async ({ where }) => { calls.push(where); const index = rows.findIndex(row => row.id === 'draft' && same(row, where)); if (index < 0) return { count: 0 }; rows.splice(index, 1); return { count: 1 }; } } };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    'next-auth': { getServerSession: async () => options.noSession ? null : { user: { id: 'actor', role: options.role || 'DESIGNER' } } },
    'next/cache': { revalidatePath: path => invalidations.push(path) },
    '@/app/api/auth/[...nextauth]/options': { authOptions: {} },
    '@/lib/permissions': { canAccessDesignerTools: role => ['DESIGNER','ADMIN'].includes(role) },
    '@/lib/prisma': { prisma: { $transaction: async (fn, settings) => { assert.equal(settings.isolationLevel, 'Serializable'); return fn(tx); } } },
    '@/lib/publishing-studio/data': { StudioAccessError: Access,
      getStudioData: async () => ({ workspace: { id: options.workspace || null }, feed: options.hidden ? [] : [{ kind: 'carousel', exportId: 'draft', canPolish: options.canPolish !== false, status: options.cardStatus || 'draft' }] }),
      resolvePublishingStudioContext: async (actor, client) => { assert.equal(actor, 'actor'); assert.equal(client, tx); return { id: options.freshWorkspace ?? options.workspace ?? null, canWriteCampaigns: options.writer || false }; } },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/api/publishing-studio/drafts/[id]/route.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Date, require: id => { if (!(id in mocks)) throw new Error(`Unmocked ${id}`); return mocks[id]; } });
  const result = await exports.DELETE({ json: async () => ({ updatedAt: options.updatedAt || stamp }) }, { params: { id: 'draft' } });
  assert.equal(invalidations.length, result.status === 200 ? 1 : 0, 'only successful deletion invalidates the Studio');
  if (invalidations.length) assert.equal(invalidations[0], '/designer/studio');
  return { result, rows, calls, invalidations };
}
(async () => {
  const removed = await run(); assert.equal(removed.result.status, 200); assert.equal(removed.rows.length, 1); assert.equal(removed.rows[0].id, 'untouched');
  for (const options of [{ row: { designerId: 'other' } }, { row: { status: 'generated' } }, { row: { status: 'exported' } }, { row: { status: 'published' } }, { row: { exportedAt: new Date() } }, { row: { imageUrls: ['stored-image'] } }, { updatedAt: '2026-09-20T12:00:00Z' }, { freshWorkspace: 'changed' }, { row: { project: { designerOrgId: 'foreign', ownerId: 'actor', designerId: 'actor' } } }]) {
    const check = await run(options); assert.equal(check.result.status, 409); assert.equal(check.rows.length, 2);
  }
  assert.equal((await run({ noSession: true })).result.status, 401);
  assert.equal((await run({ role: 'HOMEOWNER' })).result.status, 403);
  assert.equal((await run({ freshRole: 'HOMEOWNER' })).result.status, 403);
  assert.equal((await run({ hidden: true })).result.status, 404);
  assert.equal((await run({ canPolish: false })).result.status, 404);
  assert.equal((await run({ cardStatus: 'generated' })).result.status, 409);
  const organization = await run({ workspace: 'org', writer: true, row: { project: { designerOrgId: 'org', ownerId: 'colleague', designerId: 'colleague' } } });
  assert.equal(organization.result.status, 200, 'actor can discard own draft in an authorized writable org project');
  console.log('PASS draft removal: actor-only selected draft, fresh role/workspace, concurrency, artifact protection, and unrelated-record preservation.');
})().catch(error => { console.error(error); process.exitCode = 1; });

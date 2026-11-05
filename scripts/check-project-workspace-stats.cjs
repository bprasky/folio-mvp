// Real workspace listing query and permission rules with synthetic authentication
// and the existing schema-aware orchestration double. No network or database writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { memoryDatabase } = require('./core/memory-db.cjs');

const root = path.resolve(__dirname, '..');
const db = memoryDatabase();
let actor = 'owner';
const errors = [];
const cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    console: { log() {}, warn() {}, error: (...values) => errors.push(values.map(String).join(' ')) },
    require(name) {
      if (name === '@/lib/prisma') return { prisma: db };
      if (name === 'next-auth') return { getServerSession: async () => actor ? { user: { id: actor } } : null };
      if (name === '@/app/api/auth/[...nextauth]/options') return { authOptions: {} };
      if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts');
      throw Error('Unexpected dependency: ' + name);
    },
  });
  return exports;
}
const { getMyProjectsWithStats } = load('src/server/queries/getMyProjectsWithStats.ts');
const ids = rows => rows.map(row => row.id).sort();
async function main() {
  for (const id of ['owner', 'other']) await db.user.create({ data: { id, name: id, email: id + '@example.test', role: 'DESIGNER' } });
  for (const id of ['firm', 'other-firm']) await db.organization.create({ data: { id, name: id, type: 'DESIGN_FIRM' } });
  await db.organizationUser.create({ data: { userId: 'owner', organizationId: 'firm', role: 'MEMBER', isActive: true } });
  for (const [id, designerOrgId, ownerId] of [
    ['imported', 'firm', 'owner'], ['empty', 'firm', 'owner'], ['hidden', 'firm', 'owner'],
    ['other-project', 'other-firm', 'other'], ['personal', null, 'owner'],
  ]) await db.project.create({ data: { id, title: id, ownerId, designerOrgId, isPublic: false } });
  for (let i = 0; i < 15; i++) await db.room.create({ data: { id: 'room-' + i, projectId: 'imported', name: 'Room ' + i } });
  await db.room.create({ data: { projectId: 'other-project', name: 'Not this workspace' } });
  await db.room.create({ data: { projectId: 'hidden', name: 'Hidden project room' } });
  await db.room.create({ data: { projectId: 'personal', name: 'Personal room' } });
  for (let i = 0; i < 19; i++) await db.projectImage.create({ data: { id: 'image-' + i, projectId: 'imported', url: 'https://fixture.invalid/' + i + '.png' } });
  await db.projectImage.create({ data: { id: 'other-image', projectId: 'other-project', url: 'https://fixture.invalid/other.png' } });
  await db.projectDeletionRequest.create({ data: { projectId: 'hidden', requestedById: 'owner', status: 'PENDING' } });
  db.calls.length = 0;

  const listed = await getMyProjectsWithStats('firm');
  assert.deepEqual(ids(listed), ['empty', 'imported'], 'firm scope and pending-deletion hiding remain intact');
  const imported = listed.find(row => row.id === 'imported');
  assert.equal(imported.isPublic, false, 'private imported drafts remain visible to their workspace member');
  assert.equal(imported.roomCount, 15, 'saved rooms reach the project card instead of missing→zero');
  assert.equal(imported.imageCount, 19, 'saved photographs reach lifecycle classification');
  assert.equal(imported.coverUrl, 'https://fixture.invalid/0.png');
  assert.equal(imported.canDelete, false, 'member does not gain deletion rights from listing');
  const empty = listed.find(row => row.id === 'empty');
  assert.equal(empty.roomCount, 0);
  assert.equal(empty.imageCount, 0);
  assert.equal(db.calls.filter(call => call.model === 'Project' && call.method === 'findMany').length, 1, 'one project query for all counts');
  assert.equal(db.calls.filter(call => call.model === 'Room').length, 0, 'no per-project room queries');
  const images = db.calls.find(call => call.model === 'ProjectImage' && call.method === 'findMany');
  assert.deepEqual(images.args.where.projectId.in.sort(), ['empty', 'imported']);
  assert.equal(db.calls.some(call => ['create', 'update', 'upsert', 'delete', 'deleteMany', 'updateMany'].includes(call.method)), false);
  console.log('PASS private imported project counts, empty project counts, firm scope and bounded queries');

  db.calls.length = 0;
  assert.equal((await getMyProjectsWithStats('other-firm')).length, 0, 'nonmember cannot read another workspace');
  assert.equal(db.calls.some(call => call.model === 'Project'), false, 'membership denial precedes project reads');
  console.log('PASS nonmember denial before project/count reads');

  const personal = await getMyProjectsWithStats();
  assert.deepEqual(ids(personal), ['personal'], 'personal context does not absorb firm-owned projects');
  assert.equal(personal[0].roomCount, 1);
  assert.equal(personal[0].imageCount, 0);
  console.log('PASS personal room-only project retains saved progress');

  assert.deepEqual(errors, [], 'listing must not silently swallow a broken query');
  actor = null;
  db.calls.length = 0;
  assert.equal((await getMyProjectsWithStats('firm')).length, 0);
  assert.equal(db.calls.length, 0, 'signed-out request performs no database reads');
  console.log('PASS signed-out denial');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

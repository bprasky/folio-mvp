// Actual normalizer, routes and listing query with synthetic auth/Prisma boundaries.
// No credentials, database writes or external network access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const cache = new Map();
let actor = 'owner', canCreate = true, events = [], writes = [];
let savedDate = { completedYear: 2020, completedMonth: 8 };
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-05T12:00:00Z'])); }
}
const mocks = {
  'next/server': { NextResponse: { json: (value, init) => Response.json(value, init) } },
  'next-auth': { getServerSession: async () => actor ? { user: { id: actor, role: 'DESIGNER' } } : null },
  '@/app/api/auth/[...nextauth]/options': { authOptions: {} },
  '@/lib/permissions': { normalizeRole: role => role },
  '@/lib/orgPermissions': { canCreateFirmProject: () => canCreate, can: () => true, isOrgRole: () => true },
  '@/lib/analytics': { logPassiveEvent: async () => {} },
  '@/lib/dbEnv': { logDbEnv: () => {} },
  '@/lib/authz/access': { assertProjectWrite: async (userId, id) => {
    events.push('authorize');
    assert.equal(id, 'project');
    if (userId !== 'owner') throw new Error('Forbidden');
  } },
  '@/lib/spotlight/deletion': { deleteProjectWithSpotlightGuard: async () => { throw new Error('Unexpected delete'); } },
  '@/lib/spotlight/gate': { SpotlightConflict: class extends Error {} },
  '@/lib/posting/slug': { makeSlug: () => 'project' },
  '@/server/queries/filters': { PUBLISHED_PROJECT_FILTER: {} },
  '@/lib/prisma': { prisma: {
    user: { findUnique: async () => ({ operatingAsOrgId: 'firm', role: 'DESIGNER' }) },
    organizationUser: {
      findFirst: async () => ({ id: 'membership', role: 'OWNER', organization: { type: 'DESIGN_FIRM' } }),
      findMany: async () => [],
    },
    project: {
      create: async ({ data }) => { writes.push(structuredClone(data)); return { id: 'project' }; },
      findUnique: async ({ select }) => {
        if (!select) return null; // fresh create identity; date reads below remain asserted
        events.push('read-completion');
        assert.deepEqual(Object.keys(select).sort(), ['completedMonth', 'completedYear']);
        return structuredClone(savedDate);
      },
      update: async ({ data }) => { events.push('write'); writes.push(structuredClone(data)); return { id: 'project', ...data }; },
      findMany: async ({ where, select }) => {
        assert.equal(select.completedYear, true); assert.equal(select.completedMonth, true);
        assert.deepEqual(JSON.parse(JSON.stringify(where)), { OR: [{ designerOrgId: 'firm' }] });
        assert.equal('status' in where, false, 'author listing retains drafts');
        return [{ id: 'project', title: 'Fixture House', ownerId: 'owner', designerOrgId: 'firm', ...savedDate }];
      },
    },
    projectParticipant: { findMany: async () => [] },
    projectDeletionRequest: { findMany: async () => [] },
    projectImage: { findMany: async () => [] },
  } },
};
// Route writes now share one transaction; this fixture tests date orchestration only.
mocks['@/lib/prisma'].prisma.$transaction = work => work(mocks['@/lib/prisma'].prisma);
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file);
  const fixtureModule = { exports: {} };
  cache.set(file, fixtureModule.exports);
  const localRequire = name => {
    if (name in mocks) return mocks[name];
    const target = name.startsWith('@/') ? path.join(root, 'src', name.slice(2))
      : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null;
    return target ? load(target + '.ts') : require(name);
  };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
    Date: FixedDate, Buffer, Error, console: { log() {}, warn() {}, error() {} }, process: { env: { NODE_ENV: 'production' } },
  })(localRequire, fixtureModule, fixtureModule.exports);
  return fixtureModule.exports;
}

const { normalizeCreatePayload, CompletionDateSchema } = load('src/app/api/projects/normalizeCreatePayload.ts');
const { POST, PUT } = load('src/app/api/projects/route.ts');
const { getMyProjectsWithStats } = load('src/server/queries/getMyProjectsWithStats.ts');
const { compareCompletionDates, formatCompletionDate, completionDateInputError } = load('src/lib/projects/completionDate.ts');
const create = { title: 'Fixture House', projectStatus: 'completed_project', timeline: 'PAST' };
const request = (method, data) => new Request('https://folio.test/api/projects', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(method === 'POST' ? { requestId: require('node:crypto').randomUUID(), ...data } : data),
});
let count = 0;
async function test(name, work) {
  actor = 'owner'; canCreate = true; events = []; writes = [];
  savedDate = { completedYear: 2020, completedMonth: 8 };
  await work(); count++; console.log('PASS ' + name);
}
(async () => {
  await test('normalization preserves actual month/year and permits year-only archives', () => {
    const dated = normalizeCreatePayload({ ...create, completedYear: 2024, completedMonth: 11 });
    assert.equal(dated.completedYear, 2024); assert.equal(dated.completedMonth, 11);
    const yearOnly = normalizeCreatePayload({ ...create, completedYear: 1999, completedMonth: null });
    assert.equal(yearOnly.completedYear, 1999); assert.equal(yearOnly.completedMonth, null);
    assert.equal(CompletionDateSchema.safeParse({ completedYear: 2026, completedMonth: 10 }).success, true);
  });
  await test('existing canonical and legacy callers may omit dates; legacy dates are retained', () => {
    assert.doesNotThrow(() => normalizeCreatePayload(create));
    assert.doesNotThrow(() => normalizeCreatePayload({ name: 'Legacy House', projectStatus: 'new_project' }));
    const legacy = normalizeCreatePayload({ name: 'Legacy House', projectStatus: 'completed_project', completedYear: 1985, completedMonth: 4 });
    assert.equal(legacy.completedYear, 1985); assert.equal(legacy.completedMonth, 4);
  });
  await test('invalid or future completion values cannot pass canonical or legacy normalization', () => {
    const invalid = [
      { completedMonth: 2 }, { completedYear: null, completedMonth: 2 },
      { completedYear: 1799 }, { completedYear: 2027 }, { completedYear: 2024.5 }, { completedYear: '2024' },
      { completedYear: 2026, completedMonth: 11 }, { completedYear: 2024, completedMonth: 0 },
      { completedYear: 2024, completedMonth: 13 }, { completedYear: 2024, completedMonth: 1.5 },
    ];
    for (const date of invalid) {
      assert.throws(() => normalizeCreatePayload({ ...create, ...date }), { name: 'ZodError' });
      assert.throws(() => normalizeCreatePayload({ ...create, name: 'Legacy', ...date }), { name: 'ZodError' });
    }
  });
  await test('POST persists completion facts and preserves owner/firm/private project data', async () => {
    const response = await POST(request('POST', { ...create, designerOrgId: 'firm', completedYear: 2023, completedMonth: 9 }));
    assert.equal(response.status, 201); assert.equal(writes.length, 1);
    assert.equal(writes[0].completedYear, 2023); assert.equal(writes[0].completedMonth, 9);
    assert.equal(writes[0].ownerId, 'owner'); assert.equal(writes[0].designerId, 'owner');
    assert.equal(writes[0].designerOrgId, 'firm'); assert.equal(writes[0].isPublic, false);
    assert.equal(writes[0].publishedAt, null); assert.equal(writes[0].timeline, 'PAST');
  });
  await test('POST keeps an unknown month null and supports undated legacy projects', async () => {
    assert.equal((await POST(request('POST', { ...create, completedYear: 2001 }))).status, 201);
    assert.equal(writes[0].completedMonth, null);
    assert.equal((await POST(request('POST', { name: 'Legacy', projectStatus: 'new_project' }))).status, 201);
    assert.equal(writes[1].completedYear, null); assert.equal(writes[1].completedMonth, null);
  });
  await test('POST rejects bad dates, anonymous users and invalid firm permissions before writing', async () => {
    assert.equal((await POST(request('POST', { ...create, completedYear: 2027 }))).status, 422);
    actor = null;
    assert.equal((await POST(request('POST', create))).status, 401);
    actor = 'owner'; canCreate = false;
    assert.equal((await POST(request('POST', create))).status, 403);
    assert.equal(writes.length, 0);
  });
  await test('PUT validates partial completion changes against saved values and writes the pair', async () => {
    assert.equal((await PUT(request('PUT', { id: 'project', completedYear: 2021 }))).status, 200);
    assert.equal(writes[0].completedYear, 2021); assert.equal(writes[0].completedMonth, 8);
    assert.deepEqual(events, ['authorize', 'read-completion', 'write']);
    assert.equal((await PUT(request('PUT', { id: 'project', completedMonth: null }))).status, 200);
    assert.equal(writes[1].completedYear, 2020); assert.equal(writes[1].completedMonth, null);
  });
  await test('PUT rejects orphan months and future combinations formed by a partial change', async () => {
    assert.equal((await PUT(request('PUT', { id: 'project', completedYear: null }))).status, 422);
    savedDate = { completedYear: null, completedMonth: null };
    assert.equal((await PUT(request('PUT', { id: 'project', completedMonth: 4 }))).status, 422);
    savedDate = { completedYear: 2020, completedMonth: 12 };
    assert.equal((await PUT(request('PUT', { id: 'project', completedYear: 2026 }))).status, 422);
    assert.equal(writes.length, 0);
  });
  await test('PUT explicitly clears both completion fields and leaves dates alone for unrelated edits', async () => {
    assert.equal((await PUT(request('PUT', { id: 'project', completedYear: null, completedMonth: null }))).status, 200);
    assert.equal(writes[0].completedYear, null); assert.equal(writes[0].completedMonth, null);
    events = [];
    assert.equal((await PUT(request('PUT', { id: 'project', title: 'Renamed', isPublic: true, ownerId: 'other' }))).status, 200);
    assert.equal('completedYear' in writes[1], false); assert.equal('completedMonth' in writes[1], false);
    assert.equal('isPublic' in writes[1], false); assert.equal('ownerId' in writes[1], false);
    assert.deepEqual(events, ['authorize', 'write']);
  });
  await test('PUT refuses another user before reading completion values or writing', async () => {
    actor = 'other';
    assert.equal((await PUT(request('PUT', { id: 'project', completedYear: 2020 }))).status, 403);
    assert.deepEqual(events, ['authorize']); assert.equal(writes.length, 0);
  });
  await test('designer project listing returns stored date precision for sorting', async () => {
    savedDate = { completedYear: 1998, completedMonth: null };
    const projects = await getMyProjectsWithStats('firm');
    assert.equal(projects.length, 1); assert.equal(projects[0].completedYear, 1998);
    assert.equal(projects[0].completedMonth, null);
  });
  await test('completion sorting orders actual years and months newest first, with unknown precision last', () => {
    const projects = [
      { id: 'undated-first' },
      { id: 'year-only', completedYear: 2024, completedMonth: null },
      { id: 'may-first', completedYear: 2024, completedMonth: 5 },
      { id: 'older', completedYear: 2023, completedMonth: 12 },
      { id: 'newer-year', completedYear: 2025, completedMonth: null },
      { id: 'december', completedYear: 2024, completedMonth: 12 },
      { id: 'may-second', completedYear: 2024, completedMonth: 5 },
      { id: 'undated-second', completedYear: null, completedMonth: null },
    ];
    assert.deepEqual([...projects].sort(compareCompletionDates).map(project => project.id), [
      'newer-year', 'december', 'may-first', 'may-second', 'year-only', 'older', 'undated-first', 'undated-second',
    ]);
  });
  await test('completion labels preserve year-only precision and never invent a date for undated projects', () => {
    assert.equal(formatCompletionDate({ completedYear: 2024, completedMonth: 5 }), 'Completed May 2024');
    assert.equal(formatCompletionDate({ completedYear: 1998, completedMonth: null }), 'Completed 1998');
    assert.equal(formatCompletionDate({ completedYear: 1998 }), 'Completed 1998');
    assert.equal(formatCompletionDate({ completedYear: null, completedMonth: null }), null);
    assert.equal(formatCompletionDate({}), null);
  });
  await test('intake validation requires a valid year, permits unknown months and rejects future completion', () => {
    const now = new Date('2026-10-05T12:00:00Z');
    for (const [year, month] of [['1800', ''], ['1998', ''], ['2024', '5'], ['2026', '10']]) {
      assert.equal(completionDateInputError(year, month, now), null);
    }
    for (const [year, month] of [['', ''], [' ', '5'], ['1799', ''], ['2027', ''], ['2024.5', ''], ['unknown', ''], ['2024', '0'], ['2024', '13'], ['2026', '11']]) {
      assert.equal(typeof completionDateInputError(year, month, now), 'string', `reject ${year}/${month}`);
    }
  });
  console.log(`Project completion date: ${count} checks passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });

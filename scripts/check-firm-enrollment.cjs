// Deterministic regression double: proves service ordering/state, not PostgreSQL locking.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { memoryDatabase } = require('./core/memory-db.cjs');
const { factories } = require('./core/fixtures.cjs');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, URL, URLSearchParams, console,
    require: key => { if (!(key in mocks)) throw Error('Unexpected dependency: ' + key); return mocks[key]; },
    fetch: () => { throw Error('Network forbidden'); },
  });
  return exports;
}
const names = load('src/lib/onboarding/firm-name.ts');
const mapping = load('src/lib/onboarding/role-org-mapping.ts');
const response = { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } };
(async () => {
  const db = memoryDatabase(), fixtures = factories(db);
  const individual = await fixtures.user({ role: 'INDIVIDUAL' });
  const other = await fixtures.user({ role: 'INDIVIDUAL' });
  let session = { user: { id: individual.id } }, lockHeld = false, queue = Promise.resolve(), locks = 0;
  // Serialize test transactions and assert duplicate reads occur after the lock.
  // The SQL itself still needs an integration check against disposable Postgres.
  db.$transaction = work => {
    const result = queue.then(async () => { try { return await work(db); } finally { lockHeld = false; } });
    queue = result.catch(() => {}); return result;
  };
  db.$executeRaw = async sql => { assert.match(sql.join(''), /pg_advisory_xact_lock/); lockHeld = true; locks++; return 1; };
  db.$queryRaw = async (sql, key, excludeId) => {
    assert.ok(lockHeld, 'duplicate read must follow transaction lock');
    assert.match(sql.join(''), /regexp_replace/);
    return (await db.organization.findMany()).filter(org => names.normalizeFirmName(org.name) === key && org.id !== excludeId).slice(0, 1);
  };
  const service = load('src/lib/onboarding/create-firm.ts', { '@/lib/prisma': { prisma: db }, '@prisma/client': require('@prisma/client'), './role-org-mapping': mapping, './firm-name': names });
  const common = { 'next/server': response, 'next-auth': { getServerSession: async () => session }, '@prisma/client': require('@prisma/client'), zod: require('zod'), '@/app/api/auth/[...nextauth]/options': { authOptions: {} }, '@/lib/onboarding/create-firm': service };
  const api = load('src/app/api/auth/org-setup/route.ts', common);
  const request = body => ({ json: async () => body });
  const body = { name: '  North   Studio ', type: 'designer', confirmed: true };
  session = null;
  assert.equal((await api.POST(request(body))).status, 401);
  assert.equal(await db.organization.count(), 0);
  session = { user: { id: individual.id } };
  assert.equal((await api.POST(request({ ...body, confirmed: false }))).status, 400);
  assert.equal((await api.POST(request({ ...body, confirmed: undefined }))).status, 400);
  assert.equal(await db.organization.count(), 0);
  const created = await api.POST(request(body));
  assert.equal(created.status, 201);
  const org = await db.organization.findUnique({ where: { id: created.body.organizationId } });
  assert.equal(org.name, 'North Studio'); assert.equal(org.status, 'CLAIMED');
  assert.equal(org.createdById, individual.id); assert.equal(org.capabilities.join(','), 'DESIGN_FIRM');
  assert.ok(!org.verifiedAt); assert.ok(!org.verifiedBy);
  const member = await db.organizationUser.findFirst({ where: { userId: individual.id, organizationId: org.id } });
  assert.equal(member.role, 'OWNER'); assert.equal(member.isActive, true);
  let user = await db.user.findUnique({ where: { id: individual.id } });
  assert.equal(user.role, 'DESIGNER'); assert.equal(user.operatingAsOrgId, org.id);
  for (const field of ['onboardingDiagnosticAt', 'onboardingFirmContextAt', 'onboardingBioCaptureAt', 'onboardingProfilePreviewAt']) assert.ok(user[field] instanceof Date, field);
  assert.equal((await api.POST(request(body))).status, 409, 'identical retry returns existing firm');
  session = { user: { id: other.id } };
  const duplicate = await api.POST(request({ name: ' NORTH \t Studio ', type: 'vendor', confirmed: true }));
  assert.equal(duplicate.status, 409); assert.equal(duplicate.body.organization.id, org.id);
  assert.equal(await db.organization.count(), 1); assert.equal(await db.organizationUser.count({ where: { userId: other.id } }), 0, 'duplicate must not grant membership');
  session = { user: { id: individual.id } };
  const second = await api.POST(request({ name: 'Side Practice', type: 'vendor', confirmed: true }));
  assert.equal(second.status, 201); assert.equal(await db.user.count(), 2, 'no second identity');
  user = await db.user.findUnique({ where: { id: individual.id } });
  assert.equal(user.role, 'DESIGNER', 'second firm preserves existing global role');
  assert.equal(user.operatingAsOrgId, second.body.organizationId);
  assert.equal(await db.organizationUser.count({ where: { userId: individual.id } }), 2);
  const concurrent = await Promise.allSettled([
    service.createFirm({ userId: individual.id, name: 'Concurrent Firm', type: 'DESIGN_FIRM' }),
    service.createFirm({ userId: other.id, name: ' concurrent  firm ', type: 'VENDOR' }),
  ]);
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = concurrent.find(result => result.status === 'rejected');
  assert.ok(rejected.reason instanceof service.FirmAlreadyExists);
  assert.equal(await db.organization.count(), 3); assert.ok(locks >= 5);
  for (const file of ['src/app/api/orgs/route.ts', 'src/app/api/organizations/route.ts']) {
    const legacy = load(file, { ...common, '@/lib/prisma': { prisma: db }, '@/app/api/auth/org-setup/route': api });
    assert.equal(legacy.POST, api.POST, file + ' shares authenticated confirmed mutation');
  }
  assert.equal(names.normalizeFirmName(' \t North  STUDIO\n'), 'north studio');
  assert.notEqual(names.normalizeFirmName('North Studio East'), names.normalizeFirmName('North Studio'));
  console.log('PASS firm enrollment: auth/confirmation, normalized duplicates across types, no duplicate membership, claimed owner/workspace/onboarding, separate firm same identity, retry and serialized race, legacy mutation reuse. PostgreSQL lock behavior not simulated as proof.');
})().catch(error => { console.error(error); process.exitCode = 1; });

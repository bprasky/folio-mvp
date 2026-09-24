const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: key => { if (!(key in mocks)) throw Error(key); return mocks[key]; }, process: { env: { NEXTAUTH_URL: 'https://folio.test' } }, Date, URL, console });
  return exports;
}
let calls, db, pending, member, emails, notifyCalls, session;
function reset() {
  calls = []; emails = []; pending = null; member = null; notifyCalls = 0; session = { user: { id: 'requester' } };
  db = {
    organization: { findUnique: async () => ({ id: 'org', name: '<Firm>', type: 'DESIGNER' }) },
    organizationUser: {
      findUnique: async () => member,
      findFirst: async () => member,
      findMany: async args => { calls.push(['recipients', args]); return [{ userId: 'admin', user: { email: 'admin@example.test' } }]; },
      upsert: async args => calls.push(['membership', args]),
    },
    user: { findUnique: async () => ({ name: '<Requester>', email: 'r@example.test' }), update: async args => calls.push(['user', args]), updateMany: async args => calls.push(['user', args]) },
    orgJoinRequest: {
      findUnique: async () => pending,
      findUniqueOrThrow: async () => ({ id: 'jr' }),
      create: async () => { pending = { id: 'jr', status: 'PENDING' }; },
      updateMany: async args => { calls.push(['review', args]); return { count: 1 }; },
    },
    conversation: { create: async args => { calls.push(['conversation', args]); return { id: 'thread' }; } },
    message: { create: async () => {} }, conversationParticipant: { createMany: async () => {} },
    notification: { create: async args => { calls.push(['bell', args]); return { id: 'bell' }; }, update: async args => calls.push(['emailStatus', args]) },
  };
  db.$transaction = async fn => fn(db);
}
function route() {
  return load('src/app/api/orgs/[orgId]/join/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    'next-auth': { getServerSession: async () => session }, '@/app/api/auth/[...nextauth]/options': { authOptions: {} },
    '@/lib/prisma': { prisma: db }, '@/lib/onboarding/role-org-mapping': { roleForOrgType: () => 'DESIGNER' },
    '@/lib/notifications/org-join': { notifyOrgJoinRequest: async () => { notifyCalls++; } }, 'next/cache': { revalidatePath: () => {} },
  });
}
const req = body => ({ json: async () => body });
const params = { params: { orgId: 'org' } };
(async () => {
  reset();
  const helper = load('src/lib/notifications/org-join.ts', { 'server-only': {}, '@/lib/prisma': { prisma: db }, '@/lib/email/sendEmail': { sendEmail: async args => { emails.push(args); return { success: false, error: 'Email delivery is not configured' }; } } });
  const status = await helper.notifyOrgJoinRequest({ orgId: 'org', orgName: '<Firm>', requesterId: 'requester', joinRequestId: 'jr' });
  assert.equal(status.inApp, true); assert.equal(status.email, 'failed');
  const recipients = calls.find(c => c[0] === 'recipients')[1].where;
  assert.equal(recipients.isActive, true); assert.equal(recipients.userId.not, 'requester');
  assert.equal(recipients.role.in.join(','), 'OWNER,ADMIN');
  assert.equal(calls.find(c => c[0] === 'bell')[1].data.actionUrl, '/inbox/thread');
  assert.equal(calls.find(c => c[0] === 'conversation')[1].data.structuredData.joinRequestId, 'jr');
  assert.ok(emails[0].html.includes('&lt;Requester&gt;')); assert.ok(emails[0].html.includes('&lt;Firm&gt;'));
  assert.ok(emails[0].html.includes('https://folio.test/inbox/thread'));
  assert.equal(calls.find(c => c[0] === 'emailStatus')[1].data.metadata.emailStatus, 'failed');
  db.organizationUser.findMany = async () => [];
  const unavailable = await helper.notifyOrgJoinRequest({ orgId: 'org', orgName: 'Firm', requesterId: 'requester', joinRequestId: 'jr' });
  assert.equal(unavailable.inApp, false); assert.equal(unavailable.email, 'unavailable'); assert.equal(emails.length, 1);
  reset(); let api = route(); assert.equal((await api.POST(req({}), params)).status, 201); assert.equal(notifyCalls, 1);
  assert.equal((await api.POST(req({}), params)).status, 200); assert.equal(notifyCalls, 1, 'pending retry does not resend');
  const noAdminRetry = await api.POST(req({}), params);
  assert.equal(noAdminRetry.body.notifications.adminAvailable, false);
  assert.equal(noAdminRetry.body.notifications.inApp, false, 'no-admin guidance survives pending retry');
  db.organizationUser.findFirst = async args => {
    assert.equal(args.where.organizationId, 'org'); assert.equal(args.where.isActive, true);
    assert.equal(args.where.role.in.join(','), 'OWNER,ADMIN'); assert.equal(args.where.userId.not, 'requester');
    return { id: 'new-admin-membership' };
  };
  const recoveredRetry = await api.POST(req({}), params);
  assert.equal(recoveredRetry.body.notifications.adminAvailable, true, 'new admin availability is checked on retry');
  assert.equal(recoveredRetry.body.notifications.inApp, undefined, 'retry never claims delivery');
  assert.equal(notifyCalls, 1, 'admin recovery check does not resend');
  reset(); db.orgJoinRequest.create = async () => { throw Object.assign(new Error('concurrent request'), { code: 'P2002' }); };
  const concurrent = await route().POST(req({}), params);
  assert.equal(concurrent.status, 200);
  assert.equal(concurrent.body.notifications.adminAvailable, false, 'concurrent retry preserves no-admin recovery');
  assert.equal(notifyCalls, 0, 'concurrent loser does not notify twice');
  reset(); member = { isActive: false, role: 'OWNER' }; pending = { id: 'jr', status: 'APPROVED' };
  assert.equal((await route().POST(req({ message: 123 }), params)).status, 201, 'former member may request access');
  assert.equal(calls.some(c => c[0] === 'membership'), false, 'request cannot activate membership');
  reset(); session = null; assert.equal((await route().POST(req({}), params)).status, 401);
  reset(); assert.equal((await route().PATCH(req({ requestId: 'jr', action: 'approve' }), params)).status, 403);
  reset(); member = { isActive: false, role: 'OWNER' }; db.organizationUser.findFirst = async () => ({ role: 'ADMIN', isActive: true });
  pending = { id: 'jr', status: 'PENDING', organizationId: 'org', userId: 'requester', user: { name: 'Requester' } };
  assert.equal((await route().PATCH(req({ requestId: 'jr', action: 'approve' }), params)).status, 200);
  assert.equal(calls.find(c => c[0] === 'membership')[1].update.role, 'MEMBER');
  assert.equal(calls.find(c => c[0] === 'user' && c[1].data.operatingAsOrgId)[1].where.operatingAsOrgId, null, 'approval preserves selected workspace');
  console.log('PASS org join: scoped admin bell/inbox/email, escaped copy, truthful failure, pending idempotency, former-member approval, auth and workspace guards');
})().catch(error => { console.error(error); process.exitCode = 1; });

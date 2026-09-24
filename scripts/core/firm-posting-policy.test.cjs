const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const h = require('./harness.cjs');
const { can } = require(resolve('src/lib/orgPermissions.ts'));
const { canPublishFromOrg } = require(resolve('src/lib/permissions.ts'));
const { assertProjectPublish, assertProjectUnpublish } = require(resolve('src/lib/authz/access.ts'));

test('member posting policy never grants leadership or viewer access', () => {
  assert.equal(can('MEMBER', 'publish_projects'), true);
  assert.equal(can('MEMBER', 'publish_projects', { membersCanPublish: false }), false);
  for (const role of ['OWNER', 'ADMIN', 'MANAGER']) {
    assert.equal(can(role, 'publish_projects', { membersCanPublish: false }), true);
  }
  assert.equal(can('VIEWER', 'publish_projects'), false);
  assert.equal(can('MEMBER', 'change_member_roles'), false);
  assert.equal(can('MEMBER', 'delete_projects'), false);
});

test('publish gate scopes active membership and policy to the backing firm', async () => {
  let firm = { status: 'CLAIMED', membersCanPublish: true, users: [{ role: 'MEMBER' }] };
  h.useDatabase({ organization: { findUnique: async query => {
    assert.equal(query.where.id, 'firm');
    assert.deepEqual(query.select.users.where, { userId: 'person', isActive: true });
    return firm;
  } } });
  assert.deepEqual(await canPublishFromOrg('person', 'firm'), { ok: true });
  firm.membersCanPublish = false;
  assert.deepEqual(await canPublishFromOrg('person', 'firm'), { ok: false, reason: 'posting_restricted' });
  firm.users = [];
  assert.deepEqual(await canPublishFromOrg('person', 'firm'), { ok: false, reason: 'not_a_member' });
  firm.users = [{ role: 'OWNER' }]; firm.status = 'UNCLAIMED';
  assert.deepEqual(await canPublishFromOrg('person', 'firm'), { ok: false, reason: 'org_unclaimed' });
});

test('a personal project owner cannot publish without a firm but can withdraw work', async () => {
  h.useDatabase({
    project: { findUnique: async () => ({ ownerId: 'person', designerId: 'person', designerOrgId: null }) },
    user: { findUnique: async () => ({ role: 'DESIGNER' }) },
  });
  await assert.rejects(assertProjectPublish('person', 'project'), /Forbidden/);
  await assertProjectUnpublish('person', 'project');
});

test('an opted-out member can withdraw existing firm work', async () => {
  h.useDatabase({
    project: { findUnique: async () => ({ designerOrgId: 'firm' }) },
    user: { findUnique: async () => ({ role: 'DESIGNER' }) },
    organizationUser: { findFirst: async () => ({ role: 'MEMBER' }) },
    organization: { findUnique: async () => ({ status: 'CLAIMED', membersCanPublish: false, users: [{ role: 'MEMBER' }] }) },
  });
  await assert.rejects(assertProjectPublish('person', 'project'), /Forbidden/);
  await assertProjectUnpublish('person', 'project');
});

test('transaction-backed posting rejects browsing accounts and firm opt-outs', async () => {
  const tx = {
    user: { findUnique: async () => ({ operatingAsOrgId: null }) },
    organizationUser: { findMany: async () => [] },
    organization: { findUnique: async () => ({ status: 'CLAIMED', membersCanPublish: false, users: [{ role: 'MEMBER' }] }) },
  };
  assert.deepEqual(await canPublishFromOrg('person', null, tx), { ok: false, reason: 'no_org' });
  assert.deepEqual(await canPublishFromOrg('person', 'firm', tx), { ok: false, reason: 'posting_restricted' });
});

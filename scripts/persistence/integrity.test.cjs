// Real handlers with Prisma/storage doubles. This is not process-restart or live DB proof.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const h = require('../core/harness.cjs');
process.env.INTERVIEW_MEDIA_BUCKET = 'interview-media';
const webmFixture = Buffer.from([0x1a,0x45,0xdf,0xa3,0x9f,0x42,0x82,0x84,0x77,0x65,0x62,0x6d,0,0,0]);
const { memoryDatabase } = require('../core/memory-db.cjs');
const { factories } = require('../core/fixtures.cjs');
const { NextRequest } = require('next/server');
const retired = [
  {
    "route": "get-designer-profile",
    "methods": [
      "GET"
    ]
  },
  {
    "route": "update-designer-profile",
    "methods": [
      "POST"
    ]
  },
  {
    "route": "set-active-profile",
    "methods": [
      "POST"
    ]
  },
  {
    "route": "assign-projects",
    "methods": [
      "POST"
    ]
  },
  {
    "route": "export-all-tagged-products",
    "methods": [
      "GET"
    ]
  },
  {
    "route": "export-project-tags",
    "methods": [
      "GET"
    ]
  },
  {
    "route": "export-tearsheet",
    "methods": [
      "GET"
    ]
  },
  {
    "route": "videos/[id]",
    "methods": [
      "GET",
      "PUT",
      "DELETE"
    ]
  },
  {
    "route": "videos/clips",
    "methods": [
      "GET",
      "POST"
    ]
  },
  {
    "route": "inspire",
    "methods": [
      "GET",
      "POST"
    ]
  },
  {
    "route": "event-import",
    "methods": [
      "GET"
    ]
  },
  {
    "route": "projects/handoff",
    "methods": [
      "GET",
      "PUT",
      "POST"
    ]
  },
  {
    "route": "designer/folders/[id]/assign-sections",
    "methods": [
      "POST"
    ]
  },
  {
    "route": "vendor-actions/create-appreciation-dinner",
    "methods": [
      "POST"
    ]
  },
  {
    "route": "vendor/projects/[id]/quick-actions/offer-boost",
    "methods": [
      "POST"
    ]
  },
  {
    "route": "vendor/projects/[id]/quick-actions/invite-to-event",
    "methods": [
      "POST"
    ]
  },
  {
    "route": "vendor/projects/[id]/quick-actions/request-missing",
    "methods": [
      "POST"
    ]
  },
  {
    "route": "vendor/projects/[id]/quick-actions/extend-discount",
    "methods": [
      "POST"
    ]
  },
  {
    "route": "vendor/actions/promote-project",
    "methods": [
      "POST"
    ]
  },
  {
    "route": "vendor/actions/priority-support",
    "methods": [
      "POST"
    ]
  },
  {
    "route": "vendor/actions/confirm-spec",
    "methods": [
      "POST"
    ]
  },
  {
    "route": "vendor/actions/invite-event",
    "methods": [
      "POST"
    ]
  },
  {
    "route": "rep-contacts/request-spec",
    "methods": [
      "POST"
    ]
  },
  {
    "route": "events/[id]/live-activity",
    "methods": [
      "GET"
    ]
  }
];

let failStorage = false;
const objects = new Map();
const storageCalls = [];
const supabasePath = require.resolve(resolve('src/lib/supabaseAdmin.ts'));
require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: {
  supabaseAdmin: { storage: { from: bucket => ({
    upload: async (key, bytes, options) => {
      storageCalls.push({ bucket, key, options });
      if (failStorage) return { error: new Error('Fixture storage outage') };
      objects.set(key, Buffer.from(bytes));
      return { data: { path: key }, error: null };
    },
    getPublicUrl: key => ({ data: { publicUrl: 'https://storage.test/' + key } }),
  }) } },
} };

async function setup() {
  const db = memoryDatabase(); h.useDatabase(db);
  const f = factories(db); const owner = await f.user(); const other = await f.user();
  const project = await f.project(owner.id);
  await h.login(owner); objects.clear(); storageCalls.length = 0; failStorage = false;
  return { db, f, owner, other, project };
}
function uploadRequest(projectId, type = 'application/pdf', content = '%PDF-fixture', includeFile = true) {
  const form = new FormData();
  if (projectId !== undefined) form.set('projectId', projectId);
  if (includeFile) form.set('file', new Blob([content], { type }), 'fixture.pdf');
  return new NextRequest('http://folio.test/api/upload-spec-sheet', { method: 'POST', body: form });
}

retired.push({ route: 'vendor/invite-designer', methods: ['POST'] }, { route: 'vendor/qbr', methods: ['GET'] });
for (const { route, methods } of retired) {
  test('retired /api/' + route + ' rejects every old method without data or writes', async () => {
    const { db } = await setup();
    for (const authenticated of [true, false]) {
      if (!authenticated) h.anonymous();
      for (const method of methods) {
        const before = db.calls.length;
        const request = method === 'GET' ? h.request(undefined) : h.request({ id: 'spoofed', ownerId: 'spoofed', title: 'Draft' }, method);
        const response = await h.route(route)[method](request, { params: { id: 'old-id' } });
        assert.equal(response.status, 410, method);
        const body = await response.json();
        assert.equal(body.code, 'ENDPOINT_RETIRED');
        assert.equal(typeof body.error, 'string');
        assert.equal(body.success, undefined);
        assert.equal(body.ok, undefined);
        assert.deepEqual(Object.keys(body).sort(), ['code', 'error']);
        assert.equal(db.calls.length, before);
        assert.equal(storageCalls.length, 0);
      }
    }
  });
}

test('spec sheets require authenticated project write access, validated file and successful object upload', async () => {
  const { db, f, owner, other, project } = await setup();
  const post = h.route('upload-spec-sheet').POST;
  h.anonymous(); assert.equal((await post(uploadRequest(project.id))).status, 401);
  await h.login(other); assert.equal((await post(uploadRequest(project.id))).status, 403);
  assert.equal(storageCalls.length, 0);
  await h.login(owner);
  assert.equal((await post(uploadRequest(undefined))).status, 400);
  assert.equal((await post(uploadRequest('absent'))).status, 404);
  assert.equal((await post(uploadRequest(project.id, 'text/html'))).status, 400);
  assert.equal((await post(uploadRequest(project.id, 'application/msword'))).status, 400);
  assert.equal((await post(uploadRequest(project.id, 'application/pdf', ''))).status, 400);
  assert.equal((await post(uploadRequest(project.id, 'application/pdf', 'x', false))).status, 400);
  assert.equal((await post(uploadRequest(project.id, 'application/pdf', 'x'.repeat(10 * 1024 * 1024 + 1)))).status, 400);
  failStorage = true;
  const failed = await post(uploadRequest(project.id)); assert.equal(failed.status, 500);
  assert.equal((await failed.json()).success, undefined);
  failStorage = false;
  const response = await post(uploadRequest(project.id)); assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(storageCalls.at(-1).bucket, 'imports');
  const key = body.url.replace('https://storage.test/', '');
  assert.match(key, new RegExp('^projects/' + project.id + '/spec-sheets/'));
  assert.equal(objects.get(key).toString(), '%PDF-fixture');
  // Existing Selection fields remain the durable association; separate save/read.
  const room = await f.room(project.id);
  const create = h.route('projects/[id]/rooms/[roomId]/selections').POST;
  const saved = await create(h.request({ productName: 'Fixture chair', specSheetUrl: body.url, specSheetFileName: body.fileName }), { params: { id: project.id, roomId: room.id } });
  assert.equal(saved.status, 200);
  const selection = await saved.json();
  assert.equal((await db.selection.findUnique({ where: { id: selection.id } })).specSheetUrl, body.url);
});

test('image reupload cannot acknowledge a failed database write and forbids other users', async () => {
  const { db, f, owner, other, project } = await setup();
  const image = await f.image(project.id);
  const post = h.route('projects/[id]/images/reupload-client').POST;
  const req = () => h.request({ imageId: image.id, imageData: Buffer.from('image').toString('base64'), mimeType: 'image/png' });
  await h.login(other); assert.equal((await post(req(), { params: { id: project.id } })).status, 403);
  await h.login(owner);
  const real = db.projectImage;
  const failing = new Proxy(db, { get: (target, key) => key === 'projectImage' ? new Proxy(real, { get: (model, operation) => operation === 'update' ? async () => { throw new Error('Fixture database outage'); } : model[operation] }) : target[key] });
  h.useDatabase(failing); await h.login(owner);
  const failed = await post(req(), { params: { id: project.id } });
  assert.equal(failed.status, 500); assert.equal((await failed.json()).success, undefined);
  assert.equal((await db.projectImage.findUnique({ where: { id: image.id } })).url, image.url);
  h.useDatabase(db); await h.login(owner);
  const saved = await post(req(), { params: { id: project.id } }); assert.equal(saved.status, 200);
  assert.equal((await db.projectImage.findUnique({ where: { id: image.id } })).url, (await saved.json()).newUrl);
});

test('admin export notice checks database role; no export data is returned', async () => {
  const { db, f, owner } = await setup();
  global.React = require('react');
  const page = require(resolve('src/app/admin/export/page.tsx')).default;
  h.anonymous(); await assert.rejects(page, /NEXT_REDIRECT/);
  await h.login(owner); await assert.rejects(page, /NEXT_NOT_FOUND/);
  const admin = await f.user({ role: 'ADMIN' }); await h.login(admin);
  const html = require('react-dom/server').renderToStaticMarkup(await page());
  assert.match(html, /Legacy export retired/); assert.doesNotMatch(html, /<table/);
  assert.match(html, /href="\/designer"/);
  await db.user.update({ where: { id: admin.id }, data: { role: 'DESIGNER' } });
  await assert.rejects(page, /NEXT_NOT_FOUND/);
});

test('canonical recorded upload still writes storage then MediaAsset and InterviewSession', async () => {
  const { db, owner, other, project } = await setup();
  const id = randomUUID();
  await db.interviewSession.create({ data: { id, createdByUserId: owner.id, projectId: project.id, status: 'DRAFT', mode: 'AUDIO', updatedAt: new Date() } });
  const post = h.route('interviews/[id]/upload').POST;
  const req = () => uploadRequest(project.id, 'audio/webm', webmFixture);
  await h.login(other); assert.equal((await post(req(), { params: { id } })).status, 403);
  await h.login(owner); failStorage = true;
  assert.equal((await post(req(), { params: { id } })).status, 502);
  assert.equal((await db.interviewSession.findUnique({ where: { id } })).status, 'DRAFT');
  failStorage = false;
  const response = await post(req(), { params: { id } }); assert.equal(response.status, 200);
  const state = await db.interviewSession.findUnique({ where: { id } });
  assert.equal(state.status, 'UPLOADED');
  const asset = await db.mediaAsset.findUnique({ where: { id: state.recordingAssetId } });
  assert.match(asset.storageKey, new RegExp('^interviews/' + id + '/'));
  assert.deepEqual(objects.get(asset.storageKey), webmFixture);
});

test('upgrade requests retain requested details for claimed organizations and reject nonmembers', async () => {
  const { db, f, owner, other } = await setup();
  const org = await f.organization(); await f.membership(owner.id, org.id);
  const post = h.route('orgs/share-upgrade-request').POST;
  const req = () => h.request({ orgId: org.id, featureRequested: 'Fixture export' });
  await h.login(other); assert.equal((await post(req())).status, 403);
  await h.login(owner); assert.equal((await post(req())).status, 200);
  const saved = await db.organization.findUnique({ where: { id: org.id } });
  assert.match(saved.salesNotes, /Fixture export/);
});

test('missing email configuration never acknowledges sending', async () => {
  delete process.env.RESEND_API_KEY;
  const modulePath = require.resolve(resolve('src/lib/email/sendEmail.ts'));
  delete require.cache[modulePath];
  const { sendEmail, sendProxyEmail } = require(modulePath);
  const input = { to: 'fixture@example.test', subject: 'Fixture', html: 'Fixture', text: 'Fixture', from: 'fixture@example.test', replyTo: 'fixture@example.test' };
  assert.equal((await sendEmail(input)).success, false);
  assert.equal((await sendProxyEmail(input)).success, false);
});

test('retired analytics, invitation and QBR surfaces render notices without fictional account data', () => {
  global.React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Analytics = require(resolve('src/app/designer/analytics/page.tsx')).default;
  const Invites = require(resolve('src/components/vendor/SmartInvitesCard.tsx')).default;
  const { QBRExportButton } = require(resolve('src/components/vendor/ai/QBRExportButton.tsx'));
  for (const tree of [Analytics(), Invites({ vendorId: 'fixture' }), QBRExportButton()]) {
    const html = renderToStaticMarkup(tree);
    assert.match(html, /retired/);
    assert.doesNotMatch(html, /Sarah|Marcus|Emma|sent!|<button|<table/);
  }
});

test('retained vendor sample analytics are explicitly labeled as fictional demo data', () => {
  global.React = require('react');
  const Dashboard = require(resolve('src/components/vendor/VendorAnalyticsDashboard.tsx')).default;
  const html = require('react-dom/server').renderToStaticMarkup(React.createElement(Dashboard));
  assert.match(html, /Sample vendor analytics \(demo\)/);
  assert.match(html, /Fictional sample data/);
  assert.match(html, /not your account analytics/);
});

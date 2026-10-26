const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const h = require('./harness.cjs');
const { memoryDatabase } = require('./memory-db.cjs');
const { factories } = require('./fixtures.cjs');

async function suite(t, db) {
  h.useDatabase(db);
  const f = factories(db), r = h.request;
  const a = await f.user(), b = await f.user(), viewer = await f.user(), editor = await f.user(), admin = await f.user({ role: 'ADMIN' });
  const pa = await f.project(a.id), pb = await f.project(b.id);
  const ra = await f.room(pa.id), rb = await f.room(pb.id);
  const ia = await f.image(pa.id, { room: ra.name }), ib = await f.image(pb.id);
  const product = await f.product();
  const sb = await db.selection.create({ data: { projectId: pb.id, roomId: rb.id, productName: 'Private selection' } });
  await db.projectParticipant.create({ data: { projectId: pa.id, userId: viewer.id, role: 'VIEWER', side: 'DESIGNER' } });
  await db.projectParticipant.create({ data: { projectId: pa.id, userId: editor.id, role: 'EDITOR', side: 'DESIGNER' } });
  const rooms = h.route('projects/[id]/rooms'), room = h.route('projects/[id]/rooms/[roomId]');
  const image = h.route('projects/[id]/images/[imageId]'), reorder = h.route('projects/[id]/images/reorder');
  const tags = h.route('tag-product-to-image');
  const ctx = (id, more = {}) => ({ params: { id, ...more } });
  const tagBody = { projectId: pa.id, imageId: ia.id, productId: product.id, x: 25, y: 75, createSelection: true };
  const expect = async (response, status) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };

  await t.test('anonymous cannot mutate projects, rooms, photos, tags, interview, publication or admin projects', async () => {
    h.anonymous();
    for (const response of [
      await rooms.POST(r({ name: 'Attack' }), ctx(pa.id)),
      await room.DELETE(r({}, 'DELETE'), ctx(pa.id, { roomId: ra.id })),
      await image.PATCH(r({ room: 'Attack' }, 'PATCH'), ctx(pa.id, { imageId: ia.id })),
      await reorder.PATCH(r({ imageIds: [ia.id] }, 'PATCH'), ctx(pa.id)),
      await tags.POST(r(tagBody)),
      await h.route('posting/project/[projectId]/interview').POST(r({}), { params: { projectId: pa.id } }),
      await h.route('posting/project/[projectId]/status').PATCH(r({ action: 'publish' }, 'PATCH'), { params: { projectId: pa.id } }),
      await h.route('admin/projects').POST(r({})),
    ]) await expect(response, 401);
  });
  await t.test('two designers cannot read/write each other; nested foreign room delete preserves selections', async () => {
    await h.login(a);
    const denied = await room.DELETE(r({}, 'DELETE'), ctx(pa.id, { roomId: rb.id }));
    assert.ok(await db.selection.findUnique({ where: { id: sb.id } }), 'foreign selections must survive a failed nested delete');
    await expect(denied, 404);
    assert.ok(await db.room.findUnique({ where: { id: rb.id } }));
    await expect(await image.PATCH(r({ room: 'Attack' }, 'PATCH'), ctx(pa.id, { imageId: ib.id })), 404);
    await expect(await reorder.PATCH(r({ imageIds: [ib.id] }, 'PATCH'), ctx(pa.id)), 400);
    await expect(await tags.POST(r({ ...tagBody, imageId: ib.id })), 404);
    await h.login(b);
    await expect(await rooms.GET(r(), ctx(pa.id)), 403);
    await expect(await rooms.POST(r({ name: 'Attack' }), ctx(pa.id)), 403);
    await expect(await tags.POST(r(tagBody)), 403);
    await expect(await h.route('admin/projects').POST(r({})), 403);
  });
  await t.test('viewer shares remain readable, but cannot create rooms or reorder; editor and admin can write', async () => {
    await h.login(viewer);
    await expect(await rooms.GET(r(), ctx(pa.id)), 200);
    await expect(await rooms.POST(r({ name: 'Attack' }), ctx(pa.id)), 403);
    await expect(await reorder.PATCH(r({ imageIds: [ia.id] }, 'PATCH'), ctx(pa.id)), 403);
    await expect(await room.PUT(r({ name: 'Attack' }, 'PUT'), ctx(pa.id, { roomId: ra.id })), 403);
    for (const user of [editor, admin]) {
      await h.login(user);
      await expect(await reorder.PATCH(r({ imageIds: [ia.id] }, 'PATCH'), ctx(pa.id)), 200);
      await expect(await rooms.POST(r({ name: `Room ${user.id}` }), ctx(pa.id)), 200);
    }
  });
  await t.test('validation fails before writes; duplicate tag submission returns same tag and selection', async () => {
    await h.login(a);
    for (const name of ['', ' ', 1, {}, null]) await expect(await rooms.POST(r({ name }), ctx(pa.id)), 400);
    for (const roomValue of [1, {}, []]) await expect(await image.PATCH(r({ room: roomValue }, 'PATCH'), ctx(pa.id, { imageId: ia.id })), 400);
    for (const x of [-1, 101, '20', null]) await expect(await tags.POST(r({ ...tagBody, x })), 400);
    await expect(await reorder.PATCH(r({ imageIds: [ia.id, ia.id] }, 'PATCH'), ctx(pa.id)), 400);
    const first = await expect(await tags.POST(r(tagBody)), 200);
    const second = await expect(await tags.POST(r(tagBody)), 200);
    assert.equal(first.id, second.id); assert.equal(first.linkedSelectionId, second.linkedSelectionId);
    assert.equal(await db.productTag.count({ where: { imageId: ia.id } }), 1);
    assert.equal(await db.selection.count({ where: { productTagId: first.id } }), 1);
    assert.equal((await db.projectImage.findUnique({ where: { id: ia.id } })).noProducts, false);
    await h.login(b);
    await expect(await tags.PATCH(r({ id: first.id, x: 30, y: 30 }, 'PATCH')), 403);
    await h.login(a);
    await expect(await tags.PATCH(r({ id: first.id, imageId: ib.id }, 'PATCH')), 404);
    await expect(await tags.PATCH(r({ id: first.id, x: 'invalid', y: 30 }, 'PATCH')), 400);
  });
  await t.test('project edit cannot promote visibility or ownership; collection delete respects delete capability', async () => {
    const route = h.route('projects');
    const owned = await f.project(a.id);
    await db.projectParticipant.create({ data: { projectId: owned.id, userId: editor.id, role: 'EDITOR', side: 'DESIGNER' } });
    await h.login(editor);
    const response = await route.DELETE(r(undefined, 'GET', `/api/projects?id=${owned.id}`));
    assert.ok(await db.project.findUnique({ where: { id: owned.id } }), 'editor must not delete through collection alias');
    await expect(response, 403);
    await h.login(a);
    await expect(await route.PUT(r({ id: owned.id, title: 'Allowed edit', isPublic: true, status: 'published', ownerId: b.id }, 'PUT')), 200);
    const saved = await db.project.findUnique({ where: { id: owned.id } });
    assert.equal(saved.ownerId, a.id); assert.equal(saved.isPublic, false); assert.notEqual(saved.status, 'published');
    for (const payload of [{ title: {} }, { stage: 'PUBLISHED' }, { credits: 'invalid' }]) {
      await expect(await route.PUT(r({ id: owned.id, ...payload }, 'PUT')), 400);
    }
    assert.equal((await db.project.findUnique({ where: { id: owned.id } })).title, 'Allowed edit');
  });
  await t.test('private tag queries and unfiltered enumeration hide drafts; published reads and shares still work', async () => {
    if (!await db.productTag.count({ where: { imageId: ia.id } })) await db.productTag.create({ data: { imageId: ia.id, productId: product.id, x: 25, y: 75 } });
    h.anonymous();
    for (const query of ['', `?projectId=${pa.id}`, `?imageId=${ia.id}`]) {
      const res = await tags.GET(r(undefined, 'GET', `/api/tag-product-to-image${query}`));
      const result = await expect(res, 200); assert.ok(!result.some(tag => tag.image.projectId === pa.id), 'private photo/tag data must not be public');
      assert.equal(res.headers.get('cache-control'), 'private, no-store');
    }
    await h.login(b);
    assert.deepEqual(await expect(await tags.GET(r(undefined, 'GET', `/api/tag-product-to-image?imageId=${ia.id}`)), 200), []);
    await h.login(admin);
    assert.equal((await expect(await tags.GET(r(undefined, 'GET', `/api/tag-product-to-image?imageId=${ia.id}`)), 200)).length, 1);
    await h.login(viewer);
    assert.equal((await expect(await tags.GET(r(undefined, 'GET', `/api/tag-product-to-image?imageId=${ia.id}`)), 200)).length, 1);
    await db.project.update({ where: { id: pa.id }, data: { isPublic: true } });
    h.anonymous();
    assert.equal((await expect(await tags.GET(r(undefined, 'GET', `/api/tag-product-to-image?projectId=${pa.id}`)), 200)).length, 1);
    await db.project.update({ where: { id: pa.id }, data: { isPublic: false, publishedAt: new Date(), status: 'published' } });
    const { PUBLISHED_PROJECT_FILTER } = require(resolve('src/server/queries/filters.ts'));
    assert.equal(await db.project.count({ where: { id: pa.id, ...PUBLISHED_PROJECT_FILTER } }), 0);
  });
  await t.test('room response projects vendor identity without credentials or private user fields', async () => {
    const vendor = await f.user({ role: 'VENDOR', passwordHash: 'SECRET-HASH', phone: 'PRIVATE-PHONE' });
    await db.selection.create({ data: { projectId: pa.id, roomId: ra.id, vendorRepId: vendor.id, productName: 'Vendor chair' } });
    await h.login(a);
    const data = await expect(await rooms.GET(r(), ctx(pa.id)), 200);
    const vendorData = data.flatMap(room => room.selections).find(selection => selection.vendorRep?.id === vendor.id).vendorRep;
    assert.deepEqual(Object.keys(vendorData).sort(), ['companyName', 'id', 'name']);
  });
  assert.deepEqual(h.unexpectedNetwork, []);
}
test('designer authorization: real handlers, isolated identities, local data boundary', async t => suite(t, memoryDatabase()));

test('public story exposes published content, not raw answers or editorial history', async () => {
  const db = memoryDatabase(); h.useDatabase(db); const f = factories(db);
  const owner = await f.user(), project = await f.project(owner.id, { isPublic: true, budgetBand: 'UNSPECIFIED' });
  await f.image(project.id, { inclusion: 'EXCLUDED', url: 'https://storage.test/PRIVATE-PHOTO.png' });
  const post = await db.projectPost.create({ data: { projectId: project.id, slug: `audit-${project.id}`, status: 'PUBLISHED',
    provenance: { interview: { payload: { answers: [{ answer: 'PRIVATE-ANSWER' }] } } },
    credits: [{ role: 'Designer', name: 'Public credit', email: 'PRIVATE-CONTACT', isInvite: true }],
    sectionHistory: { previous: 'PRIVATE-DRAFT' }, lastGenerationNote: 'PRIVATE-NOTE', expandedBlocks: { headline: 'Public headline' },
  } });
  const { getPostBySlug } = require(resolve('src/lib/post/getPostBySlug.ts'));
  h.anonymous();
  const publicPost = await getPostBySlug(post.slug);
  assert.ok(publicPost); assert.equal(publicPost.expandedBlocks.headline, 'Public headline');
  assert.equal(publicPost.credits[0].name, 'Public credit');
  assert.equal(publicPost.project.budgetBand, undefined); assert.equal(publicPost.project.ownerId, undefined);
  assert.ok(!JSON.stringify(publicPost).includes('PRIVATE-'));
  await db.projectPost.update({ where: { id: post.id }, data: { status: 'DRAFT' } });
  assert.equal(await getPostBySlug(post.slug), null);
  await db.projectPost.update({ where: { id: post.id }, data: { status: 'PUBLISHED' } });
  await db.project.update({ where: { id: project.id }, data: { isPublic: false } });
  assert.equal(await getPostBySlug(post.slug), null);
});

test('upload validates before storage/writes and deleting an imported reference never deletes its shared object', async () => {
  const db = memoryDatabase(); h.useDatabase(db); const f = factories(db);
  const a = await f.user(), b = await f.user(), pa = await f.project(a.id), pb = await f.project(b.id);
  const uploads = h.route('projects/[id]/images'), image = h.route('projects/[id]/images/[imageId]');
  await h.login(b);
  assert.equal((await uploads.POST(h.request({ imageData: 'dGVzdA==', mimeType: 'image/png' }), { params: { id: pa.id } })).status, 403);
  await h.login(a);
  for (const payload of [{ url: 'file:///etc/passwd' }, { url: 'http://127.0.0.1/private' }, { imageData: '!!!!' }, { imageData: 'dGVzdA==', name: {} }, { imageData: 'dGVzdA==', mimeType: 'text/html' }]) {
    assert.equal((await uploads.POST(h.request(payload), { params: { id: pa.id } })).status, 400);
  }
  assert.equal(await db.projectImage.count({ where: { projectId: pa.id } }), 0);
  const source = await f.image(pb.id, { url: `https://storage.test/storage/v1/object/public/project-assets/${pb.id}/private.png` });
  const copied = await f.image(pa.id, { url: source.url });
  const storage = require(resolve('src/lib/storage.ts')); let deletes = 0;
  storage.deleteProjectImage = async () => { deletes++; };
  assert.equal((await image.DELETE(h.request({}, 'DELETE'), { params: { id: pa.id, imageId: copied.id } })).status, 200);
  assert.equal(deletes, 0); assert.ok(await db.projectImage.findUnique({ where: { id: source.id } }));
  const originalSave = storage.saveBufferToProjectStorage;
  const cleanup = [];
  storage.saveBufferToProjectStorage = async () => ({ bucket: 'event-images', path: `${pa.id}/new.png`, publicUrl: `https://storage.test/${pa.id}/new.png` });
  storage.deleteProjectImage = async path => { cleanup.push(path); };
  const broken = new Proxy(db, { get(target, key) {
    if (key === 'projectImage') return new Proxy(target.projectImage, { get(delegate, method) {
      if (method === 'create') return () => { throw Error('PRIVATE-INSERT-FAILURE'); };
      return delegate[method];
    } });
    return target[key];
  } });
  try {
    h.useDatabase(broken); await h.login(a);
    const response = await uploads.POST(h.request({ imageData: 'dGVzdA==', mimeType: 'image/png' }), { params: { id: pa.id } });
    assert.equal(response.status, 500); assert.ok(!(await response.text()).includes('PRIVATE-INSERT-FAILURE'));
    assert.deepEqual(cleanup, [`event-images/${pa.id}/new.png`]);
    assert.equal(await db.projectImage.count({ where: { projectId: pa.id } }), 0);
    const malformed = new Request('http://folio.test/api/projects', { method: 'POST', body: '{broken' });
    assert.equal((await uploads.POST(malformed, { params: { id: pa.id } })).status, 400);
    assert.deepEqual(h.unexpectedNetwork, []);
  } finally { storage.saveBufferToProjectStorage = originalSave; }

});

// Opt-in only: the harness validates a disposable target before loading Prisma.
test('designer authorization against disposable PostgreSQL', { skip: !h.target }, async t => {
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient();
  try {
    await suite(t, db);
    await t.test('real transaction rolls back tag/image writes on selection failure; concurrent retries create one tag', async () => {
      h.useDatabase(db); const f = factories(db);
      const owner = await f.user(), project = await f.project(owner.id), room = await f.room(project.id);
      const image = await f.image(project.id, { room: room.name, noProducts: true }), product = await f.product();
      await h.login(owner);
      const route = h.route('tag-product-to-image');
      const payload = { projectId: project.id, imageId: image.id, productId: product.id, x: 25, y: 75, createSelection: true };
      // Inject failure at the database boundary inside an actual interactive transaction.
      const failing = new Proxy(db, { get(target, key) {
        if (key === '$transaction') return work => target.$transaction(tx => work(new Proxy(tx, { get(inner, name) {
          if (name === 'selection') return new Proxy(inner.selection, { get(delegate, method) {
            if (method === 'create') return () => { throw Error('PRIVATE-DB-FAILURE'); };
            return delegate[method];
          } });
          return inner[name];
        } })));
        return target[key];
      } });
      h.useDatabase(failing); await h.login(owner);
      const failure = await route.POST(h.request(payload));
      assert.equal(failure.status, 500); assert.ok(!(await failure.text()).includes('PRIVATE-DB-FAILURE'));
      assert.equal(await db.productTag.count({ where: { imageId: image.id } }), 0);
      assert.equal((await db.projectImage.findUnique({ where: { id: image.id } })).noProducts, true);
      h.useDatabase(db); await h.login(owner);
      const results = await Promise.all(Array.from({ length: 4 }, () => route.POST(h.request(payload))));
      const tags = await Promise.all(results.map(async result => { assert.equal(result.status, 200); return result.json(); }));
      assert.equal(new Set(tags.map(tag => tag.id)).size, 1);
      assert.equal(await db.productTag.count({ where: { imageId: image.id } }), 1);
      assert.equal(await db.selection.count({ where: { productTagId: tags[0].id } }), 1);
      const failingCredits = new Proxy(db, { get(target, key) {
        if (key === '$transaction') return work => target.$transaction(tx => work(new Proxy(tx, { get(inner, name) {
          if (name === 'projectPost') return new Proxy(inner.projectPost, { get(delegate, method) {
            if (method === 'upsert') return () => { throw Error('PRIVATE-CREDITS-FAILURE'); };
            return delegate[method];
          } });
          return inner[name];
        } })));
        return target[key];
      } });
      h.useDatabase(failingCredits); await h.login(owner);
      const projectRoute = h.route('projects');
      const edit = await projectRoute.PUT(h.request({ id: project.id, title: 'Must roll back', credits: [{ role: 'Designer', name: 'Fixture' }] }, 'PUT'));
      assert.equal(edit.status, 500); assert.ok(!(await edit.text()).includes('PRIVATE-CREDITS-FAILURE'));
      assert.equal((await db.project.findUnique({ where: { id: project.id } })).title, project.title);
      h.useDatabase(db); await h.login(owner);
      // Scoped parent deletion exercises the schema's real cascades, including retries.
      const handler = h.route('projects/[id]/rooms/[roomId]');
      assert.equal((await handler.DELETE(h.request({}, 'DELETE'), { params: { id: project.id, roomId: room.id } })).status, 200);
      assert.equal(await db.selection.count({ where: { roomId: room.id } }), 0);
      assert.equal((await handler.DELETE(h.request({}, 'DELETE'), { params: { id: project.id, roomId: room.id } })).status, 404);
    });
  } finally { await db.$disconnect(); }
});

test('publishing image proxy rejects private addresses and non-HTTP URLs without leaking errors', async () => {
  const { NextRequest } = require('next/server');
  const proxy = h.route('instagram/proxy-image');
  h.anonymous();
  for (const url of ['http://127.0.0.1/private', 'http://169.254.169.254/latest/meta-data', 'http://localhost/private', 'file:///etc/passwd', 'https://user:password@example.com/image.png']) {
    const response = await proxy.GET(new NextRequest(`http://folio.test/api/instagram/proxy-image?url=${encodeURIComponent(url)}`));
    assert.equal(response.status, 400); assert.deepEqual(await response.json(), { error: 'Image unavailable' });
  }
});

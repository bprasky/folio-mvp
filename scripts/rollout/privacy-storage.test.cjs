const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');
const { disposableTarget, factories } = require('../core/fixtures.cjs');
const { storageFixture } = require('./storage-fixture.cjs');
const target = disposableTarget();
if (!target) throw Error('Disposable PostgreSQL is required; storage acceptance never skips');

test('actual image bytes across private storage HTTP, project visibility, revocation and concurrent upload cleanup', { timeout: 60000 }, async t => {
  const storage = await storageFixture();
  Object.assign(process.env, { DATABASE_URL: target, DIRECT_URL: target, NEXTAUTH_SECRET: 'rollout-fixture-session-secret', NEXTAUTH_URL: 'http://folio.test',
    NEXT_PUBLIC_SUPABASE_URL: storage.origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: storage.anonKey, SUPABASE_SERVICE_ROLE_KEY: storage.serviceKey });
  let actor = null;
  const auth = require('next-auth');
  require.cache[require.resolve('next-auth')].exports = { ...auth, getServerSession: async () => actor ? { user: { id: actor.id, role: actor.role } } : null };
  const replace = (file, exports) => { const id = require.resolve(resolve(file)); require.cache[id] = { id, filename: id, loaded: true, exports }; };
  replace('src/lib/search/indexMoment.ts', { indexMoment: async () => {} }); // paid AI boundary
  const cache = require('next/cache'); require.cache[require.resolve('next/cache')].exports = { ...cache, revalidatePath() {} };
  const { prisma: db } = require('../../src/lib/prisma.ts');
  const f = factories(db), owner = await f.user(), stranger = await f.user(), viewer = await f.user();
  const project = await f.project(owner.id), product = await f.product();
  const { NextRequest } = require('next/server');
  const photos = require('../../src/app/api/project-photos/[...object]/route.ts');
  const uploads = require('../../src/app/api/projects/[id]/images/route.ts');
  const tags = require('../../src/app/api/tag-product-to-image/route.ts');
  const { saveBufferToProjectStorage } = require('../../src/lib/storage.ts');
  const { requestIdentity } = require('../../src/lib/persistence/requestIdentity.ts');
  const { readProtectedProjectPhoto, projectPhotoProcessingUrl } = require('../../src/lib/server/protected-project-photo.ts');
  const buffer = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: '#a8785f' } }).jpeg({ quality: 95 }).withExif({ IFD0: { Artist: 'PRIVATE_PHOTOGRAPHER_METADATA' } }).toBuffer();
  const requestPhoto = url => photos.GET(new NextRequest('http://folio.test' + url));
  let image, path;
  try {
    await t.test('two immutable uploads share one private object; anonymous bucket URLs cannot read its bytes', async () => {
      const storageId = requestIdentity('photo-upload', [project.id, buffer.toString('base64'), 'image/jpeg']);
      const values = await Promise.all([1, 2].map(() => saveBufferToProjectStorage({ projectId: project.id, roomId: 'default', buffer, mime: 'image/jpeg', storageId })));
      assert.equal(values[0].publicUrl, values[1].publicUrl); path = values[0].path;
      assert.equal(storage.objects.size, 1);
      image = await db.projectImage.create({ data: { id: storageId, projectId: project.id, url: values[0].publicUrl } });
      await db.productTag.create({ data: { imageId: image.id, productId: product.id, x: 10, y: 20 } });
      assert.equal((await fetch(`${storage.origin}/storage/v1/object/public/project-photos/${path}`)).status, 404);
      assert.equal((await fetch(`${storage.origin}/storage/v1/object/authenticated/project-photos/${path}`, { headers: { Authorization: `Bearer ${storage.anonKey}` } })).status, 404);
      assert.equal((await fetch(`${storage.origin}/storage/v1/object/project-photos/anonymous`, { method: 'POST', body: buffer })).status, 403);
    });
    await t.test('authorized owner and viewer receive sanitized bytes; stranger and revoked participant do not', async () => {
      assert.equal((await requestPhoto(image.url)).status, 404);
      actor = stranger; assert.equal((await requestPhoto(image.url)).status, 404);
      actor = owner; const response = await requestPhoto(image.url); assert.equal(response.status, 200);
      assert.match(response.headers.get('cache-control'), /private.*no-store/);
      const actual = Buffer.from(await response.arrayBuffer()), metadata = await sharp(actual).metadata();
      assert.equal(metadata.width, 1800); assert.equal(metadata.height, 1200); assert.equal(metadata.exif, undefined);
      assert.equal(actual.includes(Buffer.from('PRIVATE_PHOTOGRAPHER_METADATA')), false);
      const access = await db.projectParticipant.create({ data: { projectId: project.id, userId: viewer.id, side: 'DESIGNER', role: 'VIEWER' } });
      actor = viewer; assert.equal((await requestPhoto(image.url)).status, 200);
      await db.projectParticipant.delete({ where: { id: access.id } });
      assert.equal((await requestPhoto(image.url)).status, 404);
    });
    await t.test('publication serves bytes; exclusion, unpublishing and deletion revoke the same URL and tag query', async () => {
      actor = null; await db.project.update({ where: { id: project.id }, data: { isPublic: true, publishedAt: new Date() } });
      assert.equal((await requestPhoto(image.url)).status, 200);
      const list = async () => (await tags.GET(new NextRequest(`http://folio.test/api/tag-product-to-image?projectId=${project.id}`))).json();
      const publicTags = await list(); assert.equal(publicTags.length, 1); assert.equal('reviewedAt' in publicTags[0], false); assert.equal('createdAt' in publicTags[0].product, false);
      await db.projectImage.update({ where: { id: image.id }, data: { inclusion: 'EXCLUDED' } });
      assert.equal((await requestPhoto(image.url)).status, 404); assert.deepEqual(await list(), []);
      actor = owner; assert.equal((await requestPhoto(image.url)).status, 200);
      await db.projectImage.update({ where: { id: image.id }, data: { inclusion: 'INCLUDED' } });
      const processing = await readProtectedProjectPhoto(image.url, project.id); assert.ok(processing.buffer.length);
      await assert.rejects(readProtectedProjectPhoto(image.url, randomUUID()), /authorized project/);
      const signed = await projectPhotoProcessingUrl(image.url, project.id); assert.equal((await fetch(signed)).status, 200);
      await db.project.update({ where: { id: project.id }, data: { isPublic: false } }); actor = null;
      assert.equal((await requestPhoto(image.url)).status, 404); assert.deepEqual(await list(), []);
      assert.equal((await fetch(signed)).status, 200, 'a previously issued provider link has a documented 60-second revocation limit');
      storage.advanceTime(61000); assert.equal((await fetch(signed)).status, 404, 'expired provider link is rejected by the disposable storage service');
    });
    await t.test('private crops follow source visibility and a stale generation cannot attach after a move', async () => {
      const { uploadCrop } = require('../../src/lib/crops/uploadCrop.ts');
      const { generateProductCrop } = require('../../src/lib/crops/generateProductCrop.ts');
      actor = owner;
      const tag = await db.productTag.findFirstOrThrow({ where: { imageId: image.id } });
      const crop = await generateProductCrop({ tag, sourceImageUrl: image.url, projectId: project.id });
      const options = { buffer: crop.buffer, tagId: tag.id, projectId: project.id,
        expected: { imageId: tag.imageId, x: tag.x, y: tag.y, updatedAt: tag.updatedAt },
        metadata: { cropX: tag.x, cropY: tag.y, cropScale: .4, cropAspect: '1:1' } };
      const stored = await uploadCrop(options);
      assert.equal((await requestPhoto(stored.publicUrl)).status, 200);
      actor = null; assert.equal((await requestPhoto(stored.publicUrl)).status, 404);
      await db.project.update({ where: { id: project.id }, data: { isPublic: true } });
      assert.equal((await requestPhoto(stored.publicUrl)).status, 200);
      await db.projectImage.update({ where: { id: image.id }, data: { inclusion: 'EXCLUDED' } });
      assert.equal((await requestPhoto(stored.publicUrl)).status, 404);
      actor = owner;
      const current = await db.productTag.findUniqueOrThrow({ where: { id: tag.id } });
      const response = await tags.PATCH(new NextRequest('http://folio.test/api/tag-product-to-image', { method: 'PATCH', body: JSON.stringify({ id: tag.id, x: 70, y: 80, expected: { imageId: image.id, x: tag.x, y: tag.y } }) }));
      assert.equal(response.status, 200); assert.equal((await response.json()).cropUrl, null);
      await assert.rejects(uploadCrop({ ...options, expected: { ...options.expected, updatedAt: current.updatedAt } }), /changed while/);
      assert.equal((await requestPhoto(stored.publicUrl)).status, 404, 'unreferenced crop no longer has a public or owner route');
      await db.project.update({ where: { id: project.id }, data: { isPublic: false } });
      await db.projectImage.update({ where: { id: image.id }, data: { inclusion: 'INCLUDED' } });
    });
    await t.test('legacy copy-before-switch preserves a shared import and permits an isolated reference rollback', async () => {
      const legacyPath = `${project.id}/legacy/shared.jpg`;
      const legacyUrl = `${storage.origin}/storage/v1/object/public/event-images/${legacyPath}`;
      assert.equal((await fetch(`${storage.origin}/storage/v1/object/event-images/${legacyPath}`, { method: 'POST', headers: { Authorization: `Bearer ${storage.serviceKey}`, 'Content-Type': 'image/jpeg' }, body: buffer })).status, 200);
      const source = await db.projectImage.create({ data: { projectId: project.id, url: legacyUrl } });
      const other = await f.project(stranger.id);
      try {
        const shared = await db.projectImage.create({ data: { projectId: other.id, url: legacyUrl } });
        const references = await db.projectImage.count({ where: { url: legacyUrl } }); assert.equal(references, 2);
        const copy = await saveBufferToProjectStorage({ projectId: project.id, roomId: 'legacy', buffer: Buffer.from(await (await fetch(legacyUrl)).arrayBuffer()), mime: 'image/jpeg' });
        // Apply only to the reviewed source row and only while its old value matches.
        const switched = await db.projectImage.updateMany({ where: { id: source.id, projectId: project.id, url: legacyUrl }, data: { url: copy.publicUrl } }); assert.equal(switched.count, 1);
        actor = owner; assert.equal((await requestPhoto(copy.publicUrl)).status, 200);
        actor = null; assert.equal((await requestPhoto(copy.publicUrl)).status, 404);
        assert.equal((await db.projectImage.findUniqueOrThrow({ where: { id: shared.id } })).url, legacyUrl);
        assert.equal((await fetch(legacyUrl)).status, 200, 'copying does not revoke an old public URL: inventory/retirement is a separate rollout gate');
        // A reference rollback is possible while the original is retained. It is
        // deliberately unsafe for privacy and must never be an automatic rollout rollback.
        assert.equal((await db.projectImage.updateMany({ where: { id: source.id, url: copy.publicUrl }, data: { url: legacyUrl } })).count, 1);
      } finally { await db.project.delete({ where: { id: other.id } }); }
    });
    await t.test('public/missing bucket configuration fails closed before new writes', async () => {
      storage.buckets.set('project-photos', true);
      await assert.rejects(saveBufferToProjectStorage({ projectId: project.id, roomId: 'default', buffer, mime: 'image/jpeg' }), /not configured/);
      storage.buckets.set('project-photos', false);
    });
    await t.test('concurrent request failure cannot delete the successful request’s object; replay retains metadata', async () => {
      actor = owner;
      const secondBuffer = await sharp(buffer).resize(1600, 1000).jpeg().toBuffer();
      await db.$executeRawUnsafe('CREATE SEQUENCE rollout_upload_attempt');
      await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION rollout_reject_upload() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name = 'rollout-concurrent-fixture' AND nextval('rollout_upload_attempt') = 1 THEN RAISE EXCEPTION 'rollout forced image write failure'; END IF; RETURN NEW; END $$`);
      await db.$executeRawUnsafe('CREATE TRIGGER rollout_upload_failure BEFORE INSERT ON project_images FOR EACH ROW EXECUTE FUNCTION rollout_reject_upload()');
      const payload = { imageData: secondBuffer.toString('base64'), mimeType: 'image/jpeg', name: 'rollout-concurrent-fixture', deduplicate: true };
      const upload = body => uploads.POST(new NextRequest('http://folio.test/api/upload', { method: 'POST', body: JSON.stringify(body) }), { params: { id: project.id } });
      try {
        const responses = await Promise.all([upload(payload), upload(payload)]);
        assert.deepEqual(responses.map(response => response.status).sort(), [201, 500]);
        const saved = (await responses.find(response => response.status === 201).json()).image;
        const bytes = await requestPhoto(saved.url); assert.equal(bytes.status, 200); assert.ok((await bytes.arrayBuffer()).byteLength);
        const retry = await upload({ ...payload, name: 'Must not replace saved metadata' }); assert.equal(retry.status, 200);
        assert.equal((await retry.json()).image.name, payload.name);
        assert.equal(storage.events.some(event => event.method === 'DELETE'), false);
        await db.projectImage.delete({ where: { id: saved.id } }); assert.equal((await requestPhoto(saved.url)).status, 404);
      } finally {
        await db.$executeRawUnsafe('DROP TRIGGER rollout_upload_failure ON project_images');
        await db.$executeRawUnsafe('DROP FUNCTION rollout_reject_upload()'); await db.$executeRawUnsafe('DROP SEQUENCE rollout_upload_attempt');
      }
    });
  } finally {
    await db.project.delete({ where: { id: project.id } }); await db.product.delete({ where: { id: product.id } });
    await db.user.deleteMany({ where: { id: { in: [owner.id, stranger.id, viewer.id] } } });
    await db.$disconnect(); await storage.close();
  }
});

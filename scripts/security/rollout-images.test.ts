import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { stripExifMetadata } from '../../src/lib/storage';
import { decodeImage, readImageBody, fetchProjectImage } from '../../src/lib/server/project-image-input';
import { validateProductUrl, parseProductUrl } from '../../src/lib/server/safe-product-url';
import { newPhotoSaveProgress, saveProjectPhotos } from '../../src/lib/projects/saveProjectPhotos';

test('native Sharp strips metadata, normalizes output and rejects malformed images', async () => {
  const input = await sharp({ create: { width: 4, height: 3, channels: 3, background: '#fff' } })
    .jpeg().withExif({ IFD0: { Artist: 'PRIVATE_AUTHOR', Copyright: 'PRIVATE_COPYRIGHT' }, IFD2: { GPSLatitudeRef: 'N', GPSLatitude: '40/1 0/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '74/1 0/1 0/1' } }).toBuffer();
  assert((await sharp(input).metadata()).exif);
  const output = await stripExifMetadata(input, 'image/webp');
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, 'jpeg');
  for (const key of ['exif', 'xmp', 'iptc']) assert.equal((metadata as any)[key], undefined);
  assert(!output.includes(Buffer.from('PRIVATE_')));
  await assert.rejects(stripExifMetadata(Buffer.from('not an image'), 'image/jpeg'));
});

test('image input rejects invalid/oversized bodies and private URL destinations', async () => {
  assert.throws(() => decodeImage('not base64!'));
  assert.throws(() => decodeImage('A'.repeat(12 * 1024 * 1024)));
  await assert.rejects(readImageBody(new Request('http://fixture.test', { method: 'POST', body: 'null' })));
  await assert.rejects(readImageBody(new Request('http://fixture.test', { method: 'POST', body: ' '.repeat(12 * 1024 * 1024) })), /smaller/);
  for (const url of ['http://127.0.0.1/x', 'http://[::1]/x', 'http://169.254.169.254/x', 'file:///tmp/a', 'https://user:password@example.com/a']) {
    assert.throws(() => parseProductUrl(url)); await assert.rejects(fetchProjectImage(url));
  }
  await assert.rejects(validateProductUrl('https://fixture.example/photo', (async () => [{ address: '10.0.0.1', family: 4 }]) as any));
});

test('partial photo/tag failure retries remaining writes without recreating successful images/products/tags', async () => {
  const original = global.fetch; const calls: string[] = []; let fail = true;
  global.fetch = (async (url: string) => {
    calls.push(url);
    if (url.includes('/images')) return Response.json({ image: { id: 'saved-image' } });
    if (url === '/api/products') return Response.json({ id: 'saved-product' });
    if (fail) return Response.json({ error: 'fixture failure' }, { status: 500 });
    return Response.json({ id: 'tag' });
  }) as any;
  try {
    const progress = newPhotoSaveProgress();
    const images = [{ id: 'pending-photo', url: 'data:image/png;base64,AA==', tags: [{ id: 'tag', productId: 'pending-product', isPending: true }] }];
    await assert.rejects(saveProjectPhotos('project', images, progress), /Retry/);
    fail = false; await saveProjectPhotos('project', images, progress);
    await saveProjectPhotos('project', images, progress);
    assert.equal(calls.filter(url => url.endsWith('/images')).length, 1);
    assert.equal(calls.filter(url => url === '/api/products').length, 1);
    assert.equal(calls.filter(url => url === '/api/tag-product-to-image').length, 2);
  } finally { global.fetch = original; }
});

// Pure ranking/format fixtures. No database, browser or external requests.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { curateChannelTiles } = require('../src/lib/project-channel/curation.ts');
const { normalizeChannelMedia, publicMediaUrl } = require('../src/lib/project-channel/media.ts');
const { withChannelQuery } = require('../src/lib/project-channel/links.ts');
const { publicPost } = require('../src/lib/post/publicPost.ts');
const { generateCaption } = require('../src/lib/instagram/campaign/generateCaptions.ts');
const tile = (id, kind = 'space', extra = {}) => ({ id, kind, title: id, imageUrl: `https://cdn.example.com/${id}.jpg`, href: '/p/fixture/feature', ...extra });

test('visual media leads; a published feature stays second even among 30 videos', () => {
  const input = [tile('feature', 'feature'), ...Array.from({ length: 30 }, (_, i) => tile(`video-${i}`, 'media')), tile('room')];
  const before = structuredClone(input);
  const result = curateChannelTiles(input);
  assert.equal(result[0].id, 'video-0'); assert.equal(result[0].size, 'large');
  assert.equal(result[1].id, 'feature'); assert.equal(result[1].size, 'medium');
  assert.deepEqual(input, before); assert.deepEqual(curateChannelTiles(input), result);
});
test('photo-first fallback and pinned designer choices outrank automatic defaults', () => {
  const result = curateChannelTiles([tile('feature', 'feature'), tile('photo', 'space', { pinned: true }), tile('clip', 'media')]);
  assert.equal(result[0].id, 'photo'); assert.equal(result[0].size, 'large');
  assert.equal(curateChannelTiles([tile('no-cover', 'media', { imageUrl: null }), tile('photo')])[0].id, 'photo');
});
test('room diversity defers repeated photos without losing any approved photography', () => {
  const result = curateChannelTiles([tile('a', 'space', { roomKey: 'living' }), tile('b', 'space', { roomKey: 'living' }), tile('c', 'space', { roomKey: 'kitchen' })]);
  assert.deepEqual(result.map(t => t.id), ['a', 'c', 'b']);
});
test('text tiles stay small; valid visual prominence choices are honored', () => {
  const result = curateChannelTiles([tile('credit', 'credit', { imageUrl: null, pinned: true, prominence: 'large' }), tile('feature', 'feature', { imageUrl: null }), tile('photo', 'space', { prominence: 'medium' })]);
  assert.equal(result.find(t => t.id === 'credit').size, 'small');
  assert.equal(result.find(t => t.id === 'feature').size, 'small');
  assert.equal(result.find(t => t.id === 'photo').size, 'medium');
});
for (const count of [0, 1, 2, 3, 5, 10, 25]) test(`curation retains ${count} items with stable unique identities`, () => {
  const result = curateChannelTiles(Array.from({ length: count }, (_, i) => tile(String(i), 'space', { roomKey: `room-${i % 3}` })));
  assert.equal(result.length, count); assert.equal(new Set(result.map(t => t.id)).size, count);
  assert.equal(result.filter(t => t.size === 'large').length, count ? 1 : 0);
});
test('long/short video and drone footage support object/array media, with or without posters', () => {
  for (const type of ['LONG_VIDEO', 'SHORT_VIDEO', 'STORY']) {
    const video = { kind: 'video', url: 'https://cdn.example.com/drone.mp4' };
    assert.equal(normalizeChannelMedia(type, video).assets[0].kind, 'video');
    assert.equal(normalizeChannelMedia(type, [video]).thumbnail, null);
    assert.equal(normalizeChannelMedia(type, [{ ...video, poster: 'https://cdn.example.com/cover.jpg' }]).thumbnail, 'https://cdn.example.com/cover.jpg');
  }
});
test('image stories and galleries remain images; providers get explicit external destinations', () => {
  for (const type of ['STORY', 'GALLERY']) {
    const media = normalizeChannelMedia(type, [{ kind: 'image', url: 'https://cdn.example.com/photo.jpg', caption: 'Approved caption' }, { url: 'https://youtu.be/12345678901' }]);
    assert.deepEqual(media.assets.map(a => a.kind), ['image', 'external']);
    assert.equal(media.thumbnail, 'https://cdn.example.com/photo.jpg');
  }
});
test('invalid, private, draft, deleted and unsupported assets do not become public media', () => {
  for (const url of ['javascript:alert(1)', 'http://cdn.example.com/a.mp4', 'https://localhost/a.mp4', 'https://127.0.0.1/a.mp4', 'https://user:password@example.com/a.mp4', 'https://cdn.example.com/storage/v1/object/sign/private/a.mp4', 'https://cdn.example.com/a.mp4?token=secret', 'not a url']) assert.equal(publicMediaUrl(url), null);
  for (const row of [null, 'file-id', { url: 'https://example.com/article' }, { kind: 'video', url: 'https://cdn.example.com/a.mp4', isPrivate: true }, { kind: 'video', url: 'https://cdn.example.com/a.mp4', isPublic: false }, { kind: 'video', url: 'https://cdn.example.com/a.mp4', status: 'DRAFT' }, { kind: 'image', url: 'https://cdn.example.com/a.jpg', deletedAt: '2026-01-01' }]) assert.equal(normalizeChannelMedia('STORY', [row]).assets.length, 0);
  for (const type of ['ARTICLE', 'BOARD', 'TIMELINE']) assert.equal(normalizeChannelMedia(type, [{ kind: 'image', url: 'https://cdn.example.com/a.jpg' }]).assets.length, 0);
  for (const flags of [{ status: 'Draft' }, { status: 'PRIVATE' }, { status: 'UNPUBLISHED' }, { visibility: 'private' }, { deleted: true }]) assert.equal(normalizeChannelMedia('STORY', { kind: 'image', url: 'https://cdn.example.com/a.jpg', ...flags }).assets.length, 0);
});
test('normalization deduplicates assets and exposes no raw author metadata', () => {
  const raw = { kind: 'video', url: 'https://cdn.example.com/a.mp4', privateNotes: 'DO_NOT_SERIALIZE', negotiation: 'PRIVATE' };
  const result = normalizeChannelMedia('LONG_VIDEO', [raw, raw]);
  assert.equal(result.assets.length, 1); assert.doesNotMatch(JSON.stringify(result), /DO_NOT_SERIALIZE|PRIVATE/);
});
test('room/product and repeated attribution parameters survive every redirect', () => {
  const href = withChannelQuery('/p/house/feature', { room: 'living room', product: 'chair', utm_source: 'folio_share', ref: ['a', 'b'], empty: undefined });
  const params = new URL(href, 'https://folioad.com').searchParams;
  assert.equal(params.get('room'), 'living room'); assert.equal(params.get('utm_source'), 'folio_share');
  assert.deepEqual(params.getAll('ref'), ['a', 'b']); assert.equal(params.has('empty'), false);
});
test('public product sheets preserve tags and approved crops without serializing internal reference images or trade data', () => {
  for (const flags of [{ imageSource: 'VENDOR_REFERENCE', displayScope: 'PUBLIC' }, { imageSource: 'VENDOR_LICENSED', displayScope: 'INTERNAL' }]) {
    const source = { project: { images: [{ id: 'photo', url: '/approved-room.jpg', inclusion: 'INCLUDED', tags: [
      { id: 'tag', productId: 'chair', cropUrl: '/approved-crop.jpg', product: { id: 'chair', name: 'Approved chair', price: 100,
        imageUrl: 'PRIVATE_REFERENCE', primaryImageUrl: 'PRIVATE_PRIMARY', thumbnailUrl: 'PRIVATE_THUMB', cutoutImageUrl: 'PRIVATE_CUTOUT',
        tradePriceCents: 'PRIVATE_PRICE', negotiations: 'PRIVATE_NEGOTIATIONS', ...flags } },
    ] }] } };
    const product = publicPost(source).project.images[0].tags[0].product;
    assert.equal(product.id, 'chair'); assert.equal(product.imageUrl, '/approved-crop.jpg');
    assert.equal(product.price, 100, 'Existing public catalog price is preserved');
    assert.doesNotMatch(JSON.stringify(product), /PRIVATE_/);
    source.project.images[0].tags[0].product.displayScope = 'PUBLIC';
    source.project.images[0].tags[0].product.imageSource = 'VENDOR_LICENSED';
    assert.equal(publicPost(source).project.images[0].tags[0].product.imageUrl, 'PRIVATE_REFERENCE', 'Approved licensed image remains available');
  }
});
test('legacy social captions link to the canonical channel host with an encoded slug', () => {
  const { caption } = generateCaption({ postType: 'launch', project: { title: 'House', designerName: 'Studio', slug: 'a house/room' }, context: {} });
  assert.ok(caption.includes('https://folioad.com/p/a%20house%2Froom'));
  assert.doesNotMatch(caption, /folio\.ad\/|folio\.com\/|link\.bio/);
});

import assert from 'node:assert/strict';
import { buildStoryData } from '../src/lib/story/buildRoomTiles';
import { buildRoomSlides, gallerySizes, capitalizeOpening } from '../src/lib/story/roomSlides';
import { readPresentation } from '../src/lib/story/presentation';

function post(count: number, body = true): any {
  return { id: 'post', slug: 'house', project: { title: 'House', designer: { name: 'Designer' },
    images: Array.from({ length: count }, (_, i) => ({ id: `photo-${i}`, url: `/photo-${i}.jpg`, roomId: `room-${i}`, room: `Room ${i}`, inclusion: 'INCLUDED' })) },
    expandedBlocks: { lead: { deck: 'Project introduction, not a room article.' },
      galleryChapters: Array.from({ length: count }, (_, i) => ({ roomId: `room-${i}`, title: `Room ${i}`, imageIds: [`photo-${i}`], body: body ? ['a room with a reason.'] : [], pullQuote: null })) } };
}

for (let count = 1; count <= 300; count++) {
  const sizes = gallerySizes(count);
  assert.equal(sizes.reduce((a, b) => a + b, 0), count);
  assert.ok(sizes.every(size => size <= 4 && size >= (count === 1 ? 1 : 2)));
}
assert.deepEqual(gallerySizes(5), [3, 2]);
assert.deepEqual(gallerySizes(6), [3, 3]);
assert.deepEqual(gallerySizes(9), [3, 3, 3]);

const large = buildStoryData(post(120))!;
assert.equal(buildRoomSlides(large.roomTiles).length, 120);
const ordered = buildRoomSlides(large.roomTiles, ['room-90', 'room-3']);
assert.equal(ordered[0].id, 'room-90');
assert.equal(ordered[0].kind === 'story' && ordered[0].room.chapterIndex, 90);
assert.equal(ordered[1].kind === 'story' && ordered[1].room.chapterIndex, 3);
assert.equal(large.roomTiles[0].chapterIndex, 0, 'Reordering does not mutate the source');

const sparse = post(7, false);
sparse.project.images[0].inclusion = 'EXCLUDED';
sparse.project.images[1].url = '';
sparse.expandedBlocks.galleryChapters[0].images = [sparse.project.images[0]];
const sparseStory = buildStoryData(sparse)!;
assert.equal(sparseStory.roomTiles.length, 5);
assert.deepEqual(buildRoomSlides(sparseStory.roomTiles).map(slide => slide.kind === 'gallery' && slide.photos.length), [3, 2]);
assert.ok(!JSON.stringify(sparseStory).includes('/photo-0.jpg'), 'Legacy chapter cannot revive an excluded photo');

const noChapters = post(2);
noChapters.expandedBlocks.galleryChapters = [];
const photoOnly = buildStoryData(noChapters)!;
assert.equal(photoOnly.roomTiles.length, 2);
assert.ok(photoOnly.roomTiles.every(room => room.chapterIndex === -1 && room.editorialNarrative === null));
assert.equal(buildRoomSlides(photoOnly.roomTiles)[0].kind, 'gallery');
assert.equal(buildStoryData(post(0)), null);

const sharedPhoto = post(2);
sharedPhoto.expandedBlocks.galleryChapters = ['Library', 'Living Room'].map(title => ({ title, imageIds: ['photo-0'], body: ['A room story.'] }));
const sharedRooms = buildStoryData(sharedPhoto)!.roomTiles;
assert.equal(new Set(sharedRooms.map(room => room.roomId)).size, sharedRooms.length);
assert.equal(buildRoomSlides(sharedRooms, [sharedRooms[1].roomId])[0].id, sharedRooms[1].roomId);
sharedPhoto.expandedBlocks.galleryChapters.forEach((chapter: any) => chapter.body = []);
const sharedGalleries = buildRoomSlides(buildStoryData(sharedPhoto)!.roomTiles);
assert.equal(sharedGalleries.flatMap(slide => slide.kind === 'gallery' ? slide.photos : []).length, 2, 'A shared gallery asset appears only once');

const extra = post(1);
extra.project.images.push({ id: 'extra', url: '/extra.jpg', roomId: 'room-0', room: 'Room 0' });
assert.equal(buildStoryData(extra)!.roomTiles[0].additionalImages[0].id, 'extra');
const paragraphs = post(1);
paragraphs.expandedBlocks.galleryChapters[0].body = ['First paragraph.', '', 'Third paragraph.'];
assert.deepEqual(buildStoryData(paragraphs)!.roomTiles[0].editorialParagraphs, ['First paragraph.', '', 'Third paragraph.']);
assert.equal(capitalizeOpening('  “évery detail matters.”'), '“Évery detail matters.”');
assert.deepEqual(readPresentation(undefined), { version: 1, accent: null, roomOrder: [] });
console.log('Immersive room checks pass: 300 gallery sizes, 120-room ordering, source indexes, eligible photos, sparse chapters, extra photos and neutral default.');

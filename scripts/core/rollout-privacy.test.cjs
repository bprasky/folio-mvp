const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const h = require('./harness.cjs');
const { memoryDatabase } = require('./memory-db.cjs');
const { factories } = require('./fixtures.cjs');

test('draft listing cannot be widened by anonymous or another designer', async () => {
  const db = memoryDatabase(); h.useDatabase(db); const f = factories(h.facade);
  const owner = await f.user(), other = await f.user();
  const draft = await f.project(owner.id, { isPublic: false });
  const publicRow = await f.project(owner.id, { isPublic: true });
  const inconsistent = await f.project(owner.id, { isPublic: false, publishedAt: new Date(), status: 'published' });
  const route = h.route('projects');
  const get = query => route.GET(h.request(undefined, 'GET', '/api/projects?' + query));
  for (const query of ['includeDrafts=true', `includeDrafts=true&designerId=${owner.id}`, 'mine=true']) {
    h.anonymous(); assert.equal((await get(query)).status, 401);
  }
  await h.login(other);
  assert.equal((await get(`includeDrafts=true&designerId=${owner.id}`)).status, 403);
  assert.deepEqual(await (await get('includeDrafts=true')).json(), []);
  await h.login(owner);
  const own = await (await get('includeDrafts=true')).json();
  assert(own.some(row => row.id === draft.id));
  h.anonymous(); const publicRows = await (await get('')).json();
  assert(publicRows.some(row => row.id === publicRow.id));
  assert(!publicRows.some(row => [draft.id, inconsistent.id].includes(row.id)));
});

test('public article DTO excludes raw evidence, private assets, pending products and private credits', () => {
  const { publicPost } = require(resolve('src/lib/post/publicPost.ts'));
  const source = { id: 'post', status: 'PUBLISHED', projectId: 'project', slug: 'story',
    provenance: { interview: { answer: 'PRIVATE_ANSWER', correction: 'PRIVATE_CORRECTION' } },
    credits: [{ name: 'Designer', role: 'Designer', email: 'PRIVATE_EMAIL' }],
    heroAssetId: 'excluded', project: { id: 'project', isPublic: true, budgetBand: 'PRIVATE_BUDGET', images: [
      { id: 'included', url: '/public.jpg', inclusion: 'INCLUDED', tags: [{ id: 'pending', product: { isPending: true, name: 'PRIVATE_PRODUCT' } }] },
      { id: 'excluded', url: '/PRIVATE_PHOTO.jpg', inclusion: 'EXCLUDED' },
    ] }, expandedBlocks: { lead: { title: 'Approved title', kickerAlternatives: ['PRIVATE_TITLE'] }, introduction: ['Approved introduction'],
      galleryChapters: [{ body: ['Approved prose'], imageIds: ['included', 'excluded'], images: [{ id: 'excluded', url: '/PRIVATE_INLINE.jpg' }],
        pullQuote: { selected: { text: 'Approved quotation', provenance: { excerpt: 'PRIVATE_SOURCE' } }, alternatives: [{ text: 'PRIVATE_ALTERNATIVE' }] } }],
      data: { interview: 'PRIVATE_DATA' } }, supplementalQuotes: [{ id: 'unapproved', answer: 'PRIVATE_QUOTE', pinned: false }],
  };
  const result = publicPost(source), wire = JSON.stringify(result);
  assert(!wire.includes('PRIVATE_')); assert.equal(result.heroAssetId, null);
  assert.deepEqual(result.expandedBlocks.galleryChapters[0].imageIds, ['included']);
  assert(wire.includes('Approved prose')); assert(wire.includes('Approved quotation'));
  assert.equal(source.provenance.interview.answer, 'PRIVATE_ANSWER');
});

test('image endpoint rejects private imports and invalid input without saving a URL', async () => {
  const db = memoryDatabase(); h.useDatabase(db); const f = factories(h.facade);
  const owner = await f.user(), other = await f.user(); const project = await f.project(owner.id);
  const route = h.route('projects/[id]/images');
  const send = body => route.POST(h.request(body), { params: { id: project.id } });
  h.anonymous(); assert.equal((await send({ imageData: 'aGVsbG8=' })).status, 401);
  await h.login(other); assert.equal((await send({ imageData: 'aGVsbG8=' })).status, 403);
  await h.login(owner);
  for (const input of [{ url: 'http://127.0.0.1/private' }, { url: 'http://169.254.169.254/' }, { imageData: 'invalid!' }, { url: 'data:image/png;base64,invalid!' }]) {
    assert.equal((await send(input)).status, 400);
  }
  assert.equal(await h.facade.projectImage.count({ where: { projectId: project.id } }), 0);
});

test('publication keeps a deliberately selected embedded alternative but drops other candidates', () => {
  const { publicPost } = require(resolve('src/lib/post/publicPost.ts'));
  const result = publicPost({ project: { images: [] }, expandedBlocks: {
    embeddedQuotes: [{ slotId: 'room:1', sourceId: 'designer', text: 'Published breather', attribution: 'designer' }],
    galleryChapters: [{ pullQuote: { selected: { text: 'Room quote' }, alternatives: [
      { text: 'Published breather', source: 'PRIVATE_SOURCE' }, { text: 'PRIVATE_UNUSED' },
    ] } }],
  } });
  assert.deepEqual(result.expandedBlocks.galleryChapters[0].pullQuote.alternatives, [{ text: 'Published breather' }]);
  assert(!JSON.stringify(result).includes('PRIVATE_'));
});

test('storage failure never persists the submitted remote/data URL as a fallback', async () => {
  const db = memoryDatabase(); h.useDatabase(db); const f = factories(h.facade);
  const owner = await f.user(), project = await f.project(owner.id); await h.login(owner);
  const storage = require(resolve('src/lib/storage.ts')), original = storage.saveBufferToProjectStorage;
  storage.saveBufferToProjectStorage = async () => { throw new Error('synthetic storage failure'); };
  try {
    const result = await h.route('projects/[id]/images').POST(h.request({ url: 'data:image/png;base64,aGVsbG8=' }), { params: { id: project.id } });
    assert.equal(result.status, 500);
    assert.equal(await h.facade.projectImage.count({ where: { projectId: project.id } }), 0);
  } finally { storage.saveBufferToProjectStorage = original; }
});

test('actual story transformer preserves published chapter prose, photographs and saved breather', () => {
  const { publicPost } = require(resolve('src/lib/post/publicPost.ts'));
  const { buildStoryData } = require(resolve('src/lib/story/buildRoomTiles.ts'));
  const source = { slug: 'story', project: { id: 'project', title: 'House', isPublic: true, designer: { name: 'Designer', studio: 'Studio' },
    images: [1,2,3].map(id => ({ id: String(id), url: `/photo${id}.jpg`, tags: [] })) },
    expandedBlocks: { lead: { title: 'Published title', deck: 'Published deck' }, introduction: ['Published introduction'],
      embeddedQuotes: [{ slotId: 'breather-2', sourceId: 'designer', text: 'Published breather', attribution: 'designer' }],
      galleryChapters: [1,2,3].map(id => ({ title: `Room ${id}`, body: [`Published room ${id}`], imageIds: [String(id)],
        pullQuote: { selected: { text: `Room quote ${id}` }, alternatives: [{ text: 'Published breather' }, { text: 'PRIVATE_UNUSED' }] } })),
    } };
  const before = buildStoryData(source), after = buildStoryData(publicPost(source));
  const display = story => ({ title: story.title, intro: story.introText, hero: story.heroImageUrl,
    rooms: story.roomTiles.map(room => [room.roomLabel, room.heroImage.url, room.editorialNarrative, room.pullQuote, room.pattern]),
    breathers: story.breathers.map(quote => [quote.quote, quote.attribution]),
  });
  assert.deepEqual(display(after), display(before));
  assert.equal(after.breathers[0].quote, 'Published breather');
});

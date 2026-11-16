// Exercise public feed readers with explicit DB/session boundaries.
const assert = require('node:assert/strict');
const path = require('node:path');
const { NextRequest } = require('next/server');
function replace(name, exports) { const id = require.resolve(name.startsWith('src/') ? path.resolve(name) : name); require.cache[id] = { id, filename: id, loaded: true, exports }; }
replace('react', { ...require('react'), cache: fn => fn }); // Next's request-local cache boundary
replace('next-auth', { getServerSession: async () => null });
replace('src/app/api/auth/[...nextauth]/options.ts', { authOptions: {} });
const secret = 'PRIVATE_FIELD_MUST_NOT_LEAK';
let projectQuery, moduleQuery, postQuery;
const project = { id: 'p', title: 'Public project', isPublic: true, publishedAt: new Date(), images: [{ id: 'photo', url: 'https://cdn.example.com/approved.jpg' }], designer: { id: 'designer', name: 'Designer', studio: 'Studio' }, post: { slug: 'house', status: 'PUBLISHED' } };
const row = { id: 'module', type: 'STORY', title: 'Image story', project, publishedAt: new Date(0), media: [{ kind: 'image', url: 'https://cdn.example.com/story.jpg', privateNotes: secret }, { kind: 'video', url: 'https://cdn.example.com/private.mp4', isPrivate: true }] };
replace('src/lib/prisma.ts', { prisma: {
  project: { findMany: async query => { projectQuery = query; return [{ ...project, budgetBand: secret, pendingNegotiation: secret }]; } },
  projectModule: { findMany: async query => { moduleQuery = query; return [row]; } },
  projectPost: { findMany: async query => { postQuery = query; return [{ id: 'post', slug: 'house', status: 'PUBLISHED', heroAssetId: 'photo', project }]; } },
} });
const { getRecentProjectModules } = require('../src/lib/feed/getRecentProjectModules.ts');
const { getUpdatesCarousel } = require('../src/lib/feed/getUpdatesCarousel.ts');
const { getPublishedProjectPosts } = require('../src/lib/feed/getPublishedProjectPosts.ts');
const profile = require('../src/app/api/profile/[userId]/feed/route.ts');
(async () => {
  for (const flag of ['true', 'false']) {
    process.env.FOLIO_EDITORIAL_CHANNELS = flag;
    const rows = await getRecentProjectModules();
    assert.equal(rows[0].href, flag === 'true' ? '/p/house/media/module' : '/p/house');
    assert.deepEqual(moduleQuery.where.project, { isPublic: true, post: { is: { status: 'PUBLISHED' } } });
    assert.deepEqual(moduleQuery.select.project.select.images.where, { inclusion: 'INCLUDED' });
    assert.doesNotMatch(JSON.stringify(rows), /PRIVATE_FIELD_MUST_NOT_LEAK|private\.mp4/);
  }
  const groups = await getUpdatesCarousel();
  assert.equal(groups[0].items[0].media[0].kind, 'image'); assert.equal(groups[0].cover, 'https://cdn.example.com/story.jpg');
  assert.doesNotMatch(JSON.stringify(groups), /PRIVATE_FIELD_MUST_NOT_LEAK|private\.mp4/);
  await getPublishedProjectPosts();
  assert.deepEqual(postQuery.select.project.select.images.where, { inclusion: 'INCLUDED' });
  const response = await profile.GET(new NextRequest('https://folioad.com/api/profile/designer/feed?filter=projects'), { params: { userId: 'designer' } });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.doesNotMatch(JSON.stringify(data), /PRIVATE_FIELD_MUST_NOT_LEAK|budgetBand|pendingNegotiation/);
  assert.deepEqual(projectQuery.select.images.where, { inclusion: 'INCLUDED' });
  assert.equal(projectQuery.include, undefined); assert.equal(projectQuery.where.isPublic, true);
  assert.equal(data.items[0].data.storyHref, '/p/house');
  console.log('PASS public project/profile/module feed DTOs, excluded-photo predicates, asset privacy, image stories and canonical links with flag on/off');
})().catch(error => { console.error(error); process.exitCode = 1; });

// Real page/query/route logic with explicit framework, session, database and AI boundaries.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
function load(file, imports, fallback) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, console, Error, process: { env: { FOLIO_EDITORIAL_CHANNELS: 'true', ...imports.__env } }, URLSearchParams, Date,
      require: name => name in imports ? imports[name] : fallback ? fallback(name) : require(name) }, { filename: file });
  return exports;
}
const publication = load('src/lib/publish/projectPublication.ts', {});
const editorial = load('src/lib/editorial/getEditorialState.ts', {});
const readiness = load('src/lib/publish/computePublishReadiness.ts', {});
const plain = value => JSON.parse(JSON.stringify(value));
async function main() {
  const photo = { id: 'image', url: '/photo.jpg', name: 'Living room', roomId: null, inclusion: 'INCLUDED' };
  const base = { id: 'project', ownerId: 'actor', designerId: 'actor', designerOrgId: 'firm', title: 'Imported home', isPublic: false, updatedAt: new Date(), rooms: [], images: [photo], post: null };
  let allowed = true, session = { user: { id: 'actor' } }, nextCalls = 0;
  const authz = { assertProjectView: async () => { if (!allowed) throw Error('Forbidden'); }, assertProjectWrite: async () => {}, assertProjectPublish: async () => {}, assertProjectUnpublish: async () => {} };
  const nextProject = { id: 'next', title: 'Next home' };
  const PhotoReview = props => React.createElement('section', { 'data-review': props.projectId }, props.title);
  const page = load('src/app/project/[id]/page.tsx', {
    'next-auth': { getServerSession: async () => session }, 'next/navigation': { redirect: url => { throw Error('redirect:' + url); }, notFound: () => { throw Error('404'); } },
    '@/lib/prisma': { prisma: { project: { findUnique: async () => base }, projectPost: { findFirst: async () => null, findUnique: async () => null }, editorialInterviewAnswer: { count: async () => 0 }, editorialInterview: { findFirst: async () => null } } },
    '@/lib/authz/access': authz, '@/lib/editorial/getEditorialState': editorial, '@/lib/publish/computePublishReadiness': readiness,
    '@/lib/publish/projectPublication': publication,
    '@/lib/publish/portfolio': { portfolioReviewVersion: () => 'a'.repeat(64), hasPortfolioInterviewProgress: () => false, nextPortfolioProject: async () => { nextCalls++; return nextProject; } },
    '@/components/projects/PortfolioPhotoReview': { PortfolioPhotoReview: PhotoReview },
    '@/lib/project-channel/getPublicPortfolio': { getPublicPortfolio: async () => null },
  }, name => name.startsWith('@/') || name.startsWith('.') ? new Proxy({}, { get: () => () => null }) : require(name)).default;
  await assert.rejects(page({ params: { id: 'project' }, searchParams: {} }), /redirect:\/project\/project\?publish=photos/);
  const review = await page({ params: { id: 'project' }, searchParams: { publish: 'photos' } });
  assert.equal(review.type, PhotoReview); assert.equal(review.key, 'project');
  assert.equal(review.props.profileHref, '/org/firm'); assert.equal(review.props.featureHref, '/project/project?view=story');
  assert.deepEqual(plain(review.props.nextProject), nextProject);
  assert.ok(!('post' in review.props) && !('provenance' in review.props));
  base.isPublic = true;
  const saved = await page({ params: { id: 'project' }, searchParams: { publish: 'photos' } });
  assert.equal(saved.key, review.key, 'Approval revalidation preserves the client success screen');
  assert.equal(saved.type, PhotoReview);
  allowed = false; nextCalls = 0;
  await assert.rejects(page({ params: { id: 'project' }, searchParams: { publish: 'photos' } }), /404/);
  assert.equal(nextCalls, 0, 'Foreign viewers never load the next private project');
  session = null;
  await assert.rejects(page({ params: { id: 'project' }, searchParams: { publish: 'photos' } }), /404/);
  console.log('PASS focused project entry, stable approval success, existing route reuse and private-project admission');

  const invitationComponent = require('./studio-publication-test-import.cjs')('./StudioProjectInvitations').StudioProjectInvitations;
  const invitations = [{ id: 'photos', title: 'Photo project', photosOnProfile: true, thumbnail: null,
    ...publication.projectFeatureNextStep({ id: 'photos', isPublic: true, featureStatus: 'DRAFT' }) }];
  for (const readinessFlag of [false, true]) {
    const props = { projectInvitations: invitations };
    const imports = { __env: { STUDIO_EDITORIAL_READINESS: readinessFlag ? 'true' : 'false' }, 'react': React, 'next-auth': { getServerSession: async () => ({ user: { id: 'actor' } }) },
      '@/app/api/auth/[...nextauth]/options': {},
      'next/navigation': { redirect: () => assert.fail('Studio must stay accessible') }, 'next/link': { default: ({ children, ...rest }) => React.createElement('a', rest, children) },
      '@/lib/publishing-studio/expertise/flag': { expertiseEnabled: () => false }, '@/lib/interview-media/store': { mediaSchemaReady: async () => false },
      '@/lib/publishing-studio/project-invitations': { getStudioProjectInvitations: async () => props.projectInvitations },
      '@/components/publishing-studio/PublishingStudio': { PublishingStudio: p => React.createElement(invitationComponent, { projects: p.projectInvitations }) },
      '@/components/publishing-studio/ReadinessStudio': { ReadinessStudio: p => React.createElement(invitationComponent, { projects: p.projectInvitations }) } };
    const studio = load('src/app/designer/studio/page.tsx', imports).default;
    const html = renderToStaticMarkup(await studio({ searchParams: readinessFlag ? {} : { view: 'saved' } }));
    assert.match(html, /Start interview/); assert.match(html, /Photo project/); assert.match(html, /publish its Folio Feature/);
    props.projectInvitations = [];
    assert.equal(renderToStaticMarkup(await studio({ searchParams: {} })).includes('Start interview'), false);
  }
  console.log('PASS Studio entry remains open with no published features and receives safe project invitations');

  let queried;
  const feed = load('src/lib/magazine/getFilteredPosts.ts', { '@/lib/prisma': { prisma: { projectPost: { findMany: async query => { queried = query; return []; } } } } });
  for (const filter of [null, { type: 'location', value: 'Miami' }, { type: 'category', value: 'Homes' }, { type: 'keyword', value: 'wood' }]) {
    await feed.getFilteredPosts({ filter, followedDesignerIds: ['designer'] });
    assert.equal(queried.where.status, 'PUBLISHED'); assert.equal(queried.where.project.isPublic, true);
    assert.deepEqual(plain(queried.where.project.designerId), { in: ['designer'] });
  }
  let heroQueries = 0;
  const home = load('src/lib/homepage/getHomepageData.ts', { '@/lib/prisma': { prisma: { projectPost: { findFirst: async query => {
    heroQueries++; assert.equal(query.where.status, 'PUBLISHED'); assert.equal(query.where.project.isPublic, true); return null;
  } } } }, '@/lib/products/imageProvenance': {}, '@/lib/magazine/getFilteredPosts': { getFilteredPosts: async () => ({ posts: [], nextCursor: null }) } });
  await home.getHomepageData(); assert.equal(heroQueries, 3, 'Pin, scheduled and fallback hero respect feature visibility');
  console.log('PASS home feed and filter predicates exclude photo portfolios and withdrawn features');

  let project = { isPublic: true, post: { status: 'DRAFT' } }, authorized = true, generations = 0;
  const imports = { 'next-auth': { getServerSession: async () => ({ user: { id: 'actor' } }) }, '@/app/api/auth/[...nextauth]/options': {},
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status || 200 }) } },
    '@/lib/prisma': { prisma: { project: { findUnique: async () => project } } },
    '@/lib/authz/access': { assertProjectView: async () => { if (!authorized) throw Error('Forbidden'); } },
    '@/lib/publish/projectPublication': publication,
  };
  for (const kind of ['caption', 'slide', 'export']) {
    const route = load(`src/app/api/instagram/${kind}/route.ts`, imports, name => name.startsWith('@/') ? new Proxy({}, { get: () => () => { generations++; throw Error('Unexpected generation'); } }) : require(name));
    const request = { json: async () => ({ projectId: '00000000-0000-4000-8000-000000000001', orderedImageIds: ['00000000-0000-4000-8000-000000000002'], slideIndex: 0 }) };
    for (const state of [{ isPublic: true, post: null }, { isPublic: true, post: { status: 'DRAFT' } }, { isPublic: true, post: { status: 'REVIEW' } }, { isPublic: false, post: { status: 'PUBLISHED' } }]) {
      project = state; assert.equal((await route.POST(request)).status, 409);
    }
    authorized = false; assert.equal((await route.POST(request)).status, 403); authorized = true;
  }
  assert.equal(generations, 0, 'Locked projects cannot generate through legacy URLs');
  assert.equal(publication.hasPublishedProjectFeature({ isPublic: true, post: { status: 'PUBLISHED' } }), true);
  console.log('PASS legacy publishing tools reject photo-only, draft, review and withdrawn projects before generation');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

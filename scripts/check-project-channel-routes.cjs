// Real server pages, public DTO and permission code; only framework/DB boundaries are fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
let session = null, post, modules, membership = null, workspace = false;
const queries = [];
const fail = type => { throw new Error(type); };
const navigation = { notFound: () => fail('NOT_FOUND'), redirect: href => fail(`REDIRECT:${href}`), useSearchParams: () => new URLSearchParams() };
const prisma = {
  projectPost: {
    findUnique: async query => {
      queries.push(query); const projectFields = query.include.project.select || query.include.project.include;
      assert.deepEqual(projectFields.images.where, { inclusion: 'INCLUDED' });
      assert.deepEqual((projectFields.images.select || projectFields.images.include).tags.where, { product: { isPending: false } });
      if (!post || query.where.slug !== post.slug) return null;
      return { ...post, project: { ...post.project, images: post.project.images.filter(i => i.inclusion === 'INCLUDED') } };
    },
    findFirst: async query => {
      queries.push(query); assert.equal(query.where.status, 'PUBLISHED'); assert.equal(query.where.project.isPublic, true);
      if (query.where.slug) {
        assert.deepEqual(query.select.project.select.images.where, { inclusion: 'INCLUDED' });
        return post?.status === 'PUBLISHED' && post.project.isPublic && query.where.slug === post.slug
          ? { ...post, project: { ...post.project, images: post.project.images.filter(i => i.inclusion === 'INCLUDED') } } : null;
      }
      return post?.status === 'PUBLISHED' && post.project.isPublic && query.where.projectId === post.projectId ? { slug: post.slug } : null;
    },
  },
  project: { findUnique: async query => {
    if (query.select.title) fail('WORKSPACE_REACHED');
    return { ownerId: 'owner', designerId: 'designer', designerOrgId: 'firm' };
  } },
  organizationUser: { findFirst: async query => {
    assert.deepEqual(query.where, { organizationId: 'firm', userId: session.user.id, isActive: true, role: { in: ['OWNER', 'ADMIN'] } });
    return membership?.active && membership.org === 'firm' && ['OWNER', 'ADMIN'].includes(membership.role) ? { id: 'member' } : null;
  } },
  projectModule: {
    findMany: async query => { verifyMediaQuery(query); return eligibleModules(query); },
    findFirst: async query => { verifyMediaQuery(query); return eligibleModules(query)[0] || null; },
  },
};
function verifyMediaQuery(query) {
  queries.push(query);
  assert.ok(query.where.publishedAt.lte instanceof Date);
  assert.deepEqual(query.where.project, { isPublic: true, post: { is: { status: 'PUBLISHED', slug: 'house' } } });
}
function eligibleModules(query) {
  return modules.filter(m => post?.status === 'PUBLISHED' && post.project.isPublic && m.projectId === post.projectId &&
    m.publishedAt && m.publishedAt <= query.where.publishedAt.lte && query.where.type.in.includes(m.type) && (!query.where.id || m.id === query.where.id));
}
const cache = new Map();
const placeholder = () => null;
const emptyImports = new Proxy({}, { get: () => placeholder });
function load(relative) {
  let file = path.resolve(root, relative);
  if (!path.extname(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx';
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const importer = name => {
    if (name === 'next/navigation') return navigation;
    if (name === 'next-auth') return { getServerSession: async () => session };
    if (name.includes('authOptions') || name.includes('/options') || name === '@/lib/auth') return { authOptions: {} };
    if (name === '@/lib/prisma') return { prisma };
    if (name === '@/lib/article/getRelatedProjects') return { getRelatedProjects: async () => [] };
    if (name === '@vercel/og') return { ImageResponse: class extends Response { constructor(element, options) { super(renderToStaticMarkup(element), options); } } };
    if (name === '@/lib/authz/access') return { assertProjectView: async () => { if (!workspace) fail('Forbidden'); } };
    if (name === '@/lib/spotlight/privacy') return { stripPrivateInterviewData: async p => p };
    if (name === '@/lib/utils') return { titleCase: x => x };
    if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (name.endsWith('/SafeImage')) return { __esModule: true, default: ({ fill, priority, unoptimized, ...props }) => React.createElement('img', props) };
    if (name.includes('ProjectChannelHeroPhotos') || name.includes('ProjectChannelShareTracking')) return emptyImports;
    if (name.includes('StoryRenderer')) return { StoryRenderer: ({ post: p }) => React.createElement('div', { 'data-original-post': p.id }, p.expandedBlocks.introduction.join(' ')) };
    if (file.endsWith('/src/app/project/[id]/page.tsx') && !name.startsWith('@/lib/project-channel/') && (name.startsWith('.') || name.startsWith('@/'))) return emptyImports;
    if (name.startsWith('@/lib/project-channel/') || name.startsWith('@/lib/post/') || name.startsWith('@/lib/story/presentation') || name.startsWith('@/components/story/ProjectChannel')) return load(name.replace('@/', 'src/'));
    if (name.startsWith('@/')) return load(name.replace('@/', 'src/'));
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(importer, mod, mod.exports);
  return mod.exports;
}
const page = load('src/app/p/[slug]/page.tsx');
const feature = load('src/app/p/[slug]/feature/page.tsx');
const media = load('src/app/p/[slug]/media/[moduleId]/page.tsx');
const legacy = load('src/app/project/[id]/page.tsx');
const publicApi = load('src/app/api/posting/[slug]/route.ts');
const og = load('src/app/api/og/project/[slug]/route.tsx');
const { canPreviewProjectShop } = load('src/lib/project-channel/access.ts');
function reset() {
  session = null; membership = null; workspace = false; queries.length = 0;
  post = { id: 'original-post', projectId: 'project', slug: 'house', status: 'PUBLISHED', heroAssetId: 'photo2', excerpt: 'Original deck',
    privateNotes: 'SECRET_NOTE', credits: [], expandedBlocks: { introduction: ['Original introduction'], headline: 'Original headline', lead: { title: 'Original headline' }, galleryChapters: [], credits: [{ name: ' Alice ', role: 'Architect' }, { name: 'Alice', role: 'Architect' }, { name: '  ' }, { name: 'Bob', url: 'javascript:alert(1)' }] },
    project: { id: 'project', isPublic: true, title: 'House', images: [
      { id: 'photo1', url: 'https://cdn.example.com/1.jpg', inclusion: 'INCLUDED', roomId: 'room', tags: [{ product: { id: 'pending', isPending: true, price: 'SECRET_PRICE' } }] },
      { id: 'photo2', url: 'https://cdn.example.com/2.jpg', inclusion: 'INCLUDED', roomId: 'room', tags: [] },
      { id: 'excluded', url: 'https://cdn.example.com/EXCLUDED.jpg', inclusion: 'EXCLUDED', tags: [] },
    ] } };
  modules = [{ id: 'video', projectId: 'project', type: 'LONG_VIDEO', title: 'Drone film', publishedAt: new Date(0), media: [{ kind: 'video', url: 'https://cdn.example.com/drone.mp4', privateNotes: 'SECRET_MEDIA' }] }];
  process.env.FOLIO_EDITORIAL_CHANNELS = 'true';
}
(async () => {
  reset();
  const html = renderToStaticMarkup(await page.default({ params: { slug: 'house' } }));
  assert.match(html, /Read the Folio Feature/); assert.match(html, /Original headline/);
  assert.match(html, /\/p\/house\/feature\?room=room/); assert.equal((html.match(/data-kind="space"/g) || []).length, 2);
  assert.equal((html.match(/data-kind="credit"/g) || []).length, 2);
  assert.doesNotMatch(html, /SECRET|EXCLUDED|javascript:|Coming Soon|future project storefront/);
  assert.match(html, /\/p\/house\/media\/video/);
  const article = renderToStaticMarkup(await feature.default({ params: { slug: 'house' } }));
  assert.match(article, /data-original-post="original-post"/); assert.match(article, /Original introduction/);
  assert.match(article, /Back to project/);
  console.log('PASS public DTO, original feature identity, all photos, credit fallback/deduplication and private-prop exclusion');
  modules[0].isPrimary = true;
  const primary = renderToStaticMarkup(await page.default({ params: { slug: 'house' } }));
  assert.equal(primary.match(/data-kind="([^"]+)"/)[1], 'media', 'Persisted primary selection outranks automatic positions');
  modules[0].isPrimary = false;

  for (const actor of [null, 'stranger', 'owner', 'designer', 'admin', 'member', 'inactive', 'other-org']) {
    session = actor ? { user: { id: actor } } : null;
    membership = { org: actor === 'other-org' ? 'other' : 'firm', active: actor !== 'inactive', role: actor === 'admin' || actor === 'inactive' || actor === 'other-org' ? 'ADMIN' : 'MEMBER' };
    const allowed = ['owner', 'designer', 'admin'].includes(actor);
    assert.equal(await canPreviewProjectShop('project', actor), allowed, actor);
    const body = renderToStaticMarkup(await page.default({ params: { slug: 'house' }, searchParams: { shop: 'true', ownerView: 'true' } }));
    assert.equal(body.includes('Coming Soon'), allowed, `server Shop authorization for ${actor}`);
    assert.doesNotMatch(body, /SECRET_PRICE|SECRET_MEDIA|SECRET_NOTE/);
  }
  console.log('PASS anonymous/stranger/owner/designer/active admin/member/revoked/wrong-org Shop matrix and forged query parameters');

  reset();
  for (const published of [false, true]) for (const visible of [false, true]) {
    post.status = published ? 'PUBLISHED' : 'DRAFT'; post.project.isPublic = visible;
    if (!published || !visible) {
      await assert.rejects(page.default({ params: { slug: 'house' } }), /NOT_FOUND/);
      await assert.rejects(feature.default({ params: { slug: 'house' } }), /NOT_FOUND/);
      await assert.rejects(media.default({ params: { slug: 'house', moduleId: 'video' } }), /NOT_FOUND/);
    }
  }
  reset();
  for (const patch of [{ publishedAt: null }, { publishedAt: new Date(Date.now() + 86400000) }, { projectId: 'other' }, { media: [{ url: 'javascript:alert(1)' }] }]) {
    const saved = modules[0]; modules[0] = { ...saved, ...patch };
    await assert.rejects(media.default({ params: { slug: 'house', moduleId: 'video' } }), /NOT_FOUND/); modules[0] = saved;
  }
  const video = renderToStaticMarkup(await media.default({ params: { slug: 'house', moduleId: 'video' } }));
  assert.match(video, /<video/); assert.match(video, /controls/); assert.doesNotMatch(video, /autoplay/i);
  modules[0] = { ...modules[0], type: 'STORY', media: [{ kind: 'image', url: 'https://cdn.example.com/story.jpg' }] };
  const story = renderToStaticMarkup(await media.default({ params: { slug: 'house', moduleId: 'video' } }));
  assert.match(story, /<img/); assert.doesNotMatch(story, /<video/);
  console.log('PASS parent publication/privacy gates, draft/future/cross-project rejection, video and image-story destinations');

  reset(); post.project.images = [];
  const empty = renderToStaticMarkup(await page.default({params:{slug:'house'}}));
  assert.match(empty,/Read the Folio Feature/); assert.doesNotMatch(empty,/data-kind="space"/);
  console.log('PASS published legacy channel retains feature navigation with no remaining photographs');

  reset();
  const searchParams = { room: 'room', product: 'chair', utm_source: 'folio_share', ref: ['one', 'two'] };
  await assert.rejects(page.default({ params: { slug: 'house' }, searchParams }), /REDIRECT:\/p\/house\/feature\?room=room&product=chair&utm_source=folio_share&ref=one&ref=two/);
  await assert.rejects(legacy.default({ params: { id: 'project' }, searchParams }), /REDIRECT:\/p\/house\?room=room&product=chair&utm_source=folio_share&ref=one&ref=two/);
  session = { user: { id: 'stranger' } };
  await assert.rejects(legacy.default({ params: { id: 'project' }, searchParams: {} }), /REDIRECT:\/p\/house/);
  workspace = true;
  await assert.rejects(legacy.default({ params: { id: 'project' }, searchParams: { view: 'media' } }), /WORKSPACE_REACHED/);
  workspace = false; post.project.isPublic = false;
  await assert.rejects(legacy.default({ params: { id: 'project' }, searchParams: {} }), /NOT_FOUND/);
  reset(); process.env.FOLIO_EDITORIAL_CHANNELS = 'false';
  const old = renderToStaticMarkup(await page.default({ params: { slug: 'house' } }));
  assert.match(old, /data-original-post/); assert.doesNotMatch(old, /Read the Folio Feature/);
  await assert.rejects(feature.default({ params: { slug: 'house' }, searchParams }), /REDIRECT:\/p\/house\?room=room&product=chair&utm_source=folio_share&ref=one&ref=two/);
  await assert.rejects(media.default({ params: { slug: 'house', moduleId: 'video' } }), /NOT_FOUND/);
  const metadata = await feature.generateMetadata({ params: { slug: 'house' } });
  assert.equal(metadata.alternates.canonical, 'https://folioad.com/p/house/feature');
  console.log('PASS flag rollback, legacy visitor redirect, member workspace preservation, deep links, attribution and feature metadata');

  reset();
  modules[0].privateNotes = 'SECRET_RAW_MODULE';
  modules.push({ ...modules[0], id: 'future', publishedAt: new Date(Date.now() + 86400000) }, { ...modules[0], id: 'draft', publishedAt: null });
  const response = await publicApi.GET({}, { params: { slug: 'house' } });
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const payload = await response.json(); assert.deepEqual(payload.modules.map(m => m.id), ['video']);
  assert.doesNotMatch(JSON.stringify(payload), /SECRET|EXCLUDED/);
  assert.equal(payload.modules[0].href, '/p/house/media/video');
  const image = await og.GET({}, { params: { slug: 'house' } });
  assert.equal(og.runtime, 'nodejs'); assert.equal(image.headers.get('Cache-Control'), 'no-store');
  const markup = await image.text(); assert.match(markup, /https:\/\/cdn.example.com\/2.jpg/); assert.doesNotMatch(markup, /EXCLUDED/);
  for (const patch of ['draft', 'private']) {
    reset(); if (patch === 'draft') post.status = 'DRAFT'; else post.project.isPublic = false;
    assert.equal((await publicApi.GET({}, { params: { slug: 'house' } })).status, 404);
    assert.equal((await og.GET({}, { params: { slug: 'house' } })).status, 404);
  }
  console.log('PASS public post API strips raw module metadata/future assets; social images enforce publication/privacy, selected approved hero and no-store');
})().catch(error => { console.error(error); process.exitCode = 1; });

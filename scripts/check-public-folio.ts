/** Actual reader boundaries + actual sanitizer, with serialized responses and no DB/network. */
import { readFileSync } from 'fs';
import ts from 'typescript';
import vm from 'vm';
import assert from 'assert/strict';

const selectedText = 'Glass gives this room space to breathe.';
const originalText = 'PRIVATE_ORIGINAL: We chose a glass table because the room is small.';
const excerpt = 'PRIVATE_SOURCE: The client needed six seats and we discussed several options.';
const alternativeText = 'PRIVATE_ALTERNATIVE: A transparent table keeps six seats from crowding the room.';
function blocks() {
  return { introduction: ['Public article'], galleryChapters: [{ title: 'Dining Room', body: ['Public room article'], pullQuote: {
    authorship: 'folio', selected: { text: 'Public direct quote' }, alternatives: [],
    folio: {
      selected: { text: selectedText, originalText, sources: [{ questionId: 'private-question', isFollowUp: false, excerpt }] },
      alternatives: [{ text: alternativeText, originalText, sources: [{ questionId: 'private-question', isFollowUp: false, excerpt }] }],
    },
  } }] };
}
let post: any, session: any, canWrite: boolean, canView: boolean;
function reset() {
  post = { id: 'post', projectId: 'project', slug: 'story', status: 'PUBLISHED', expandedBlocks: blocks(), provenance: {},
    project: { id: 'project', title: 'A home', isPublic: true, designerId: 'owner', designer: { id: 'owner', name: 'Designer' }, images: [] } };
  session = { user: { id: 'owner' } }; canWrite = true; canView = true;
}
// Match JSON transport: callers inspect values after serialization, not references.
const serialize = (value: unknown) => JSON.parse(JSON.stringify(value));
const mocks: Record<string, any> = {
  'next/server': { NextResponse: { json: (value: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, data: serialize(value) }) } },
  'next-auth': { getServerSession: async () => session },
  '@/app/api/auth/[...nextauth]/options': { authOptions: {} },
  '@/lib/prisma': { prisma: {
    projectPost: { findUnique: async () => structuredClone(post) },
    inContextBoost: { findMany: async () => [{ id: 'boost', productTag: { image: { project: { post: structuredClone(post) } } } }] },
  } },
  '@/lib/modules/getProjectModules': { getProjectModules: async () => [] },
  '@/lib/article/getRelatedProjects': { getRelatedProjects: async () => [] },
  '@/lib/spotlight/privacy': { stripPrivateInterviewData: async (value: unknown) => value },
  '@/lib/authz/access': {
    assertProjectView: async () => { if (!canView) throw new Error('Forbidden'); },
    assertProjectWrite: async () => { if (!canWrite) throw new Error('Forbidden'); },
  },
  '@/lib/boost/inContextBoost': {},
};
function load(file: string) {
  const js = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, any> = {};
  vm.runInNewContext(`(function(require, exports) { ${js}\n })`, { structuredClone, console, Error, URL, Promise })(
    (id: string) => { assert.ok(id in mocks, `Unexpected dependency ${id}`); return mocks[id]; }, exports,
  );
  return exports;
}
mocks['@/lib/posting/publicFolioBlocks'] = load('src/lib/posting/publicFolioBlocks.ts');
const publicReader = load('src/lib/post/getPostBySlug.ts').getPostBySlug;
const publicApi = load('src/app/api/posting/[slug]/route.ts').GET;
const projectApi = load('src/app/api/posting/project/[projectId]/route.ts').GET;
const boostApi = load('src/app/api/products/[productId]/in-context-boosts/route.ts').GET;
function assertPublic(value: any, returnedBlocks: any) {
  const json = JSON.stringify(value);
  for (const privateValue of [originalText, excerpt, alternativeText, 'private-question']) {
    assert.ok(!json.includes(privateValue), `Leaked ${privateValue}`);
  }
  const folio = returnedBlocks.galleryChapters[0].pullQuote.folio;
  assert.deepEqual(folio, { selected: { text: selectedText }, alternatives: [] });
  assert.equal(returnedBlocks.galleryChapters[0].pullQuote.authorship, 'folio');
  assert.deepEqual(returnedBlocks.galleryChapters[0].body, ['Public room article']);
}
let passed = 0;
async function check(name: string, run: () => Promise<void>) {
  reset(); await run(); passed++; console.log(`  PASS ${name}`);
}
async function main() {
  await check('public server reader removes evidence and alternatives', async () => {
    const result = serialize(await publicReader('story')); assertPublic(result, result.expandedBlocks);
    assert.equal(post.expandedBlocks.galleryChapters[0].pullQuote.folio.selected.originalText, originalText);
  });
  await check('public slug API removes evidence and alternatives', async () => {
    session = null;
    const result = await publicApi({}, { params: { slug: 'story' } });
    assert.equal(result.status, 200); assertPublic(result.data, result.data.post.expandedBlocks);
  });
  await check('shared project viewer receives display-only Folio', async () => {
    session.user.id = 'shared-viewer'; canWrite = false;
    const result = await projectApi({}, { params: { projectId: 'project' } });
    assert.equal(result.status, 200); assertPublic(result.data, result.data.post.expandedBlocks);
  });
  for (const userId of ['owner', 'authorized-editor']) await check(`${userId} retains full rewrite evidence`, async () => {
    session.user.id = userId;
    const result = await projectApi({}, { params: { projectId: 'project' } });
    assert.equal(result.status, 200);
    const folio = result.data.post.expandedBlocks.galleryChapters[0].pullQuote.folio;
    assert.equal(folio.selected.originalText, originalText); assert.equal(folio.selected.sources[0].excerpt, excerpt);
    assert.equal(folio.alternatives[0].text, alternativeText);
  });
  await check('boost response does not disclose Folio evidence', async () => {
    session.user.id = 'vendor';
    const result = await boostApi({ url: 'https://example.test/api/products/product/in-context-boosts' }, { params: { productId: 'product' } });
    assert.equal(result.status, 200);
    assertPublic(result.data, result.data.boosts[0].productTag.image.project.post.expandedBlocks);
  });
  await check('unpublished public reader and API reject article', async () => {
    post.status = 'DRAFT';
    assert.equal(await publicReader('story'), null);
    assert.equal((await publicApi({}, { params: { slug: 'story' } })).status, 404);
  });
  await check('private project rejected at public boundaries', async () => {
    post.project.isPublic = false;
    assert.equal(await publicReader('story'), null);
    assert.equal((await publicApi({}, { params: { slug: 'story' } })).status, 404);
  });
  await check('unauthorized project request cannot obtain evidence', async () => {
    canView = false;
    const result = await projectApi({}, { params: { projectId: 'project' } });
    assert.equal(result.status, 403); assert.ok(!JSON.stringify(result.data).includes(originalText));
  });
  await check('removed public selection remains removed', async () => {
    post.expandedBlocks.galleryChapters[0].pullQuote.folio.selected = null;
    const result = serialize(await publicReader('story'));
    assert.deepEqual(result.expandedBlocks.galleryChapters[0].pullQuote.folio, { selected: null, alternatives: [] });
    assert.ok(!JSON.stringify(result).includes(alternativeText));
  });
  console.log(`\n${passed} serialized reader boundary scenarios passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });

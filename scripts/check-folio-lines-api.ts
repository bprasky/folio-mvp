/** Execute the actual route handlers with isolated auth/data/model dependencies. No network or DB. */
import { readFileSync } from 'fs';
import ts from 'typescript';
import vm from 'vm';
import assert from 'assert/strict';
import { needsRoomTeaserPreparation } from '../src/lib/posting/folioLines';

const direct = { text: 'We kept the glass table.', score: 8, provenance: { questionId: 'q1', isFollowUp: false } };
const line = { text: 'Keeping glass gave us more space.', originalText: direct.text, sources: [{ questionId: 'q1', isFollowUp: false, excerpt: 'We kept the glass table for more space.' }] };
let post: any, saved: any, session: any, forbidden: boolean, cas: boolean, answers: string[];
let generations: number, reads: number, stale: boolean, limited: boolean, scrub: boolean;
let revalidated: string[];
function reset() {
  post = { id: 'post', status: 'DRAFT', slug: 'story', expandedBlocks: { introduction: ['Keep introduction'], galleryChapters: [{
    title: 'Kitchen', imageIds: ['room-image'], body: ['Keep article'], pullQuote: { selected: direct, alternatives: [direct], folio: { generatorVersion: 2, selected: line, alternatives: [line] } },
  }] } };
  saved = null; session = { user: { id: 'owner' } }; forbidden = false; cas = true;
  answers = ['source']; generations = 0; reads = 0; stale = false; limited = false; scrub = false; revalidated = [];
}
const mocks: Record<string, any> = {
  'next/server': { NextResponse: { json: (data: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, data }) } },
  'next/cache': { revalidatePath: (path: string) => revalidated.push(path) },
  'next-auth': { getServerSession: async () => session },
  '@/app/api/auth/[...nextauth]/options': { authOptions: {} },
  '@/lib/prisma': { prisma: {
    projectPost: { findUnique: async () => post, updateMany: async (args: unknown) => { saved = args; return { count: cas ? 1 : 0 }; }, update: async (args: unknown) => { saved = args; return post; } },
    productTag: { findMany: async () => [{ productId: 'tagged-product', imageId: 'room-image', finishRaw: 'glass', finishConfirmed: true,
      product: { name: 'Table', brand: 'Brand', category: 'Furniture', description: 'Glass table' } }] },
  } },
  '@/lib/authz/access': { assertProjectWrite: async () => { if (forbidden) throw new Error('Forbidden'); } },
  '@/lib/posting/schemas': {
    getSelectedRoomLineText: (p: any) => typeof p === 'string' ? p : p?.authorship === 'folio' ? p.folio?.selected?.text ?? null : p?.selected?.text ?? null,
    isPullQuoteSelection: (p: any) => p && typeof p === 'object' && Array.isArray(p.alternatives),
    PullQuoteAuthorshipSchema: { safeParse: (value: unknown) => ({ success: value === 'folio' || value === 'verbatim' }) },
    FolioLineSchema: { safeParse: (value: any) => ({ success: typeof value?.text === 'string' && value.text.trim().length > 0 && value.text.length <= 300 && typeof value.originalText === 'string' && value.sources?.length > 0 }) },
    syncPullQuotesFromChapters: () => {},
  },
  '@/lib/posting/loadInterviewAnswers': { loadInterviewAnswers: async () => { reads++; return stale && reads > 1 ? [] : answers; } },
  '@/lib/posting/prepareRoomTeasers': { prepareRoomTeasers: async (blocks: any) => {
    generations++;
    for (const chapter of blocks.galleryChapters) {
      if (chapter.kind === 'gallery' || chapter.pullQuote?.folio?.alternatives?.length) continue;
      chapter.pullQuote = { selected: { text: `${chapter.title} direct option` }, alternatives: [],
        folio: { generatorVersion: 2, selected: line, alternatives: [line] } };
    }
    return blocks;
  } },
  '@/lib/posting/selectPullQuotes': { selectPullQuotes: async () => ({ byRoom: {
    Kitchen: { selected: { text: 'New direct option' }, alternatives: [{ text: 'New direct option', score: 7 }] },
    Bedroom: { selected: { text: 'Bedroom direct option' }, alternatives: [{ text: 'Bedroom direct option', score: 7 }] },
  }, roomsWithNoCandidates: [], roomsFailedVerification: [] }) },
  '@/lib/utils/correlation': { cid: () => 'test-backfill' },
  '@/lib/posting/folioLines': { needsRoomTeaserPreparation, folioLinesMatchSources: (lines: any[], _room: string, current: string[], article: string[]) =>
    lines.every(line => line.sources.every((source: any) => source.kind === 'article'
      ? article?.[source.paragraphIndex]?.includes(source.excerpt) : current.length > 0)) },
  '@/lib/posting/generateFolioLines': { generateFolioLines: async (_room: string, _answers: unknown, _project: string, _direct: unknown, tags: unknown[], article: string[]) => {
    assert.deepEqual(JSON.parse(JSON.stringify(article)), ['Keep article']);
    assert.deepEqual(JSON.parse(JSON.stringify(tags)), [{ productId: 'tagged-product', name: 'Table', brand: 'Brand', category: 'Furniture', description: 'Glass table', finish: 'glass' }]);
    generations++; return [line];
  } },
  '@/lib/rateLimit': { checkRateLimit: async () => ({ success: !limited, reset: Date.now() + 60000 }) },
  '@/lib/naming/resolveProductNaming': { resolveProductNaming: async (ids: string[]) => { assert.deepEqual(ids, ['tagged-product']); return new Map(); } },
  '@/lib/naming/scrubProse': { scrubProseNaming: (blocks: any) => ({ blocks: scrub ? { introduction: ['A brand-free version.'] } : blocks }) },
};
function load(name: string) {
  const source = readFileSync(`src/app/api/posting/project/[projectId]/sections/${name}/route.ts`, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, any> = {};
  vm.runInNewContext(`(function(require, exports) { ${js}\n })`, { structuredClone, console })(
    (id: string) => { assert.ok(id in mocks, `Unexpected dependency: ${id}`); return mocks[id]; }, exports,
  );
  return exports;
}
const patch = load('pull-quote').PATCH;
const generate = load('folio-lines').POST;
const backfill = load('pull-quotes/backfill').POST;
const request = (body: unknown) => ({ json: async () => body });
const context = { params: { projectId: 'project' } };
let passed = 0;
async function check(name: string, run: () => Promise<void>) {
  reset(); await run(); passed++; console.log(`  PASS ${name}`);
}
async function main() {
  for (const handler of [patch, generate]) {
    await check('unauthenticated does not generate or save', async () => {
      session = null; const result = await handler(request({ chapterIndex: 0, authorship: 'folio' }), context);
      assert.equal(result.status, 401); assert.equal(generations, 0); assert.equal(saved, null);
    });
    await check('non-owner does not generate or save', async () => {
      forbidden = true; const result = await handler(request({ chapterIndex: 0, authorship: 'folio' }), context);
      assert.equal(result.status, 403); assert.equal(generations, 0); assert.equal(saved, null);
    });
    for (const chapterIndex of [-1, 0.5, '0', 9]) await check(`invalid index ${chapterIndex}`, async () => {
      const result = await handler(request({ chapterIndex, authorship: 'folio' }), context);
      assert.equal(result.status, 400); assert.equal(saved, null);
    });
    await check('gallery cannot be edited', async () => {
      post.expandedBlocks.galleryChapters[0].kind = 'gallery';
      assert.equal((await handler(request({ chapterIndex: 0, authorship: 'folio' }), context)).status, 400);
      assert.equal(saved, null);
    });
    await check('concurrent edit returns conflict with original JSON CAS', async () => {
      cas = false; const original = structuredClone(post.expandedBlocks);
      assert.equal((await handler(request({ chapterIndex: 0, authorship: 'folio' }), context)).status, 409);
      assert.deepEqual(saved.where.expandedBlocks.equals, original); assert.equal(revalidated.length, 0);
    });
  }
  await check('generation retains article, direct pool, and source excerpts', async () => {
    delete post.expandedBlocks.galleryChapters[0].pullQuote.folio; scrub = true;
    const result = await generate(request({ chapterIndex: 0 }), context);
    assert.equal(result.status, 200); assert.equal(generations, 1);
    assert.deepEqual(result.data.pullQuote.selected, direct); assert.deepEqual(result.data.pullQuote.alternatives, [direct]);
    assert.deepEqual(saved.data.expandedBlocks.introduction, ['Keep introduction']);
    assert.deepEqual(saved.data.expandedBlocks.galleryChapters[0].body, ['Keep article']);
    assert.equal(result.data.pullQuote.folio.selected.text, 'A brand-free version.');
    assert.deepEqual(result.data.pullQuote.folio.selected.sources, line.sources);
    assert.equal(result.data.pullQuote.folio.selected.originalText, direct.text);
    assert.ok(revalidated.includes('/p/story'));
  });
  await check('cached pool avoids model', async () => {
    const result = await generate(request({ chapterIndex: 0 }), context);
    assert.equal(result.status, 200); assert.equal(result.data.cached, true); assert.equal(generations, 0);
  });
  await check('old rewrite pool is replaced with new room teasers', async () => {
    delete post.expandedBlocks.galleryChapters[0].pullQuote.folio.generatorVersion;
    const result = await generate(request({ chapterIndex: 0 }), context);
    assert.equal(result.status, 200); assert.equal(result.data.cached, false); assert.equal(generations, 1);
    assert.equal(result.data.pullQuote.folio.generatorVersion, 2);
  });
  await check('activating cached Folio restores a selected default', async () => {
    post.expandedBlocks.galleryChapters[0].pullQuote.folio.selected = null;
    const result = await generate(request({ chapterIndex: 0 }), context);
    assert.equal(result.status, 200); assert.equal(result.data.pullQuote.authorship, 'folio');
    assert.deepEqual(JSON.parse(JSON.stringify(result.data.pullQuote.folio.selected)), line);
    assert.deepEqual(JSON.parse(JSON.stringify(result.data.pullQuote.folio.alternatives)), [line]);
    assert.equal(result.data.cached, true); assert.equal(generations, 0);
  });
  await check('legacy string retained when adding Folio', async () => {
    post.expandedBlocks.galleryChapters[0].pullQuote = 'Legacy quote';
    const result = await generate(request({ chapterIndex: 0 }), context);
    assert.equal(result.data.pullQuote.selected.text, 'Legacy quote');
    assert.equal(result.data.pullQuote.alternatives[0].text, 'Legacy quote');
  });
  await check('unknown selection rejected', async () => {
    const result = await patch(request({ chapterIndex: 0, authorship: 'folio', selectedText: 'invented' }), context);
    assert.equal(result.status, 400); assert.equal(saved, null);
  });
  await check('switch back retains both selections', async () => {
    post.expandedBlocks.galleryChapters[0].pullQuote.authorship = 'folio';
    const result = await patch(request({ chapterIndex: 0, authorship: 'verbatim' }), context);
    assert.equal(result.status, 200); assert.deepEqual(result.data.pullQuote.selected, direct);
    assert.deepEqual(JSON.parse(JSON.stringify(result.data.pullQuote.folio.selected)), line);
  });
  await check('selection keeps direct provenance', async () => {
    const result = await patch(request({ chapterIndex: 0, selectedText: direct.text }), context);
    assert.deepEqual(result.data.pullQuote.selected.provenance, direct.provenance);
  });
  await check('Folio removal cannot leave the room without a teaser', async () => {
    const result = await patch(request({ chapterIndex: 0, authorship: 'folio', selectedText: null }), context);
    assert.equal(result.status, 400); assert.equal(saved, null);
  });
  await check('direct removal cannot leave the room without a teaser', async () => {
    const result = await patch(request({ chapterIndex: 0, authorship: 'verbatim', selectedText: null }), context);
    assert.equal(result.status, 400); assert.equal(saved, null);
  });
  await check('switching to an empty direct pool is rejected', async () => {
    const pq = post.expandedBlocks.galleryChapters[0].pullQuote;
    pq.authorship = 'folio'; pq.selected = null; pq.alternatives = [];
    const result = await patch(request({ chapterIndex: 0, authorship: 'verbatim' }), context);
    assert.equal(result.status, 400); assert.equal(saved, null);
  });
  await check('switching to Folio with no selection chooses first prepared option', async () => {
    post.expandedBlocks.galleryChapters[0].pullQuote.folio.selected = null;
    const result = await patch(request({ chapterIndex: 0, authorship: 'folio' }), context);
    assert.equal(result.status, 200); assert.deepEqual(JSON.parse(JSON.stringify(result.data.pullQuote.folio.selected)), line);
  });
  await check('article-backed option remains selectable without interview answers', async () => {
    answers = [];
    const articleLine = { text: 'Keep article', originalText: 'Keep article', sources: [{ kind: 'article', paragraphIndex: 0, excerpt: 'Keep article' }] };
    post.expandedBlocks.galleryChapters[0].pullQuote.folio = { generatorVersion: 2, selected: articleLine, alternatives: [articleLine] };
    const result = await patch(request({ chapterIndex: 0, authorship: 'folio' }), context);
    assert.equal(result.status, 200);
  });
  await check('stale article-backed option cannot be activated', async () => {
    const articleLine = { text: 'Old prose', originalText: 'Old prose', sources: [{ kind: 'article', paragraphIndex: 0, excerpt: 'Old prose' }] };
    post.expandedBlocks.galleryChapters[0].pullQuote.folio = { generatorVersion: 2, selected: articleLine, alternatives: [articleLine] };
    const result = await patch(request({ chapterIndex: 0, authorship: 'folio' }), context);
    assert.equal(result.status, 422); assert.equal(saved, null);
  });
  await check('source removed during generation prevents save', async () => {
    delete post.expandedBlocks.galleryChapters[0].pullQuote.folio; stale = true;
    const result = await generate(request({ chapterIndex: 0 }), context);
    assert.equal(result.status, 409); assert.equal(saved, null);
  });
  await check('stale pool cannot be activated by PATCH', async () => {
    answers = []; const result = await patch(request({ chapterIndex: 0, authorship: 'folio' }), context);
    assert.equal(result.status, 422); assert.equal(saved, null);
  });
  await check('rate limit prevents model and save', async () => {
    delete post.expandedBlocks.galleryChapters[0].pullQuote.folio; limited = true;
    assert.equal((await generate(request({ chapterIndex: 0 }), context)).status, 429);
    assert.equal(generations, 0); assert.equal(saved, null);
  });
  await check('backfilling another room preserves active Folio and chosen direct quote', async () => {
    const kitchen = post.expandedBlocks.galleryChapters[0];
    kitchen.pullQuote.authorship = 'folio';
    const before = structuredClone(kitchen.pullQuote);
    post.expandedBlocks.galleryChapters.push({ title: 'Bedroom', body: ['Keep bedroom'], pullQuote: null });
    const result = await backfill(request({}), context);
    assert.equal(result.status, 200); assert.equal(result.data.filled, 1);
    assert.deepEqual(saved.data.expandedBlocks.galleryChapters[0].pullQuote, before);
    assert.equal(saved.data.expandedBlocks.galleryChapters[1].pullQuote.selected.text, 'Bedroom direct option');
  });
  await check('complete Folio-only selector needs no backfill or model', async () => {
    const kitchen = post.expandedBlocks.galleryChapters[0];
    kitchen.pullQuote.authorship = 'folio'; kitchen.pullQuote.selected = null; kitchen.pullQuote.alternatives = [];
    const before = structuredClone(kitchen.pullQuote.folio);
    const result = await backfill(request({}), context);
    assert.equal(result.status, 200); assert.equal(result.data.filled, 0);
    assert.equal(saved, null); assert.equal(generations, 0);
    assert.deepEqual(kitchen.pullQuote.folio, before);
  });
  for (const failure of ['anonymous', 'nonowner', 'published', 'limited', 'stale', 'conflict']) await check(`backfill rejects ${failure} without successful persistence`, async () => {
    delete post.expandedBlocks.galleryChapters[0].pullQuote.folio;
    const status = { anonymous: 401, nonowner: 403, published: 409, limited: 429, stale: 409, conflict: 409 }[failure];
    if (failure === 'anonymous') session = null;
    if (failure === 'nonowner') forbidden = true;
    if (failure === 'published') post.status = 'PUBLISHED';
    if (failure === 'limited') limited = true;
    if (failure === 'stale') stale = true;
    if (failure === 'conflict') cas = false;
    const result = await backfill(request({}), context);
    assert.equal(result.status, status);
    assert.equal(revalidated.length, 0);
    if (failure !== 'conflict') assert.equal(saved, null);
  });
  console.log(`\n${passed} API scenarios passed (mocked dependencies; no live model/database).`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });

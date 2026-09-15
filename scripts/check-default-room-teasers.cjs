/** Exercise the actual preparation boundary with model transport replaced. */
require('tsx/cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const schemas = require('../src/lib/posting/schemas.ts');
const folio = require('../src/lib/posting/folioLines.ts');
const format = require('../src/lib/utils/formatRoomName.ts');
const scrub = require('../src/lib/naming/scrubProse.ts');
const source = fs.readFileSync('src/lib/posting/prepareRoomTeasers.ts', 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const direct = { selected: { text: 'We chose glass to keep the room open.' }, alternatives: [{ text: 'We chose glass to keep the room open.', score: 1 }] };
const chapter = (title, roomId = title) => ({ kind: 'editorial', title, roomId, body: ['A glass table keeps the dining room open. Black hardware balances the bright wallpaper.'], pullQuote: null });
const answer = { questionId: 'q1', section: 'DINING_ROOM', answer: direct.selected.text, category: null, questionCategory: null, isFollowUp: false };
function load(generate, rank = async (rooms, answers, _cid, _project, auto) => {
  assert.equal(auto, true);
  assert.ok(answers.every(a => a.category === null));
  assert.ok(answers.every(a => a.section === format.formatRoomName(a.section)));
  return { byRoom: { 'Dining Room': direct } };
}, tags = [], naming = new Map()) {
  const context = { exports: {}, require: id => {
    if (id.includes('formatRoomName')) return format;
    if (id === '@/lib/prisma') return { prisma: { productTag: { findMany: async () => tags } } };
    if (id === '@/lib/naming/resolveProductNaming') return { resolveProductNaming: async () => naming };
    if (id === '@/lib/naming/scrubProse') return scrub;
    if (id === './schemas') return schemas;
    if (id === './folioLines') return folio;
    if (id === './generateFolioLines') return { generateFolioLines: generate };
    if (id === './selectPullQuotes') return { selectPullQuotes: rank };
    throw new Error(id);
  } };
  vm.runInNewContext(js, context);
  return context.exports.prepareRoomTeasers;
}
async function main() {
  let active = 0, peak = 0, calls = 0;
  const prepare = load(async (room, answers, project, directPool, tags, article) => {
    active++; calls++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1)); active--;
    return folio.articleFolioLines(room, article);
  });
  const blocks = { galleryChapters: [chapter('DINING_ROOM'), chapter('Entry'), chapter('Kitchen'), { kind: 'gallery', title: 'Hall', body: [] }] };
  await prepare(blocks, [answer, { ...answer, category: 'overview' }], 'p', { refresh: true });
  assert.equal(calls, 3); assert.equal(peak, 2);
  assert.equal(blocks.galleryChapters[0].pullQuote.authorship, 'verbatim');
  for (const ch of blocks.galleryChapters.slice(0, 3)) {
    assert.ok(schemas.getSelectedRoomLineText(ch.pullQuote));
    assert.ok(ch.pullQuote.folio.alternatives.length);
    assert.ok(schemas.PullQuoteSelectionSchema.safeParse(ch.pullQuote).success);
  }
  assert.equal(blocks.galleryChapters[1].pullQuote.authorship, 'folio');
  assert.equal(blocks.galleryChapters[3].pullQuote, undefined);
  console.log('PASS generation persists selected lines and both pools, normalizes rooms, excludes gallery, bounds concurrency');
  const empty = { galleryChapters: [chapter('Entry')] };
  await load(async () => { throw new Error('provider down'); }, async () => { throw new Error('ranker down'); })(empty, [], 'p');
  assert.ok(schemas.getSelectedRoomLineText(empty.galleryChapters[0].pullQuote));
  assert.equal(empty.galleryChapters[0].pullQuote.authorship, 'folio');
  console.log('PASS missing interview and provider failure still produce selected article teaser');
  const before = JSON.stringify(blocks.galleryChapters[0].pullQuote);
  calls = 0;
  await prepare(blocks, [answer], 'p');
  assert.equal(JSON.stringify(blocks.galleryChapters[0].pullQuote), before);
  assert.equal(calls, 0, 'Legacy preparation reuses valid pools');
  const frozen = { galleryChapters: [blocks.galleryChapters[0]] };
  await prepare(frozen, [answer], 'p', { refresh: true, preserveRoomIds: ['DINING_ROOM'] });
  assert.equal(JSON.stringify(frozen.galleryChapters[0].pullQuote), before);
  assert.equal(calls, 0);
  console.log('PASS backfill preserves selection and cached pools; append preserves frozen room');
  const oldFrozen = { galleryChapters: [{ ...chapter('Dining Room', 'dining'), pullQuote: direct }] };
  await prepare(oldFrozen, [answer], 'p', { refresh: true, preserveRoomIds: ['dining'] });
  assert.equal(oldFrozen.galleryChapters[0].pullQuote.selected.text, direct.selected.text);
  assert.ok(oldFrozen.galleryChapters[0].pullQuote.folio.alternatives.length);
  console.log('PASS frozen room without Folio choices gets its missing pool without changing selection');
  const legacy = { galleryChapters: [{ ...chapter('Dining Room'), pullQuote: 'The original selected direct quote.' }] };
  await prepare(legacy, [answer], 'p');
  assert.equal(legacy.galleryChapters[0].pullQuote.selected.text, 'The original selected direct quote.');
  assert.equal(legacy.galleryChapters[0].pullQuote.alternatives[0].text, 'The original selected direct quote.');
  assert.ok(legacy.galleryChapters[0].pullQuote.folio.alternatives.length);
  console.log('PASS legacy string selection remains selected during automatic preparation');
  const evidence = { questionId: 'q1', isFollowUp: false, excerpt: 'We chose the Atwell Pendant for its round shape.' };
  const namedLine = { text: 'The Atwell Pendant brings a round shape to the dining room.', originalText: evidence.excerpt, sources: [evidence] };
  const product = { productId: 'p1', imageId: 'dining-photo', finishRaw: 'glass', finishConfirmed: true,
    product: { name: 'Atwell Pendant', brand: 'Atwell', category: 'Lighting', description: null } };
  const named = { galleryChapters: [{ ...chapter('Dining Room'), imageIds: ['dining-photo'] }] };
  await load(async (_room, _answers, _project, _direct, productTags) => {
    assert.equal(productTags.length, 1); assert.equal(productTags[0].productId, 'p1');
    return [namedLine];
  }, undefined, [product, { ...product, productId: 'p2', imageId: 'other-room' }], new Map([['p1', {
    productId: 'p1', named: false, reason: 'not_eligible', name: 'Atwell Pendant', brand: 'Atwell', vendorName: null, category: 'Lighting',
  }]]) )(named, [{ ...answer, answer: evidence.excerpt }], 'p');
  assert.ok(!named.galleryChapters[0].pullQuote.folio.selected.text.includes('Atwell'));
  assert.deepEqual(named.galleryChapters[0].pullQuote.folio.selected.sources, [evidence]);
  console.log('PASS model gets only this room products and commercial names are scrubbed without rewriting evidence');
  const route = fs.readFileSync('src/app/api/posting/project/[projectId]/sections/[chapterIndex]/regenerate/route.ts', 'utf8');
  const start = route.indexOf('    const gatedChapters =');
  const end = route.indexOf('  } catch (error:', start);
  assert.ok(start > 0 && end > start);
  const persistence = ts.transpileModule(`async function persistSection() { ${route.slice(start, end)} }`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  for (const failure of ['none', 'stale', 'conflict']) {
    const original = { galleryChapters: [chapter('Dining Room')] };
    const gatedBlocks = structuredClone(original);
    gatedBlocks.galleryChapters[0].body = ['The new room article.'];
    let write, revalidated = false;
    const context = {
      gatedBlocks, newBody: gatedBlocks.galleryChapters[0].body, chapterIndex: 0,
      chapter: original.galleryChapters[0], previousBody: original.galleryChapters[0].body,
      projectId: 'p', session: { user: { id: 'owner' } }, _cid: 'test', history: [],
      post: { id: 'post', expandedBlocks: original, sectionOverrides: [] },
      loadInterviewAnswers: async () => [],
      prepareRoomTeasers: async blocks => { blocks.galleryChapters[0].pullQuote = { folio: { alternatives: [{ text: 'New teaser' }] } }; },
      syncPullQuotesFromChapters: () => {},
      folioLinesMatchSources: () => failure !== 'stale',
      prisma: { projectPost: { updateMany: async args => { write = args; return { count: failure === 'conflict' ? 0 : 1 }; } } },
      revalidatePath: () => { revalidated = true; },
      NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) },
    };
    const run = vm.runInNewContext(`${persistence}\npersistSection`, context);
    const result = await run();
    assert.equal(result.status, failure === 'none' ? 200 : 409);
    assert.equal(revalidated, failure === 'none');
    if (failure === 'stale') assert.equal(write, undefined);
    else {
      assert.deepEqual(write.where.expandedBlocks.equals, original);
      assert.equal(write.data.expandedBlocks.galleryChapters[0].pullQuote.folio.alternatives[0].text, 'New teaser');
    }
  }
  console.log('PASS section regeneration persists prepared selector and rejects source changes/concurrent edits');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

/** Exercise saved article data, the real PATCH boundary, and real edit/preview controls. No network or DB. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import Module from 'node:module';
import ts from 'typescript';
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { buildStoryData } from '../src/lib/story/buildRoomTiles';
import * as schemas from '../src/lib/posting/schemas';
import * as embedded from '../src/lib/posting/embeddedQuotes';
import { publicFolioBlocks } from '../src/lib/posting/publicFolioBlocks';

const first = 'We wanted every room to feel distinct while still belonging to the same house.';
const second = 'We kept the original stone because its character gave the room a starting point.';
const makePost = () => ({ id: 'post', status: 'DRAFT', slug: 'example',
  project: { isPublic: false, designerOrg: { name: 'Example Studio' }, designer: { name: 'Alex Designer', studio: 'Old Studio' },
    images: Array.from({ length: 6 }, (_, i) => ({ id: `00000000-0000-4000-8000-00000000000${i}`, url: `/room-${i}.jpg` })) },
  expandedBlocks: { lead: { title: 'A house shaped by stone', deck: 'A project description.' },
    pullQuotes: [{ text: first }],
    galleryChapters: Array.from({ length: 6 }, (_, i) => ({ title: `Room ${i}`, imageIds: [`00000000-0000-4000-8000-00000000000${i}`], body: ['Keep the room prose.'],
      pullQuote: { selected: { text: second }, alternatives: [{ text: second, score: 1 }], authorship: 'folio',
        folio: { selected: { text: `Folio opening ${i}`, originalText: second, sources: [{ questionId: 'q', isFollowUp: false, excerpt: second }] }, alternatives: [] } } })) },
  supplementalQuotes: [] as any[],
});
let post: any, session: any, saved: any, forbidden = false, conflict = false;
let revalidated: string[] = [];
function reset() { post = makePost(); session = { user: { id: 'owner' } }; saved = null; forbidden = false; conflict = false; revalidated = []; }
let passed = 0;
async function check(name: string, run: () => unknown) { reset(); await run(); passed++; console.log('PASS', name); }
const mocks: Record<string, any> = {
  'next/server': { NextResponse: { json: (data: any, init?: any) => ({ status: init?.status ?? 200, data }) } },
  'next/cache': { revalidatePath: (path: string) => revalidated.push(path) },
  'next-auth': { getServerSession: async () => session },
  '@/app/api/auth/[...nextauth]/options': { authOptions: {} },
  '@/lib/authz/access': { assertProjectWrite: async () => { if (forbidden) throw new Error('Forbidden'); } },
  '@/lib/prisma': { prisma: { projectPost: { findUnique: async () => post, updateMany: async (args: any) => { saved = args; return { count: conflict ? 0 : 1 }; } } } },
  '@/lib/posting/schemas': schemas,
  '@/lib/posting/embeddedQuotes': embedded,
  '@/lib/story/buildRoomTiles': { buildStoryData },
};
const routeSource = readFileSync('src/app/api/posting/project/[projectId]/sections/embedded-quote/route.ts', 'utf8');
const routeJs = ts.transpileModule(routeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const route: any = {};
vm.runInNewContext(`(function(require,exports){${routeJs}\n})`, { structuredClone, console, Error })((id: string) => { assert.ok(id in mocks, id); return mocks[id]; }, route);
const request = (body: unknown) => ({ json: async () => body });
const context = { params: { projectId: 'project' } };
const choice = { slotId: 'breather-2', sourceId: 'designer', text: second, attribution: 'organization' };
const patch = (body: unknown = choice) => route.PATCH(request(body), context);

async function main() {
  await check('organization relation wins over old studio and individual; alternatives contain no Folio lines', () => {
    const story = buildStoryData(post)!;
    assert.equal(story.breathers[0].attribution, 'Example Studio');
    assert.deepEqual(story.breathers[0].options.map(option => option.text), [first, second]);
    assert.equal(story.breathers.length, 1, 'extra alternatives do not add automatic article quotations');
  });
  await check('studio and individual fallback, including no organization', () => {
    post.project.designerOrg = null;
    assert.equal(buildStoryData(post)!.breathers[0].attribution, 'Old Studio');
    post.project.designer.studio = null;
    assert.equal(buildStoryData(post)!.breathers[0].attribution, 'Alex Designer');
  });
  await check('saved choice survives schema parse and public projection; individual override stays selected', () => {
    post.expandedBlocks.embeddedQuotes = [{ ...choice, attribution: 'designer' }];
    // Fixture Folio alternatives are empty, so validate the choice field independently of that intentionally small pool.
    const parsed = schemas.BlocksSchema.parse({ embeddedQuotes: post.expandedBlocks.embeddedQuotes });
    assert.deepEqual(parsed.embeddedQuotes, post.expandedBlocks.embeddedQuotes);
    post.expandedBlocks = publicFolioBlocks(post.expandedBlocks);
    const quote = buildStoryData(post)!.breathers[0];
    assert.equal(quote.quote, second); assert.equal(quote.attribution, 'Alex Designer');
  });
  await check('unavailable saved quote falls back to current evidence without rendering stale text', () => {
    post.expandedBlocks.embeddedQuotes = [{ ...choice, text: 'Removed answer' }];
    assert.equal(buildStoryData(post)!.breathers[0].quote, first);
  });
  await check('choosing an alternative does not insert the old quote again in a new break', () => {
    post.expandedBlocks.embeddedQuotes = [choice];
    const quotes = buildStoryData(post)!.breathers;
    assert.equal(quotes.length, 1);
    assert.equal(quotes[0].quote, second);
  });
  await check('pinned contributor retains its own credit, not the designer organization', async () => {
    post.supplementalQuotes = [{ id: 'builder', pinned: true, contributorRole: 'BUILDER', answer: 'We rebuilt the stair from its original drawings.' }];
    const quote = buildStoryData(post)!.breathers[0];
    assert.equal(quote.attribution, 'Builder');
    assert.equal((await patch({ ...quote.choice, attribution: 'organization' })).status, 200);
    assert.equal(saved.data.expandedBlocks.embeddedQuotes[0].attribution, undefined);
  });
  await check('unauthenticated request cannot save', async () => { session = null; assert.equal((await patch()).status, 401); assert.equal(saved, null); });
  await check('another owner cannot save', async () => { forbidden = true; assert.equal((await patch()).status, 403); assert.equal(saved, null); });
  for (const status of ['PUBLISHED', 'REVIEW', 'ARCHIVED']) await check(`${status} post cannot be edited`, async () => {
    post.status = status; assert.equal((await patch()).status, 409); assert.equal(saved, null);
  });
  await check('public project cannot be edited through draft route', async () => { post.project.isPublic = true; assert.equal((await patch()).status, 409); });
  for (const invalid of [{ ...choice, slotId: 'breather-8' }, { ...choice, attribution: 'somebody else' }, { ...choice, unexpected: true }]) {
    await check('invalid payload is rejected', async () => { assert.equal((await patch(invalid)).status, 400); assert.equal(saved, null); });
  }
  for (const invalid of [{ ...choice, text: 'Invented quote' }, { ...choice, text: 'Folio opening 0' }, { ...choice, sourceId: 'contributor:fake' }]) {
    await check('new text, Folio writing and forged source cannot become a direct quote', async () => { assert.equal((await patch(invalid)).status, 422); assert.equal(saved, null); });
  }
  await check('organization mode requires a real organization or studio', async () => {
    post.project.designerOrg = null; post.project.designer.studio = null;
    assert.equal((await patch()).status, 400); assert.equal(saved, null);
  });
  await check('concurrent edits and publishing use compare-and-save guards', async () => {
    conflict = true; assert.equal((await patch()).status, 409);
    assert.deepEqual(saved.where.expandedBlocks.equals, post.expandedBlocks);
    assert.equal(saved.where.status, 'DRAFT'); assert.equal(saved.where.project.isPublic, false);
    assert.equal(revalidated.length, 0);
  });
  await check('selection persists independently of room opening, prose and other quote', async () => {
    post.expandedBlocks.embeddedQuotes = [{ ...choice, slotId: 'breather-5', text: first }];
    assert.equal((await patch()).status, 200);
    assert.deepEqual(saved.data.expandedBlocks.galleryChapters, post.expandedBlocks.galleryChapters);
    assert.equal(saved.data.expandedBlocks.embeddedQuotes.length, 2);
    post.expandedBlocks = saved.data.expandedBlocks;
    assert.equal(buildStoryData(post)!.breathers[0].quote, second);
    assert.ok(revalidated.includes('/p/example'));
  });
  await check('regeneration keeps latest user choices at the final save boundary', () => {
    const source = readFileSync('src/app/api/posting/project/[projectId]/interview/generate/route.ts', 'utf8');
    const start = source.indexOf('const embeddedQuotes = savedEmbeddedQuoteChoices(current.expandedBlocks)');
    const end = source.indexOf('const result = await tx.projectPost.update', start);
    assert.ok(start > 0 && end > start);
    const expandedBlocks: any = structuredClone(post.expandedBlocks);
    const current = { expandedBlocks: { embeddedQuotes: [choice] } };
    vm.runInNewContext(source.slice(start, end), { current, expandedBlocks, savedEmbeddedQuoteChoices: embedded.savedEmbeddedQuoteChoices });
    assert.deepEqual(expandedBlocks.embeddedQuotes, [choice]);
  });
  const savedFixture = process.argv.indexOf('--saved-project-fixture');
  if (savedFixture >= 0) await check('exact saved article uses organization credit and can persist a different embedded quote', async () => {
    post = JSON.parse(readFileSync(process.argv[savedFixture + 1], 'utf8'));
    const story = buildStoryData(post)!;
    assert.ok(story.breathers.length > 0);
    const quote = story.breathers[0];
    assert.equal(quote.attribution, post.project.designerOrg.name);
    const alternative = quote.options.find(option => option.sourceId === 'designer' && option.text !== quote.quote)!;
    assert.ok(alternative);
    const selected = { ...quote.choice, sourceId: alternative.sourceId, text: alternative.text };
    assert.equal((await patch(selected)).status, 200);
    post.expandedBlocks = saved.data.expandedBlocks;
    assert.equal(buildStoryData(post)!.breathers[0].quote, alternative.text);
  });

  (globalThis as any).React = React;
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  let edit: any = null;
  let refreshes = 0;
  const originalLoad = (Module as any)._load;
  (Module as any)._load = function(id: string, ...args: any[]) {
    if (id === './StoryEditContext') return { useStoryEdit: () => edit, StoryEditRegion: ({ children }: any) => React.createElement('div', null, children) };
    return originalLoad.call(this, id, ...args);
  };
  const { BreatherQuote } = require('../src/components/story/BreatherQuote');
  (Module as any)._load = originalLoad;
  const root = createRoot(document.getElementById('root')!);
  const requests: any[] = [];
  let failed = false;
  (globalThis as any).fetch = async (url: string, init: any) => {
    requests.push({ url, body: JSON.parse(init.body) });
    return { ok: !failed, json: async () => failed ? { error: 'The article changed. Refresh and try again.' } : { choice: requests.at(-1).body } };
  };
  await check('preview/public displays organization credit with no editor controls', () => {
    const html = renderToStaticMarkup(React.createElement(BreatherQuote, { breather: buildStoryData(post)!.breathers[0], reducedMotion: true }));
    assert.ok(html.includes('Example Studio')); assert.ok(!html.includes('<button')); assert.ok(!html.includes('<select'));
  });
  await check('real edit controls save quote and attribution; failures retain saved display', async () => {
    edit = { projectId: 'project', refresh: () => { refreshes++; } };
    await act(async () => root.render(React.createElement(BreatherQuote, { breather: buildStoryData(post)!.breathers[0], reducedMotion: true })));
    await act(async () => document.querySelector('button')!.click());
    const quote = document.querySelector('[aria-label="Embedded quote"]') as HTMLSelectElement;
    const credit = document.querySelector('[aria-label="Quote attribution"]') as HTMLSelectElement;
    assert.equal(credit.value, 'organization');
    await act(async () => { quote.value = '1'; quote.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.equal(requests.at(-1).body.text, second);
    assert.equal(document.querySelector('blockquote')!.textContent, `“${second}”`);
    await act(async () => { credit.value = 'designer'; credit.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.ok(document.querySelector('footer')!.textContent!.includes('Alex Designer'));
    assert.equal(refreshes, 2);
    failed = true;
    await act(async () => { quote.value = '0'; quote.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.equal(document.querySelector('blockquote')!.textContent, `“${second}”`);
    assert.ok(document.querySelector('[role="alert"]')!.textContent!.includes('article changed'));
  });
  await act(async () => root.unmount()); dom.window.close();
  console.log(`${passed} embedded quote checks passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });

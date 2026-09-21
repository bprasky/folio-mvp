import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
import { extractRoomTeasers, matchRoomTeasersToImages } from '../src/lib/instagram/roomTeasers';
import { generateCaption } from '../src/lib/instagram/campaign/generateCaptions';
import { formatQuoteText } from '../src/lib/instagram/placeQuoteSmart';

const text = 'A glass table keeps the dining room open, while black accents balance its brightness.';
const blocks: any = { pullQuotes: [{ text: 'Stale top-level quote must not replace the selected teaser.' }], galleryChapters: [
  { imageIds: ['dining', 'dining-2'], pullQuote: { authorship: 'folio', selected: { text: 'Unused interview quote' }, folio: { selected: { text }, alternatives: [{ text: 'Unselected alternative' }] } } },
  ...Array.from({ length: 5 }, (_, i) => ({ imageIds: [`room-${i}`], pullQuote: { selected: { text: `Direct room ${i}` } } })),
] };
const teasers = extractRoomTeasers(blocks);
assert.equal(teasers.length, 6, 'No four-quote export cap');
assert.deepEqual(teasers[0], { text, authorship: 'folio', imageId: 'dining', imageIds: ['dining', 'dining-2'], chapterIndex: 0 });
assert.equal(teasers[1].authorship, 'verbatim');
const matches = matchRoomTeasersToImages(teasers, [{ id: 'other-room' }, { id: 'dining-2' }]);
assert.equal(matches.get('dining-2')?.text, text);
assert.equal(matches.has('other-room'), false, 'Room teaser cannot migrate to unrelated image');
const caption = generateCaption({ postType: 'quote', project: { title: 'A home', slug: 'home', designerName: 'Designer' }, context: { quoteText: text, quoteAuthorship: 'folio' } }).caption;
assert.ok(caption.includes(text) && caption.includes('Written by Folio'));
assert.ok(!caption.includes(`"${text}"`) && !caption.includes('Designer'));
const legacy = extractRoomTeasers({ galleryChapters: [{ title: 'Dining', body: [text], imageIds: ['dining'], pullQuote: null }, { title: 'Gallery', body: [], imageIds: ['gallery'] }] } as any);
assert.equal(legacy.length, 1);
assert.equal(legacy[0].text, text);
assert.equal(legacy[0].authorship, 'folio');
const roomCaption = generateCaption({ postType: 'room_spotlight', project: { title: 'A home', slug: 'home', designerName: 'Designer' }, context: { roomName: 'Dining', roomTeaser: { text, authorship: 'folio' } } }).caption;
assert.ok(roomCaption.includes(text) && roomCaption.includes('Written by Folio'));
const longLine = `${text} ${text} ${text}`;
assert.equal(formatQuoteText(longLine).lines.join(' '), longLine, 'Social typography cannot truncate the selected text');

function load(file: string, mocks: Record<string, unknown>) {
  const loaded = { exports: {} as any };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, require: (id: string) => {
    if (id in mocks) return mocks[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, Buffer, URL, process: { env: {} }, console: { log() {}, error() {}, warn() {} }, AbortSignal, fetch: async () => ({ ok: true, status: 200, arrayBuffer: async () => image }) }, { filename: file });
  return loaded.exports;
}

let image: Buffer;
async function main() {
  image = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: '#575047' } }).png().toBuffer();
  const overlays: string[] = [];
  const recordingSharp = (...args: any[]) => {
    const pipeline = (sharp as any)(...args);
    const composite = pipeline.composite.bind(pipeline);
    pipeline.composite = (items: any[]) => {
      for (const item of items) if (Buffer.isBuffer(item.input)) overlays.push(item.input.toString());
      return composite(items);
    };
    return pipeline;
  };
  const slide = load('src/lib/instagram/generateSingleSlide.ts', {
    sharp: recordingSharp,
    './matchQuoteToImage': {},
    './roomTeasers': { extractRoomTeasers, matchRoomTeasersToImages },
    './placeQuoteSmart': { formatQuoteText, placeQuoteSmart: async () => ({ x: 540, y: 500, color: '#FFFFFF', shadowColor: 'black', shadowOpacity: 0.2, glow: false, hasScrim: false }) },
  });
  const output = await slide.generateSingleSlide({ projectTitle: 'A home', images: [{ id: 'dining', url: 'https://fixture.test/room.png' }], expandedBlocks: blocks, slideIndex: 1 });
  const overlay = overlays.find(svg => svg.includes('Written by Folio'))!;
  assert.ok(overlay, 'Real single-slide compositor must render editorial credit');
  assert.ok(overlay.includes('font-style="normal"'));
  assert.ok(!overlay.includes('Unused interview quote') && !overlay.includes('&ldquo;') && !overlay.includes('>&quot;'));
  assert.equal((await sharp(output).metadata()).width, 1080);
  fs.mkdirSync('tmp', { recursive: true });
  fs.writeFileSync('tmp/social-room-teaser-check.jpg', output);

  let queried = false;
  const route = load('src/app/api/instagram/campaign/generate/route.ts', {
    'next/server': { NextResponse: { json: (body: unknown, init: any) => ({ body, status: init?.status ?? 200 }) } },
    'next-auth': { getServerSession: async () => ({ user: { id: 'intruder' } }) },
    '@/app/api/auth/[...nextauth]/options': { authOptions: {} },
    '@/lib/prisma': { prisma: { project: { findUnique: async () => { queried = true; throw new Error('Must not query'); } } } },
    '@/lib/authz/access': { assertProjectWrite: async () => { throw new Error('Forbidden'); } },
    '@/lib/instagram/campaign/selectCampaignContent': {},
    '@/lib/publishing-studio/data': {},
    '@/lib/instagram/campaign/generateReadyCampaign': {},
    'next/cache': {},
    '@/lib/instagram/campaign/generateLaunchCard': {},
    '@/lib/instagram/campaign/generateRoomSpotlight': {},
    '@/lib/instagram/campaign/generateCaptions': {}, jszip: {},
  });
  const denied = await route.POST({ json: async () => ({ projectId: 'someone-elses-project', preset: 'standard', formats: ['square'] }) });
  assert.equal(denied.status, 403);
  assert.equal(queried, false, 'Denied campaign writes stop before loading or generating content');
  console.log('PASS social room teaser selection, caption authorship, actual slide compositor, complete text and campaign authorization');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

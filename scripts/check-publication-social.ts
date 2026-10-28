import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
import { createCanvas } from '@napi-rs/canvas';
import { publicationPhotos, publicationRevision, publicationPhotoLayout, wrapPublicationText } from '../src/lib/instagram-export/publication-photo';
import { renderPublicationPhoto } from '../src/lib/instagram-export/render-publication-photo';

const images = [{ id: 'dining', url: 'https://photos.example/dining.jpg', room: 'Dining room', roomId: 'room-dining' }, { id: 'gallery', url: 'https://photos.example/gallery.jpg', room: 'Staircase' }];
const project = { id: 'project', ownerId: 'owner', title: 'La Gorce', city: 'Miami Beach', regionState: null, designerOrg: { name: 'BP Design' } };
const designer = { name: 'Diano Matto', studio: 'BP Design', companyName: null, title: null, profileImage: null };
const post = { status: 'PUBLISHED', expandedBlocks: { presentation: { version: 1, accent: null, roomOrder: [] }, galleryChapters: [
  { title: 'Dining room', roomId: 'room-dining', body: ['The room opens toward the garden.'], imageIds: ['dining'], pullQuote: { authorship: 'folio', selected: { text: 'Unused direct quote' }, folio: { selected: { text: 'The glass table keeps the room open to the garden.' }, alternatives: [] } } },
  { title: 'Staircase', body: [], imageIds: ['gallery'], pullQuote: 'Do not invent a story for this gallery.' },
] } };

const photos = publicationPhotos(project, post, images, designer);
assert.equal(photos[images[0].url].quote, 'The glass table keeps the room open to the garden.');
assert.equal(photos[images[0].url].attribution, null, 'Folio prose is not attributed as designer speech');
assert.equal(photos[images[0].url].accent, null, 'No photo color is selected by default');
assert.equal(photos[images[1].url].quote, null, 'Photo-only slides have no invented story label');
assert.equal(photos[images[0].url].firmName, 'BP Design');
const directPost = structuredClone(post) as any;
directPost.expandedBlocks.galleryChapters[0].pullQuote = { selected: { text: 'We wanted the garden to be part of every meal.' }, alternatives: [] };
directPost.expandedBlocks.presentation.accent = '#ABBBCD';
const direct = publicationPhotos(project, directPost, images, designer);
assert.equal(direct[images[0].url].attribution, 'BP Design');
assert.equal(direct[images[0].url].accent, '#ABBBCD');
assert.notEqual(publicationRevision(direct), publicationRevision(photos), 'A changed source invalidates an old preview');
const legacyPost = structuredClone(directPost);
legacyPost.expandedBlocks.galleryChapters[0].images = [{ id: 'dining', url: images[0].url }];
delete legacyPost.expandedBlocks.galleryChapters[0].imageIds;
delete legacyPost.expandedBlocks.galleryChapters[0].roomId;
assert.equal(publicationPhotos(project, legacyPost, images, designer)[images[0].url].quote, direct[images[0].url].quote, 'Legacy eligible inline photos retain their room story');
assert.equal(publicationPhotos({ ...project, designerOrg: { name: 'Current studio' } }, directPost, images, designer)[images[0].url].attribution, 'Current studio', 'Attribution matches the article organization priority');

function loadRoute(mocks: Record<string, unknown>, file = 'src/app/api/instagram-export/generate-images/route.ts') {
  const loadedModule = { exports: {} as any };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, require: (id: string) => {
    if (id in mocks) return mocks[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, console, Buffer, URL, process: { env: {} } }, { filename: file });
  return loadedModule.exports;
}

async function main() {
  const source = await sharp({ create: { width: 800, height: 1200, channels: 3, background: '#8c9c81' } }).png().toBuffer();
  fs.mkdirSync('tmp', { recursive: true });
  for (const height of [1080, 1350, 1920]) {
    const photo = { ...photos[images[0].url], quote: 'A carefully placed window carries soft light across the stone, while the oak gives this room a quiet rhythm. '.repeat(2).trim() };
    const rendered = await renderPublicationPhoto(source, photo, 1080, height);
    const metadata = await sharp(rendered).metadata();
    assert.equal(metadata.width, 1080); assert.equal(metadata.height, height);
    const context = createCanvas(1080, height).getContext('2d') as unknown as CanvasRenderingContext2D;
    const layout = publicationPhotoLayout(context, photo, 1080, height);
    assert.equal(layout.quote.join(' '), photo.quote, 'Export never truncates the selected words');
    assert.ok(layout.cardY >= height * .35, 'The label preserves substantial photograph space');
    assert.equal(layout.cardY + layout.cardHeight, height - 33, 'The label fits within the export');
    context.font = '40px sans-serif';
    assert.ok(wrapPublicationText(context, 'X'.repeat(120), 100).every(line => context.measureText(line).width <= 100));
    fs.writeFileSync(`tmp/publication-social-${height}.jpg`, rendered);
  }

  let projection: any;
  const approvedModels = loadRoute({
    'server-only': {},
    '@/lib/prisma': { prisma: { project: { findMany: async (query: any) => { projection = query; return [{ ...project, post, images, designer }]; } } } },
    './publication-photo': { publicationPhotos },
  }, 'src/lib/instagram-export/approved-photo-presentations.ts');
  const approvedPhotos = await approvedModels.approvedPhotoPresentations(['project']);
  assert.equal(projection.select.images.where.inclusion, 'INCLUDED');
  const approvedPhoto = approvedModels.approvedHeadlinePhoto(approvedPhotos.project[images[0].url], 'The exact approved story headline', 'Approved studio credit');
  assert.equal(approvedPhoto.quote, 'The exact approved story headline');
  assert.equal(approvedPhoto.attribution, null, 'A reviewed headline is still not a direct quotation');
  assert.equal(approvedPhoto.firmName, 'Approved studio credit');
  assert.throws(() => approvedModels.approvedHeadlinePhoto(undefined, 'Headline'), /source review/);
  const approvedRenderer = loadRoute({
    'server-only': {}, sharp,
    '@/lib/server/protected-project-photo': { readProtectedProjectPhoto: async () => ({ buffer: source }) },
    '@/lib/instagram-export/render-publication-photo': { renderPublicationPhoto },
  }, 'src/lib/publishing-studio/readiness/render-image.ts');
  const approvedOutput = await approvedRenderer.renderApprovedImage(images[0].url, 1080, 1350, 'project', approvedPhoto);
  assert.deepEqual(approvedOutput, await renderPublicationPhoto(source, approvedPhoto, 1080, 1350), 'Reviewed exports use the canonical photograph composition');
  const roomRenderer = loadRoute({
    sharp,
    '@/lib/server/project-image-input': { fetchProjectImage: async () => ({ buffer: source }) },
    '@/lib/server/protected-project-photo': { projectPhotoProcessingUrl: async (url: string, projectId: string) => { assert.equal(projectId, 'project'); return url; } },
    '@/lib/instagram-export/render-publication-photo': { renderPublicationPhoto },
  }, 'src/lib/instagram/campaign/generateRoomSpotlight.ts');
  const roomInput = { projectId: 'project', publicationPhotos: photos, projectSlug: 'la-gorce', imageUrls: Array(3).fill(images[0].url), format: 'story' };
  const roomOutput = await roomRenderer.generateRoomSpotlight(roomInput);
  assert.equal(roomOutput.length, 4, 'Campaign keeps its three photos and original CTA');
  assert.deepEqual(roomOutput[0], await renderPublicationPhoto(source, photos[images[0].url], 1080, 1920), 'Campaign room photos use the same quote, theme and composition');
  await assert.rejects(() => roomRenderer.generateRoomSpotlight({ ...roomInput, publicationPhotos: {} }), /source review/, 'Missing metadata cannot revive an obsolete layout');

  let user: string | null = 'owner'; let forbidden = false; let hasDesigner = true; let rendered: any = null; let saved: any = null;
  const route = loadRoute({
    crypto: { createHash: () => { throw new Error('No proposal fingerprint expected'); } },
    'next/server': { NextResponse: { json: (body: unknown, init?: any) => ({ body, status: init?.status ?? 200 }) } },
    'next-auth': { getServerSession: async () => user ? { user: { id: user } } : null },
    '@/app/api/auth/[...nextauth]/options': { authOptions: {} },
    '@/lib/prisma': { prisma: {
      project: { findUnique: async () => ({ ...project, designer: hasDesigner ? designer : null, post, images }) },
      user: { findUnique: async ({ where }: any) => { assert.equal(where.id, project.ownerId); return designer; } },
      instagramExport: { create: async ({ data }: any) => { saved = data; return { id: 'export' }; } },
    } },
    '@/lib/publishing-studio/data': { getStudioData: async () => { throw new Error('Not a studio proposal'); }, StudioAccessError: class extends Error {} },
    'next/cache': { revalidatePath() {} },
    '@/lib/authz/access': { assertProjectWrite: async () => { if (forbidden) throw new Error('Forbidden'); } },
    '@/lib/server/protected-project-photo': { projectPhotoProcessingUrl: async (url: string) => `https://processing.example/${url.split('/').pop()}` },
    '@/lib/instagram-export/generate-images': { generateAllSlides: async (config: any) => { rendered = config; return []; } },
    '@/lib/instagram-export/publication-photo': { publicationPhotos, publicationRevision },
  });
  const send = (config: any = {}, extras: any = {}) => route.POST({ json: async () => ({ projectId: 'project', config: { selectedImageUrls: [images[0].url], coverTextMode: 'room', ...config }, ...extras }) });
  user = null; assert.equal((await send()).status, 401);
  user = 'intruder'; forbidden = true; assert.equal((await send()).status, 403); assert.equal(rendered, null);
  user = 'owner'; forbidden = false;
  assert.equal((await send({ selectedImageUrls: ['https://attacker.example/photo'] })).status, 400);
  assert.equal((await send({ selectedImageUrls: [] })).status, 400);
  assert.equal((await send({ coverTextMode: 'headline', headline: '' })).status, 400);
  assert.equal((await send({ publicationRevision: 'stale' })).status, 409);
  assert.equal((await send({ publicationRevision: publicationRevision(photos), publicationPhotos: { arbitrary: { accent: '#FF0000', quote: 'Injected text' } } })).status, 200);
  assert.equal(rendered.publicationPhotos['https://processing.example/dining.jpg'].quote, photos[images[0].url].quote, 'Server selects saved article words');
  assert.equal(rendered.publicationPhotos['https://processing.example/dining.jpg'].accent, null, 'Client cannot force an unchosen theme');
  assert.equal(saved.config.publicationPhotos[images[0].url].quote, photos[images[0].url].quote);
  assert.ok(!JSON.stringify(saved.config).includes('processing.example'), 'Private processing URLs are never persisted');
  hasDesigner = false;
  assert.equal((await send({ publicationRevision: publicationRevision(photos) })).status, 200, 'Owner fallback identity matches server preview and export');
  console.log('PASS publication social source selection, attribution, neutral default, stale preview, authorization, owned images, private URLs, all raster sizes, canonical room campaigns and exact approved readiness headlines');
}
void main().catch(error => { console.error(error); process.exitCode = 1; });

/** Real settings handlers and public transport against synthetic boundaries; no DB/network/model. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { Prisma } from '@prisma/client';
import sharp from 'sharp';
import * as presentation from '../src/lib/story/presentation';
import * as schemas from '../src/lib/posting/schemas';
import { buildStoryData } from '../src/lib/story/buildRoomTiles';
import { publicPost } from '../src/lib/post/publicPost';

const imageId = '00000000-0000-4000-8000-000000000001';
const makePost = () => ({ id: 'post', projectId: 'project', slug: 'test-story', updatedAt: new Date(0),
  project: { id: 'project', title: 'Test House', images: [{ id: imageId, roomId: 'kitchen', url: '/kitchen.jpg' }] },
  expandedBlocks: { lead: { title: 'Test House' }, galleryChapters: [{ roomId: 'kitchen', title: 'Kitchen', imageIds: [imageId], body: ['Original prose.'] }] },
});
let post: any; let session: any; let forbidden = false; let conflict = false; let limited = false;
let write: any; let reads = 0; let paletteReads = 0; let invalidated: string[] = [];
let paletteBuffer: Buffer; let unavailable = false; let protectedReads: string[] = []; let remoteReads: string[] = [];
function reset() { post = makePost(); session = { user: { id: 'owner' } }; forbidden = false; conflict = false; limited = false; write = null; reads = 0; paletteReads = 0; invalidated = []; }
const mocks: Record<string, any> = {
  'next/server': { NextResponse: { json: (data: any, init?: any) => ({ data, status: init?.status ?? 200 }) } },
  'next/cache': { revalidatePath: (path: string) => invalidated.push(path) },
  'next-auth': { getServerSession: async () => session },
  '@/app/api/auth/[...nextauth]/options': { authOptions: {} },
  '@/lib/authz/access': { assertProjectWrite: async () => { if (forbidden) throw new Error('Forbidden'); } },
  '@/lib/rateLimit': { checkRateLimit: async () => ({ success: !limited }) },
  '@/lib/prisma': { prisma: { projectPost: {
    findUnique: async () => { reads++; return structuredClone(post); },
    updateMany: async (args: any) => { write = args; return { count: conflict ? 0 : 1 }; },
    update: async (args: any) => { write = args; if (conflict) throw { code: 'P2025' }; return { ...post, ...args.data }; },
  } } },
  '@/lib/story/presentation': presentation,
  '@/lib/story/buildRoomTiles': { buildStoryData },
  '@/lib/posting/schemas': schemas,
  '@prisma/client': { Prisma },
  '@/lib/server/publication-palette': { publicationPalette: async (projectId: string, urls: string[]) => {
    assert.equal(projectId, 'project'); assert.deepEqual(urls, ['/kitchen.jpg']); paletteReads++; return ['#715A44', '#7B8059'];
  } },
  sharp: { default: sharp },
  './protected-project-photo': { readProtectedProjectPhoto: async (url: string, projectId: string) => {
    assert.equal(projectId, 'project'); protectedReads.push(url);
    if (unavailable) throw new Error('Unavailable photo');
    return url.startsWith('/private/') ? { buffer: paletteBuffer } : null;
  } },
  './project-image-input': { fetchProjectImage: async (url: string) => { remoteReads.push(url); return { buffer: paletteBuffer }; } },
};
function load(path: string) {
  const source = readFileSync(path, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, any> = {};
  vm.runInNewContext(`(function(require, exports) { ${js}\n })`, { structuredClone, console, Error })(
    (id: string) => { assert.ok(id in mocks, `Unexpected dependency: ${id}`); return mocks[id]; }, exports,
  );
  return exports;
}
const route = load('src/app/api/posting/project/[projectId]/presentation/route.ts');
const blocks = load('src/app/api/posting/project/[projectId]/blocks/route.ts');
const paragraph = load('src/app/api/posting/project/[projectId]/sections/override/route.ts');
const actualPalette = load('src/lib/server/publication-palette.ts').publicationPalette;
const context = { params: { projectId: 'project' } };
const request = (body: unknown) => ({ json: async () => body });
const json = (value: any) => JSON.parse(JSON.stringify(value));
let passed = 0;
async function check(name: string, run: () => unknown) { reset(); await run(); passed++; console.log('PASS', name); }
async function main() {
  await check('real pixel extraction supports authorized private and remote photos, sampling at most eight', async () => {
    paletteBuffer = await sharp({ create: { width: 80, height: 60, channels: 3, background: '#715A44' } }).png().toBuffer();
    const urls = Array.from({ length: 21 }, (_, index) => index % 2 ? `https://example.com/${index}.png` : `/private/${index}.png`);
    const colors = await actualPalette('project', urls);
    assert.deepEqual(json(colors), ['#715A44']); assert.equal(protectedReads.length, 8);
    assert.equal(protectedReads[0], urls[0]); assert.equal(protectedReads[7], urls[20]);
    assert.ok(remoteReads.length > 0); assert.ok(remoteReads.every(url => url.startsWith('https://')));
    unavailable = true;
    assert.deepEqual(json(await actualPalette('project', ['/private/unavailable.png'])), []);
    unavailable = false;
  });
  await check('legacy, invalid and future settings remain neutral', () => {
    for (const value of [undefined, null, {}, { version: 2, accent: '#112233', roomOrder: [] }, { version: 1, accent: 'url(secret)', roomOrder: [] }]) {
      assert.deepEqual(presentation.readPresentation(value), { version: 1, accent: null, roomOrder: [] });
    }
  });
  await check('primary photo colors preserve actual colors and separate distinct options', () => {
    const colors = presentation.primaryPhotoColors([new Uint8Array([110, 70, 40, 110, 70, 40, 112, 72, 42, 30, 90, 130])]);
    assert.equal(colors.length, 2); assert.equal(colors[1], '#1E5A82');
    assert.deepEqual(presentation.primaryPhotoColors([]), []);
    assert.notEqual(presentation.presentationTokens('#FFFFFF').background, '#FFFFFF');
    assert.equal(presentation.presentationTokens(null).background, presentation.presentationTokens('invalid').background);
  });
  for (const handler of [route.GET, route.PATCH]) {
    await check('unauthenticated request cannot read photos or write', async () => {
      session = null; assert.equal((await handler(request({ accent: '#715A44' }), context)).status, 401);
      assert.equal(reads, 0); assert.equal(paletteReads, 0); assert.equal(write, null);
    });
    await check('unauthorized request cannot read photos or write', async () => {
      forbidden = true; assert.equal((await handler(request({ accent: '#715A44' }), context)).status, 403);
      assert.equal(reads, 0); assert.equal(paletteReads, 0); assert.equal(write, null);
    });
  }
  await check('loading suggestions never auto-selects the first color', async () => {
    const response = await route.GET(request(null), context);
    assert.equal(response.status, 200); assert.equal(response.data.presentation.accent, null);
    assert.equal(response.data.colors.length, 2); assert.equal(write, null);
  });
  await check('palette limits stop image processing', async () => {
    limited = true; assert.equal((await route.GET(request(null), context)).status, 429); assert.equal(paletteReads, 0);
  });
  await check('explicit color saves without changing prose and invalidates reader/social previews', async () => {
    const response = await route.PATCH(request({ accent: '#715a44' }), context);
    assert.equal(response.status, 200); assert.equal(response.data.presentation.accent, '#715A44');
    assert.deepEqual(json(write.data.expandedBlocks.galleryChapters), post.expandedBlocks.galleryChapters);
    assert.deepEqual(json(write.where.expandedBlocks.equals), post.expandedBlocks);
    assert.ok(invalidated.includes('/p/test-story')); assert.ok(invalidated.includes('/designer/projects/project/instagram'));
  });
  await check('neutral reset is persisted, never replaced with a photo color', async () => {
    post.expandedBlocks.presentation = { version: 1, accent: '#715A44', roomOrder: [] };
    assert.equal((await route.PATCH(request({ accent: null }), context)).status, 200);
    assert.equal(write.data.expandedBlocks.presentation.accent, null); assert.equal(paletteReads, 0);
  });
  await check('room order uses eligible canonical identities and preserves the chosen color', async () => {
    const key = buildStoryData(post)!.roomTiles[0].roomId;
    post.expandedBlocks.presentation = { version: 1, accent: '#715A44', roomOrder: [] };
    assert.equal((await route.PATCH(request({ roomOrder: [key] }), context)).status, 200);
    assert.equal(write.data.expandedBlocks.presentation.accent, '#715A44');
    assert.deepEqual(json(write.data.expandedBlocks.presentation.roomOrder), [key]);
  });
  for (const value of [{ accent: '#fff' }, { accent: 'red' }, { accent: 'url(secret)' }, { roomOrder: ['a', 'a'] }, {}, { colors: ['#FFFFFF'] }]) {
    await check('malformed presentation cannot mutate stored JSON', async () => {
      assert.equal((await route.PATCH(request(value), context)).status, 400); assert.equal(write, null);
    });
  }
  await check('foreign or removed rooms cannot be ordered', async () => {
    assert.equal((await route.PATCH(request({ roomOrder: ['another-project-room'] }), context)).status, 409); assert.equal(write, null);
  });
  await check('a simultaneous article change returns a conflict', async () => {
    conflict = true; assert.equal((await route.PATCH(request({ accent: '#715A44' }), context)).status, 409); assert.deepEqual(invalidated, []);
  });
  await check('public transport returns only the selected settings, never private metadata', () => {
    post.expandedBlocks.presentation = { version: 1, accent: '#715A44', roomOrder: [], sources: ['private-url'], provenance: { answer: 'private' } };
    assert.deepEqual(publicPost(post).expandedBlocks.presentation, { version: 1, accent: '#715A44', roomOrder: [] });
  });
  await check('whole-article save cannot restore stale presentation or clear it', async () => {
    post.expandedBlocks.presentation = { version: 1, accent: '#715A44', roomOrder: [] };
    const incoming = { ...post.expandedBlocks, presentation: { version: 1, accent: '#FF0000', roomOrder: [] } };
    const response = await blocks.PATCH(request(incoming), context);
    assert.equal(response.status, 200); assert.equal(write.data.expandedBlocks.presentation.accent, '#715A44');
    assert.equal(write.where.updatedAt.getTime(), 0);
  });
  await check('generation ignores model-supplied colors and preserves a freshly saved preference', () => {
    const generated = { presentation: { version: 1, accent: '#FF0000', roomOrder: [] }, introduction: ['New prose.'] };
    assert.equal(presentation.preservePresentation(generated, {}).presentation.accent, null);
    assert.equal(presentation.preservePresentation(generated, { presentation: { version: 1, accent: '#715A44', roomOrder: [] } }).presentation.accent, '#715A44');
  });
  await check('paragraph save refuses to overwrite a concurrently changed theme', async () => {
    conflict = true;
    const response = await paragraph.PATCH(request({ chapterIndex: 0, paragraphIndex: 0, field: 'body', editedBody: 'Changed prose.' }), context);
    assert.equal(response.status, 409); assert.equal(write.where.updatedAt.getTime(), 0);
  });
  console.log(`${passed} publication presentation checks passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });

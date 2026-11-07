// Real parser, routes and research validation; bounded AI/auth/storage doubles.
// Memory DB checks orchestration, not PostgreSQL transaction isolation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { File } = require('node:buffer');
const ExcelJS = require('exceljs');
const sharp = require('sharp');
let photoBytes, downloadedPaths = [], lastVision;
const { memoryDatabase } = require('./core/memory-db.cjs');
let db = memoryDatabase(), user = 'owner', aiCalls = 0, failSearch = false, failVisual = false, holdVisual = null;
const baseCreate = db.pendingProductTag.create;
const basePending = db.pendingProductTag;
db.pendingProductTag = new Proxy(basePending, { get: (target, key) => key === 'createMany' ? async ({ data }) => {
  for (const item of data) await baseCreate({ data: item }); return { count: data.length };
} : (...args) => target[key](...args.map(arg => structuredClone(arg))) });
const cache = new Map();
function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
    exports, console, process, Buffer, URL, Request, Response, Date, Set, Map, Object, JSON, Number, Error, setTimeout, clearTimeout,
    require(name) {
      if (name.startsWith('.')) name = '@/' + path.relative(path.resolve('src'), path.resolve(path.dirname(file), name));
      if (name === '@/lib/supabaseAdmin') return { supabaseAdmin: { storage: { from: () => ({ download: async objectPath => {
        downloadedPaths.push(objectPath); return { data: { size: photoBytes.length, type: 'image/png', arrayBuffer: async () => photoBytes } };
      } }) } } };
      if (name === '@/lib/prisma') return { prisma: db };
      if (name === 'next/server') return { NextResponse: Response };
      if (name === 'next-auth') return { getServerSession: async () => user ? { user: { id: user } } : null };
      if (name === '@/app/api/auth/[...nextauth]/options') return {};
      if (name === '@/lib/authz/access') return { assertProjectWrite: async (id, project) => { if (!['owner', 'editor'].includes(id) || project !== 'project') throw Error('Denied'); } };
      if (name === '@/lib/vision/recordLabelEvent') return { recordLabelEvent: async () => {} };
      if (name === '@/lib/server/safe-product-url') return { parseProductUrl: value => {
        const u = new URL(value); if (!['http:', 'https:'].includes(u.protocol) || u.hostname === 'localhost') throw Error('Unsafe'); return u;
      }, safeProductResource: async () => ({ status: 403, body: Buffer.from('Blocked') }) };
      if (name === '@/lib/import-agent/config') return { IMPORT_AGENT_CONFIG: { model: 'fixture' }, anthropic: { messages: { create: async input => {
        aiCalls++;
        if (input.tools) {
          if (failSearch) throw Error('Search unavailable');
          return { content: [{ type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://vendor.test/chair' }] }, { type: 'text', text: JSON.stringify({ productUrl: 'https://vendor.test/chair', productName: 'Cognac chair', brand: 'Fixture', exact: true, price: 500, currency: 'USD', widthIn: 24, dimensions: '24 in wide', sku: 'REAL-SKU', material: 'leather', confidence: 'high' }) }] };
        }
        lastVision = input;
        for (const block of input.messages[0].content.filter(b => b.type === 'image')) {
          if (block.source.type === 'url') assert.match(block.source.url, /^https?:\/\//, 'provider cannot fetch relative URLs');
          else { assert.equal(block.source.media_type, 'image/jpeg'); assert.equal((await sharp(Buffer.from(block.source.data, 'base64')).metadata()).format, 'jpeg'); }
        }
        if (holdVisual) await holdVisual;
        if (failVisual) throw Error('Vision unavailable');
        return { content: [{ type: 'text', text: JSON.stringify({ matches: [
          { imageId: 'living', x: .25, y: .7, confidence: 'high', reason: 'Cognac leather chair' },
          { imageId: 'wrong-room', x: .5, y: .5, confidence: 'high' },
          { imageId: 'living', x: 2, y: .4, confidence: 'high' },
        ] }) }] };
      } } } };
      if (name.startsWith('@/')) {
        const base = path.resolve('src', name.slice(2));
        return load(fs.existsSync(base + '.ts') ? base + '.ts' : base + '.tsx');
      }
      return require(name);
    },
  }, { filename: file });
  return exports;
}
const upload = load('src/app/api/import/finish-schedule/route.ts').POST;
const research = load('src/app/api/import/pending-tag/[tagId]/research/route.ts').POST;
const placeModule = load('src/app/api/import/pending-tag/[tagId]/place/route.ts');
const place = placeModule.POST;
const dismiss = load('src/app/api/import/pending-tag/[tagId]/verify/route.ts').POST;
const parse = load('src/lib/import-agent/parseFinishSchedule.ts').parseFinishSchedule;
const logic = load('src/lib/import-agent/researchFinishSchedule.ts');
const reviewLogic = load('src/lib/import-agent/finishScheduleReview.ts');
const body = data => new Request('https://folio.test/api', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
const params = id => ({ params: Promise.resolve({ tagId: id }) });
const uploadReq = file => ({ formData: async () => ({ get: key => key === 'file' ? file : 'project' }) });
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log('PASS', name); }
(async () => {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Schedule');
  ws.addRow(['Item ID', 'Room', 'Photo in room', 'Category', 'Brand / supplier', 'Product / collection', 'Color / finish', 'Material', 'Object to match in photo']);
  ws.addRow(['LR-01', 'Living Room', '1 and 2', 'FURNITURE', 'Fixture', 'Cognac chair', 'Cognac', 'Leather', 'Brown leather sling chair']);
  ws.addRow([]); ws.addRow(['Notes']); ws.addRow(['These are test substitutes.']);
  const bytes = Buffer.from(await wb.xlsx.writeBuffer());
  const file = new File([bytes], 'finish.xlsx');
  let row;
  await check('Workbook maps product names, independent item codes and visual hints; skips notes', async () => {
    [row] = await parse(bytes, 'finish.xlsx');
    assert.equal((await parse(bytes, 'finish.xlsx')).length, 1);
    assert.equal(row.name, 'Cognac chair'); assert.equal(row.itemId, 'LR-01'); assert.equal(row.sku, null);
    assert.equal(row.photoHint, '1 and 2'); assert.equal(row.matchDescription, 'Brown leather sling chair');
  });
  await check('Prefixed SpreadsheetML exporter remains supported in CI', async () => {
    const zip = await require('jszip').loadAsync(bytes);
    for (const entry of Object.values(zip.files)) {
      if (!entry.name.endsWith('.xml')) continue;
      let xml = await entry.async('string');
      if (!xml.includes('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')) continue;
      xml = xml.replace('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', 'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"');
      xml = xml.replace(/<(\/?)([A-Za-z][\w-]*)(?=[\s/>])/g, '<$1x:$2');
      zip.file(entry.name, xml);
    }
    const rows = await parse(await zip.generateAsync({ type: 'nodebuffer' }), 'prefixed.xlsx');
    assert.equal(rows.length, 1); assert.equal(rows[0].name, 'Cognac chair');
  });
  await check('Compressed workbook expansion is bounded', async () => {
    const zip = await require('jszip').loadAsync(bytes);
    zip.file('xl/oversized.xml', 'x'.repeat(31 * 1024 * 1024));
    await assert.rejects(() => zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }).then(b => parse(b, 'oversized.xlsx')), /too large/);
  });
  if (process.argv[2]) await check('Actual URL-free IG WORKSHOP workbook: 12 usable rows', async () => {
    const rows = await parse(fs.readFileSync(process.argv[2]), 'workbook.xlsx');
    assert.equal(rows.length, 12); assert.ok(rows.every(r => r.name !== r.itemId && r.room && !r.url));
    assert.equal(rows[0].itemId, 'PB-01'); assert.match(rows[0].name, /Genevieve/i);
  });
  await check('CSV and sparse XLSX preserve header positions', async () => {
    const csv = await parse(Buffer.from('Item ID,Room,Product,Brand\nA1,Kitchen,Tap,Fixture'), 'x.csv');
    assert.equal(csv[0].name, 'Tap');
    await assert.rejects(() => parse(bytes, 'legacy.xls'), /Legacy/);
  });
  await check('Private photo bytes reach vision as bounded JPEG, never as a browser URL', async () => {
    photoBytes = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#a06030' } }).png().toBuffer();
    const project = '11111111-1111-4111-8111-111111111111';
    const url = `/api/project-photos/${project}/default/generated/test.png`;
    const photo = { id: 'private', projectId: project, url, room: 'Living Room', inclusion: 'INCLUDED', name: null };
    await db.projectImage.create({ data: photo });
    await logic.matchScheduleRow(row, [photo], project);
    const source = lastVision.messages[0].content.find(b => b.type === 'image').source;
    assert.equal(source.type, 'base64'); assert.ok(!JSON.stringify(lastVision).includes('/api/project-photos/'));
    const meta = await sharp(Buffer.from(source.data, 'base64')).metadata();
    assert.equal(meta.width, 1568); assert.equal(meta.height, 784);
    const calls = aiCalls, downloads = downloadedPaths.length;
    await assert.rejects(() => logic.matchScheduleRow(row, [photo], 'other'), /authorized project/);
    await assert.rejects(() => logic.matchScheduleRow(row, [{ ...photo, url: url.replace('test.png', 'missing.png') }], project), /authorized project/);
    assert.equal(aiCalls, calls); assert.equal(downloadedPaths.length, downloads);
    photoBytes = Buffer.from('invalid image');
    await assert.rejects(() => logic.matchScheduleRow(row, [photo], project));
    assert.equal(aiCalls, calls, 'invalid bytes must fail before provider invocation');
    await db.projectImage.deleteMany({ where: { id: 'private' } });
  });
  await db.projectImage.create({ data: { id: 'living', projectId: 'project', url: 'https://photo.test/living.jpg', room: 'Living Room' } });
  await db.projectImage.create({ data: { id: 'wrong-room', projectId: 'other', url: 'https://photo.test/bed.jpg', room: 'Bedroom' } });
  await check('Unauthorized/foreign imports blocked before staging', async () => {
    user = null; assert.equal((await upload(uploadReq(file))).status, 401);
    user = 'stranger'; assert.equal((await upload(uploadReq(file))).status, 403);
    assert.equal(await db.importSession.count(), 0); user = 'editor';
  });
  let tag;
  await check('Org editor can upload without Supabase storage; source rows persist', async () => {
    const response = await upload(uploadReq(file)); assert.equal(response.status, 201);
    tag = await db.pendingProductTag.findFirst({}); assert.equal(tag.topSuggestion.finishSchedule.state, 'queued');
  });
  await check('Invalid/oversized files never leave processing sessions', async () => {
    assert.equal((await upload(uploadReq({ size: 20_000_000 }))).status, 413);
    assert.equal((await upload(uploadReq(new File(['junk'], 'x.xls')))).status, 422);
    assert.equal(await db.importSession.count(), 1);
  });
  await check('Matching scopes photos, rejects foreign IDs, duplicate/invalid pins', async () => {
    const photos = await db.projectImage.findMany({});
    assert.equal(logic.candidatePhotos(row, photos).length, 1);
    const response = await research(body({}), params(tag.id)); assert.equal(response.status, 200);
    const result = (await response.json()).review;
    assert.equal(result.matches.length, 1); assert.equal(result.matches[0].x, .25); assert.equal(result.research.priceCents, 50000);
    assert.equal(await db.productTag.count(), 0, 'research must not confirm tags');
    assert.equal((await db.pendingProductTag.findUnique({ where: { id: tag.id } })).extractedPrice, null, 'schedule source remains unchanged');
  });
  await check('Fabricated source, unsafe URLs, invalid prices and low-confidence pins rejected', async () => {
    assert.equal(logic.validateResearch({ productUrl: 'https://invented.test', productName: 'x' }, new Set()), null);
    assert.equal(logic.validateResearch({ productUrl: 'javascript:alert(1)', productName: 'x' }, new Set()), null);
    assert.equal(logic.validateResearch({ productUrl: 'https://vendor.test/chair', productName: 'x', price: -9, currency: 'USD' }, new Set(['https://vendor.test/chair'])).priceCents, null);
    assert.equal(logic.validateMatches([{ imageId: 'living', x: .2, y: .3, confidence: 'low' }], [{ id: 'living' }]).length, 0);
  });
  await check('Search failure preserves visual matches and supports explicit retry', async () => {
    failSearch = true; const result = await research(body({ retry: true }), params(tag.id));
    assert.equal((await result.json()).review.state, 'failed');
    failSearch = false; assert.equal((await (await research(body({ retry: true }), params(tag.id))).json()).review.state, 'done');
  });
  await check('Lease excludes duplicate work, stale leases recover, ready rows do not rerun automatically', async () => {
    const before = aiCalls; await research(body({}), params(tag.id)); assert.equal(aiCalls, before);
    let release; holdVisual = new Promise(r => { release = r; });
    const first = research(body({ retry: true }), params(tag.id));
    await new Promise(r => setTimeout(r, 10)); const during = aiCalls;
    await research(body({ retry: true }), params(tag.id)); assert.equal(aiCalls, during);
    release(); holdVisual = null; await first;
    assert.equal(reviewLogic.scheduleCanRun({ state: 'processing', startedAt: Date.now() }), false);
    assert.equal(reviewLogic.scheduleCanRun({ state: 'processing', startedAt: Date.now() - 190000 }), true);
  });
  await check('Cross-project placement and invalid coordinates cannot create products', async () => {
    assert.equal((await place(body({ imageId: 'wrong-room', x: 10, y: 10 }), params(tag.id))).status, 400);
    assert.equal((await place(body({ imageId: 'living', x: 101, y: 10 }), params(tag.id))).status, 400);
    user = 'stranger'; assert.equal((await place(body({ imageId: 'living', x: 25, y: 70 }), params(tag.id))).status, 403); user = 'editor';
    assert.equal(await db.product.count(), 0);
  });
  await check('Confirm stores percent coordinates, source-backed form fields and no asserted finish; retry is idempotent', async () => {
    const request = () => place(body({ placements: [{ imageId: 'living', x: 25, y: 70 }] }), params(tag.id));
    assert.equal((await request()).status, 200); assert.equal((await request()).status, 200);
    assert.equal(await db.productTag.count(), 1); assert.equal(await db.product.count(), 1);
    const placed = await db.productTag.findFirst({}); assert.equal(placed.x, 25); assert.equal(placed.aiX, 25); assert.equal(placed.finishRaw, null);
    assert.equal((await db.cachedProduct.findFirst({})).sku, 'REAL-SKU');
    assert.equal((await db.product.findFirst({})).price, 500);
    assert.equal((await db.importSession.findFirst({})).verifiedTags, 1);
  });
  await check('Generic verifier cannot accidentally confirm schedule metadata; org editors can dismiss', async () => {
    await upload(uploadReq(file)); const next = await db.pendingProductTag.findFirst({ where: { status: 'UNREVIEWED' } });
    assert.equal((await dismiss(body({ action: 'confirm' }), params(next.id))).status, 400);
    assert.equal((await dismiss(body({ action: 'dismiss' }), params(next.id))).status, 200);
  });
  console.log(`${passed} finish-schedule checks passed. Provider/auth boundaries synthetic; no production writes.`);
})().catch(e => { console.error(e); process.exitCode = 1; });

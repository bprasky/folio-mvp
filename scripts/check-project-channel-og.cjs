// Render the actual social-image handler through Satori/Resvg, with only Prisma
// replaced. No database, external image requests, publication or deployment.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const sharp = require('sharp');

(async () => {
  const { ImageResponse } = await import('@vercel/og');
  const photo = async background => 'data:image/png;base64,' + (await sharp({ create: { width: 1200, height: 630, channels: 3, background } }).png().toBuffer()).toString('base64');
  const first = await photo('#d44b42'), selected = await photo('#285bb5');
  const prisma = { projectPost: { findFirst: async query => {
    assert.deepEqual(query.where, { slug: 'fixture', status: 'PUBLISHED', project: { isPublic: true } });
    assert.deepEqual(query.select.project.select.images.where, { inclusion: 'INCLUDED' });
    return { heroAssetId: 'selected', project: { title: 'The original project', designer: null,
      images: [{ id: 'first', url: first }, { id: 'selected', url: selected }] } };
  } } };
  const file = path.join(__dirname, '../src/app/api/og/project/[slug]/route.tsx');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name === '@/lib/prisma' ? { prisma } : name === '@vercel/og' ? { ImageResponse } : require(name), module, module.exports);
  const response = await module.exports.GET({}, { params: { slug: 'fixture' } });
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const bytes = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, 'png'); assert.equal(metadata.width, 1200); assert.equal(metadata.height, 630);
  const pixel = await sharp(bytes).extract({ left: 600, top: 50, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  assert.ok(pixel[2] > pixel[0] * 2, 'Selected blue hero, not the first red photograph');
  const out = path.join(__dirname, '../.tmp/channel-browser'); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'social-image.png'), bytes);
  console.log('PASS actual 1200×630 social raster, selected approved hero, missing-designer fallback and no-store');
})().catch(error => { console.error(error); process.exitCode = 1; });

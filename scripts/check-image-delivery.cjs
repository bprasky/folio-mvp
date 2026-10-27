// Real production-mode Next/Image and optimizer; synthetic bytes, no credentials.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });
const fixture = fs.mkdtempSync(path.join(root, '.tmp', 'image-delivery-'));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=', 'base64');
const photo = '/api/project-photos/00000000-0000-4000-8000-000000000001/photo.png';
const next = require.resolve('next/dist/bin/next');
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'production' };
let server;
function write(name, content) {
  const file = path.join(fixture, name);
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content);
}
function copy(name) { write(name, fs.readFileSync(path.join(root, name))); }
function stop(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
  else child.kill('SIGTERM');
}
async function command(args) {
  const out = fs.openSync(path.join(fixture, 'build.log'), 'w');
  const child = spawn(process.execPath, [next, ...args], { cwd: fixture, env, stdio: ['ignore', out, out] });
  try { await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { stop(child); reject(new Error('Fixture build timed out')); }, 180000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Fixture build failed (${code}); see ${fixture}/build.log`)); });
  }); } finally { fs.closeSync(out); }
}
async function freePort() {
  return new Promise(resolve => { const listener = net.createServer(); listener.listen(0, '127.0.0.1', () => { const port = listener.address().port; listener.close(() => resolve(port)); }); });
}
async function main() {
  const images = require(path.join(root, 'next.config.js')).images;
  assert.ok(!images.loader || images.loader === 'default', 'Vercel optimizer must remain enabled');
  assert.ok(!images.loaderFile, 'global loaderFile disables hosted optimization');
  assert.equal(images.unoptimized, undefined);
  function checkImports(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) checkImports(file);
      else if (/\.tsx?$/.test(file) && !file.endsWith('FolioImage.tsx')) {
        assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /from\s+['"]next\/image['"]/, `Use the access-aware wrapper in ${file}`);
      }
    }
  }
  checkImports(path.join(root, 'src'));
  write('package.json', JSON.stringify({ private: true, dependencies: { next: '14.2.33', react: '18.3.1', 'react-dom': '18.3.1' } }));
  write('next.config.js', `module.exports = ${JSON.stringify({ images, experimental: { cpus: 1 }, typescript: { ignoreBuildErrors: true }, eslint: { ignoreDuringBuilds: true } })};`);
  write('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'es2020', jsx: 'preserve', module: 'esnext', moduleResolution: 'bundler', esModuleInterop: true, baseUrl: '.', paths: { '@/*': ['./src/*'] } } }));
  copy('src/components/FolioImage.tsx'); copy('src/lib/files/projectPhotoUrl.ts');
  write('public/pixel.png', png);
  write('src/app/layout.tsx', `export default function Layout({children}) {return <html><body>{children}</body></html>}`);
  write('src/app/page.tsx', `import Image from '@/components/FolioImage'; export default function Page(){return <><Image id="public" src="/pixel.png" width={24} height={24} alt="Public fixture"/><Image id="protected" src=${JSON.stringify(photo)} width={24} height={24} alt="Private fixture"/><Image id="absolute" src=${JSON.stringify('https://folio.test' + photo)} width={24} height={24} alt="Absolute private fixture"/><Image id="explicit" src="/pixel.png" unoptimized width={24} height={24} alt="Explicit bypass"/></>}`);
  write('src/app/api/project-photos/[...object]/route.ts', `export const dynamic='force-dynamic'; export async function GET(request:Request) {const allowed=request.headers.get('cookie')==='fixture-access=owner';return new Response(allowed?Buffer.from('${png.toString('base64')}','base64'):null,{status:allowed?200:404,headers:{'Content-Type':'image/png','Cache-Control':'private, no-store'}});}`);
  await command(['build']);
  const manifest = JSON.parse(fs.readFileSync(path.join(fixture, '.next/images-manifest.json')));
  assert.equal(manifest.images.loader, 'default');
  assert.ok(manifest.images.localPatterns.length, 'hosted build must carry the local optimizer allowlist');
  assert.ok(!manifest.images.localPatterns.some(p => new RegExp(p.pathname).test(photo)));
  const port = await freePort(); const origin = `http://127.0.0.1:${port}`;
  const out = fs.openSync(path.join(fixture, 'server.log'), 'w');
  server = spawn(process.execPath, [next, 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: fixture, env, stdio: ['ignore', out, out] });
  fs.closeSync(out);
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(1000) })).status === 200) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'production-mode fixture must start');
  const html = await (await fetch(origin)).text();
  const image = id => html.match(new RegExp(`<img[^>]*id="${id}"[^>]*>`))?.[0];
  assert.match(image('public'), /srcSet="\/_next\/image\?/);
  assert.match(image('protected'), new RegExp(`src="${photo}"`));
  assert.doesNotMatch(image('protected'), /srcSet|_next\/image/);
  assert.doesNotMatch(image('absolute'), /srcSet|_next\/image/);
  assert.match(image('explicit'), /src="\/pixel.png"/);
  console.log('PASS real Image rendering: ordinary optimization, relative/absolute protected bypass and explicit bypass');
  const ordinary = await fetch(origin + '/_next/image?url=%2Fpixel.png&w=32&q=75');
  assert.equal(ordinary.status, 200); assert.match(ordinary.headers.get('content-type'), /^image\//);
  assert.ok((await ordinary.arrayBuffer()).byteLength > 0);
  console.log('PASS ordinary optimizer returns image bytes');
  const allowed = await fetch(origin + photo, { headers: { cookie: 'fixture-access=owner' } });
  assert.equal(allowed.status, 200); assert.deepEqual(Buffer.from(await allowed.arrayBuffer()), png);
  assert.match(allowed.headers.get('cache-control'), /no-store/);
  const denied = await fetch(origin + photo); assert.equal(denied.status, 404);
  console.log('PASS protected source requires access and sends no-store');
  for (const source of [photo, origin + photo, photo.replace('/api/', '/%61pi/'), '/assets/../' + photo.slice(1)]) for (const cookie of ['', 'fixture-access=owner']) {
    const response = await fetch(origin + '/_next/image?url=' + encodeURIComponent(source) + '&w=32&q=75', { headers: { cookie } });
    assert.equal(response.status, 400, `Optimizer must reject ${source}, with access=${!!cookie}`);
    assert.match(await response.text(), /not allowed/);
  }
  console.log('PASS optimizer allowlist rejects protected, absolute, encoded and traversing sources with and without access cookies');
  console.log(`Image delivery checks passed; evidence: ${fixture}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => stop(server));

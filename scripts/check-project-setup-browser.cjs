// Actual NewProjectWizard and ProjectGuideUploads in Chromium.
// Synthetic HTTP/navigation boundaries; no credentials, database, provider or new runner.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.tmp/project-setup-browser');
const review = path.resolve(process.env.PROJECT_SETUP_REVIEW_DIR || path.join(out, 'review'));
const results = [];
let uploaded = [], requests = [], failedNames = new Set(), holdUpload = false, releaseUpload = null;
const navigation = `
import React,{useSyncExternalStore}from'react';
const subscribe=fn=>{window.addEventListener('nav',fn);return()=>window.removeEventListener('nav',fn)};
window.navigations=[];window.fixtureRefreshes=0;window.fixtureInterviewMounts=0;
const navigate=(method,url)=>{window.navigations.push({method,url});history.replaceState({},'',url);window.dispatchEvent(new Event('nav'))};
const router={push:url=>navigate('push',url),replace:url=>navigate('replace',url),refresh:()=>window.fixtureRefreshes++};
export const useRouter=()=>router;
export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search));
export default function Link({href,children,...props}){return <a {...props} href={href}>{children}</a>}
`;
const entry = `
import React from 'react';import{createRoot}from'react-dom/client';import{useSearchParams}from'next/navigation';
import Wizard from './src/app/project/[id]/NewProjectWizard';
function App(){const search=useSearchParams();return search.get('step')==='rooms'?<main>Existing room sorting workspace</main>:<Wizard project={{id:'project',title:'Coconut Grove New Construction'}} canScrape={search.get('scrape')!=='0'}/>}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
`;
async function build() {
  fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(review, { recursive: true });
  await esbuild.build({
    stdin: { contents: entry, loader: 'tsx', resolveDir: root }, bundle: true, platform: 'browser',
    jsx: 'automatic', outfile: path.join(out, 'app.js'), alias: { '@': path.join(root, 'src') },
    define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' },
    plugins: [{ name: 'fixture', setup(build) {
      if (process.env.PROJECT_SETUP_SOURCE_REF) build.onLoad({ filter: /NewProjectWizard\.tsx$/ }, args => ({
        contents: execFileSync('git', ['show', process.env.PROJECT_SETUP_SOURCE_REF + ':' + path.relative(root, args.path).replaceAll('\\', '/')], { cwd: root, encoding: 'utf8' }),
        loader: 'tsx', resolveDir: path.dirname(args.path),
      }));
      build.onResolve({ filter: /^(next\/(navigation|link)|@\/components\/(posting\/interview\/InterviewModal|interviews\/ProjectConversationHost))$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
        loader: 'jsx', resolveDir: root, contents: args.path.startsWith('next/') ? navigation :
          'export const useProjectConversation=()=>null;export const InterviewModal=()=>{window.fixtureInterviewMounts++;return null};',
      }));
    } }],
  });
  const content = ['src/app/project/[id]/NewProjectWizard.tsx', 'src/components/interviews/ProjectGuideUploads.tsx'].map(file => ({ raw: fs.readFileSync(path.join(root, file), 'utf8'), extension: 'tsx' }));
  const config = { ...require(path.join(root, 'tailwind.config.js')), content };
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  fs.writeFileSync(path.join(out, 'app.css'), (await postcss([tailwind(config)]).process(css, { from: path.join(root, 'src/app/globals.css') })).css + '\n:root{--font-headline:Georgia;--font-body:Arial}');
  for (const file of ['first.png', 'second.png']) fs.writeFileSync(path.join(out, file), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0hUAAAAASUVORK5CYII=', 'base64'));
}
function handler(req, res) {
  const route = new URL(req.url, 'http://local').pathname;
  const json = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  if (route === '/app.js' || route === '/app.css') { res.setHeader('Content-Type', route.endsWith('.js') ? 'text/javascript' : 'text/css'); return fs.createReadStream(path.join(out, route.slice(1))).pipe(res); }
  if (route === '/photo.svg') {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700"><rect width="1000" height="700" fill="#ded8cc"/><rect x="100" y="70" width="800" height="390" fill="#8c9c90"/><path d="M0 550H1000V700H0Z" fill="#968879"/><text x="100" y="620" font-size="38" fill="#fff">Synthetic project photograph</text></svg>');
  }
  if (!route.startsWith('/api/')) { res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>'); }
  if (req.method === 'GET' && route === '/api/import/import-session') return json({ status: 'READY_FOR_REVIEW', processingMeta: { candidates: [{ url: 'http://' + req.headers.host + '/photo.svg?one', alt: 'First room' }, { url: 'http://' + req.headers.host + '/photo.svg?two', alt: 'Second room' }] } });
  let body = ''; req.on('data', part => { body += part; });
  req.on('end', () => {
    const data = JSON.parse(body || '{}'); requests.push({ route, method: req.method, data });
    if (route === '/api/import/website') return json({ sessionId: 'import-session' });
    if (route === '/api/import/import-session') return json({ ok: true });
    if (route === '/api/projects/project/images') {
      if (failedNames.delete(data.name)) return json({ message: 'Synthetic photograph upload failed.' }, 503);
      const image = { id: 'photo-' + uploaded.length, url: '/photo.svg', name: data.name };
      const reply = () => { uploaded.push(image); json({ image }, 201); };
      if (holdUpload) { releaseUpload = reply; return; } return reply();
    }
    return json({ message: 'Unexpected fixture route: ' + route }, 404);
  });
}
async function main() {
  await build(); const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const executablePath = process.env.GUIDED_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(fs.existsSync);
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage(); page.setDefaultTimeout(7000); await page.setViewport({ width: 1440, height: 1100 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true); page.on('request', request => request.url().startsWith(base) || request.url().startsWith('data:') ? request.continue() : request.abort());
  const text = value => page.waitForFunction(value => document.body.innerText.includes(value), {}, value);
  const click = async label => {
    await page.waitForFunction(label => [...document.querySelectorAll('button')].some(node => node.textContent.trim() === label && !node.disabled), {}, label);
    for (const item of await page.$$('button')) if ((await item.evaluate(node => node.textContent.trim())) === label) { await item.click(); return; }
    throw Error('Button not found: ' + label);
  };
  const open = async (extra = '') => {
    uploaded = []; requests = []; failedNames = new Set(); holdUpload = false; releaseUpload = null;
    await page.goto(base + '/project/project?view=media&action=upload&expertiseTopic=Historic%20renovation&expertiseProjects=existing' + extra);
    await page.waitForSelector('input[type=file][accept="image/*"]');
  };
  const upload = async (files = ['first.png']) => (await page.$('input[type=file][accept="image/*"]')).uploadFile(...files.map(file => path.join(out, file)));
  const importPhotos = async () => {
    await page.type('input[aria-label="Project or portfolio link"]', 'https://designer.example/project');
    await click('Find photos'); await text('Choose the photographs to add.');
  };
  const assertRooms = async () => {
    await text('Existing room sorting workspace');
    const state = await page.evaluate(() => ({ query: Object.fromEntries(new URLSearchParams(location.search)), navigations: window.navigations, refreshes: window.fixtureRefreshes, interviews: window.fixtureInterviewMounts }));
    assert.equal(state.query.view, 'media'); assert.equal(state.query.step, 'rooms'); assert.equal(state.query.action, 'sort-rooms');
    assert.equal(state.query.expertiseTopic, 'Historic renovation'); assert.equal(state.query.expertiseProjects, 'existing');
    assert.equal(state.navigations.length, 1); assert.equal(state.navigations[0].method, 'replace'); assert.equal(state.refreshes, 1); assert.equal(state.interviews, 0);
    assert.equal(requests.some(request => /live-interviews|import-spec|finalize|detect-rooms/.test(request.route)), false);
    assert.equal(await page.evaluate(() => document.body.innerText.includes('Your project is set up')), false);
  };
  const check = async (id, name, run) => {
    if (process.env.PROJECT_SETUP_CHECK && process.env.PROJECT_SETUP_CHECK !== id) return;
    try { await run(); results.push({ id, name }); console.log('PASS ' + name); }
    catch (error) { await page.screenshot({ path: path.join(review, id + '-failure.png'), fullPage: true }); throw error; }
  };
  try {
    await check('upload', 'an existing empty project uploads directly into canonical room sorting without intermediate setup pages', async () => {
      await open();
      for (const width of [1440, 390, 320]) {
        await page.setViewport({ width, height: width === 1440 ? 1100 : 844 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow at ' + width);
        await page.screenshot({ path: path.join(review, 'upload-' + width + '.png'), fullPage: true });
      }
      await upload(); await assertRooms(); assert.equal(uploaded.length, 1);
      await page.setViewport({ width: 1440, height: 1100 });
    });
    await check('pending', 'an in-flight upload stays in place with disabled upload controls until its save is acknowledged', async () => {
      await open(); holdUpload = true; await upload(); await text('Adding your project photographs');
      await page.waitForFunction(() => document.querySelector('input[type=file]').disabled);
      assert.equal(await page.evaluate(() => window.navigations.length), 0);
      const deadline = Date.now() + 2000; while (!releaseUpload && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(typeof releaseUpload, 'function'); releaseUpload(); await assertRooms();
    });
    await check('partial-retry', 'partial upload retains failed files and retries only those files before advancing', async () => {
      await open(); failedNames.add('second.png'); await upload(['first.png', 'second.png']); await text('Retry failed photos');
      assert.equal(await page.evaluate(() => window.navigations.length), 0); assert.equal(uploaded.length, 1);
      await page.screenshot({ path: path.join(review, 'partial-upload-recovery.png'), fullPage: true });
      await click('Retry failed photos'); await assertRooms(); assert.equal(uploaded.length, 2);
      assert.deepEqual(requests.filter(request => request.route.endsWith('/images')).map(request => request.data.name), ['first.png', 'second.png', 'second.png']);
    });
    await check('partial-continue', 'partial upload advances only when the designer chooses Continue with saved photos', async () => {
      await open(); failedNames.add('second.png'); await upload(['first.png', 'second.png']); await text('Retry failed photos');
      assert.equal(await page.evaluate(() => window.navigations.length), 0); await click('Continue with saved photos'); await assertRooms(); assert.equal(uploaded.length, 1);
    });
    await check('url', 'website import saves only selected photographs then opens canonical room sorting', async () => {
      await open(); await importPhotos(); await page.click('input[aria-label="Select Second room"]'); await click('Add selected photos'); await assertRooms();
      assert.deepEqual(uploaded.map(image => image.name), ['First room']);
      assert.equal(requests.filter(request => request.method === 'PATCH' && request.route === '/api/import/import-session').length, 1);
    });
    await check('url-retry', 'partially failed import keeps only the failed selection for retry and preserves saved photos', async () => {
      await open(); await importPhotos(); failedNames.add('Second room'); await click('Add selected photos'); await text('Some photos could not be added');
      assert.equal(await page.evaluate(() => window.navigations.length), 0); assert.equal(uploaded.length, 1);
      assert.equal(await page.$$eval('input[type=checkbox]', nodes => nodes.length), 1);
      await click('Add selected photos'); await assertRooms(); assert.equal(uploaded.length, 2);
      assert.deepEqual(requests.filter(request => request.route.endsWith('/images')).map(request => request.data.name), ['First room', 'Second room', 'Second room']);
    });
    await check('permission', 'website import capability does not block local photo upload', async () => {
      await open('&scrape=0'); assert.equal(await page.$('input[aria-label="Project or portfolio link"]'), null); await text('Website import is available with Pro');
      await upload(); await assertRooms();
    });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(review, 'browser-results.json'), JSON.stringify({ boundary: 'Actual upload components; synthetic HTTP/navigation. Canonical room assignment is outside this fixture.', sourceRef: process.env.PROJECT_SETUP_SOURCE_REF || 'working tree', results }, null, 2));
    console.log('PASS ' + results.length + ' project setup browser checks.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

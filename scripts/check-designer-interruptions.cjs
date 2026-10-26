// Actual intake/upload components and publish hook; loopback HTTP with synthetic services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.tmp/designer-interruptions');
fs.mkdirSync(out, { recursive: true });
let createLost = true, imageFailed = true, publishFailed = true, published = false;
let holdUpload = false, releaseUpload = null;
let holdDraft = false, releaseDraft = null, draftTitle = 'Fixture';
let tagAttempts = 0;
let creates = 0, uploadCalls = 0, publishCalls = 0;
const projects = new Map(), images = new Map();
const entry = `import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{CreateProjectGuide}from'./src/components/interviews/CreateProjectGuide';
import{usePublishFlow}from'./src/hooks/usePublishFlow';
import Tagging from './src/app/project/[id]/TaggingSection';import{Toaster}from'react-hot-toast';
window.tagRefreshes=0;
function Tags(){return <><Toaster/><Tagging projectId="fixture-project" isOwner images={[{id:'photo',url:'/photo.svg',roomId:'room',tags:[{id:'tag',x:20,y:30,product:{id:'product',name:'Fixture chair',scrapeStatus:'pending'}}]}]} rooms={[{id:'room',name:'Living room'}]} onChanged={()=>{window.tagRefreshes++}}/></>}
function Publish(){const flow=usePublishFlow('fixture-project');window.publishTwice=()=>{flow.publish();flow.publish()};window.reloadDraft=()=>{void flow.refetch()};return <><button disabled={flow.isPublishing} onClick={()=>flow.publish()}>Publish</button><p role="alert">{flow.error}</p><output id="draft-title">{flow.currentLead?.title}</output><p>{flow.publishSuccess?'Published':'Draft'}</p></>}
function App(){const[away,setAway]=useState(false);window.leaveIntake=()=>setAway(true);window.returnIntake=()=>setAway(false);return away?<h1>Away from upload</h1>:location.pathname==='/tags'?<Tags/>:location.pathname==='/publish'?<Publish/>:<CreateProjectGuide actorId="fixture-actor" workspaceId="fixture-workspace" onManual={()=>{location.href='/manual'}}/>};createRoot(document.getElementById('root')).render(<App/>);`;
(async () => {
  await esbuild.build({ stdin: { contents: entry, loader: 'tsx', resolveDir: root }, bundle: true, platform: 'browser', jsx: 'automatic', outfile: path.join(out, 'app.js'), alias: { '@': path.join(root, 'src') }, plugins: [{ name: 'fixture-navigation', setup(build) {
    const stubs = {
      '@/components/spotlight/PrivateSpotlightInterview': 'export function SpotlightSelections(){return null}',
      '@/app/actions/projectImages': 'export async function setImageNoProducts(){throw Error("Synthetic action unavailable")}',
      '@/components/project/ProductTagPicker': 'export function ProductTagPicker(){return null}',
      '@/components/project/ProductEditModal': 'export function ProductEditModal(){return null}',
      'next/image': 'import React from "react";export default function Image({fill,priority,sizes,...props}){return <img {...props}/>}',
    };
    build.onResolve({ filter: /.*/ }, args => Object.hasOwn(stubs, args.path) ? { path: args.path, namespace: 'stub' } : undefined);
    build.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: stubs[args.path], loader: 'jsx', resolveDir: root }));
    build.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push:url=>{location.href=url},refresh:()=>{}});` }));
  } }] });
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  const config = { ...require(path.join(root, 'tailwind.config.js')), content: ['src/components/interviews/CreateProjectGuide.tsx', 'src/components/interviews/ProjectGuideUploads.tsx', 'src/app/project/[id]/TaggingSection.tsx'] };
  const stylesheet = (await postcss([tailwind(config)]).process(css, { from: path.join(root, 'src/app/globals.css') })).css;
  const server = http.createServer(async (req, res) => {
    const json = (body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.url === '/app.css') { res.setHeader('Content-Type', 'text/css'); return res.end(stylesheet); }
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(fs.readFileSync(path.join(out, 'app.js'))); }
    if (req.url === '/photo.svg') { res.setHeader('Content-Type', 'image/svg+xml'); return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#ddd"/></svg>'); }
    if (req.url.startsWith('/api/')) {
      let text = ''; for await (const chunk of req) text += chunk;
      const body = text ? JSON.parse(text) : {};
      if (req.url.endsWith('/pending-spec-tags')) return json({ tags: [] });
      if (req.url === '/api/tag-product-to-image') {
        tagAttempts++; return tagAttempts === 1 ? json({ error: 'Unauthorized' }, 401) : tagAttempts === 2 ? json({ error: 'Tag service unavailable' }, 503) : json({ id: 'tag' });
      }
      if (req.url === '/api/projects') {
        creates++; if (!projects.has(body.requestId)) projects.set(body.requestId, { id: 'fixture-project' });
        if (createLost) { createLost = false; return json({ error: 'Creation acknowledgement lost' }, 503); }
        return json(projects.get(body.requestId), 201);
      }
      if (req.url.endsWith('/images')) {
        uploadCalls++;
        if (body.name === 'second.png' && imageFailed) { imageFailed = false; return json({ error: 'Storage unavailable' }, 503); }
        images.set(body.name, { id: body.name, url: '/photo.png' }); if (holdUpload) { holdUpload = false; releaseUpload = () => json({ image: images.get(body.name) }, 201); return; } return json({ image: images.get(body.name) }, 201);
      }
      if (req.url.endsWith('/publish-editorial')) {
        publishCalls++; await new Promise(resolve => setTimeout(resolve, 80));
        if (publishFailed) { publishFailed = false; return json({ error: 'Publish unavailable' }, 503); }
        published = true; return json({ slug: 'fixture-publication' });
      }
      if (req.url.endsWith('/drafts')) { const body = { drafts: [{ id: 'one-draft', lead: { title: draftTitle } }] }; if (holdDraft) { holdDraft = false; releaseDraft = () => json(body); return; } return json(body); }
      if (req.url.endsWith('/credits')) return json({ credits: [] });
      if (req.url === '/api/posting/project/fixture-project') return json({ post: { status: published ? 'PUBLISHED' : 'DRAFT', slug: 'fixture-publication' } });
      return json({ error: 'Unexpected fixture endpoint' }, 500);
    }
    if (req.url.startsWith('/project/')) return res.end('<h1>Saved project workspace</h1><a href="/">Return to intake</a>');
    res.setHeader('Content-Type', 'text/html'); res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({ executablePath: process.env.GUIDED_TEST_BROWSER || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => request.url().startsWith(base) || request.url().startsWith('data:') ? request.continue() : request.abort());
  const text = value => page.waitForFunction(value => document.body.innerText.includes(value), {}, value);
  const click = async value => { await page.evaluate(value => { const el = [...document.querySelectorAll('button')].find(el => el.textContent === value); if (!el || el.disabled) throw Error('Unavailable control: '+value); el.click(); }, value); };
  const upload = async files => { const input = await page.$('input[type=file]'); await input.uploadFile(...files); };
  const first = path.join(out, 'first.png'), second = path.join(out, 'second.png'), invalid = path.join(out, 'unsupported.txt'), large = path.join(out, 'large.png');
  fs.writeFileSync(first, 'synthetic first'); fs.writeFileSync(second, 'synthetic second'); fs.writeFileSync(invalid, 'unsupported'); fs.writeFileSync(large, Buffer.alloc(3 * 1024 * 1024 + 1));
  try {
    await page.goto(base); await page.waitForSelector('input[aria-label="Project name"]:not(:disabled)');
    await page.type('[aria-label="Project name"]', 'Interruption fixture'); await page.type('[aria-label="Completion year"]', '2024');
    await page.reload(); await page.waitForSelector('input[type=file]');
    assert.equal(await page.$eval('[aria-label="Project name"]', el => el.value), 'Interruption fixture');
    console.log('PASS refresh retains unsaved project facts');
    await upload([invalid, large]); await text('no larger than 3 MB'); assert.equal(creates, 0);
    console.log('PASS unsupported/oversized files rejected before project creation');
    await upload([first]); await text('Creation acknowledgement lost'); assert.equal(projects.size, 1);
    await page.reload(); await page.waitForSelector('input[type=file]');
    await upload([first, second]); await text('Retry failed photos'); assert.equal(projects.size, 1); assert.equal(creates, 2); assert.equal(images.size, 1);
    await page.setViewport({ width: 1280, height: 900 });
    await page.screenshot({ path: path.join(out, 'partial-desktop.png'), fullPage: true });
    const before = uploadCalls; await page.setOfflineMode(true); await click('Retry failed photos'); await text('could not be uploaded');
    await page.waitForFunction(() => !document.querySelector('input[type=file]').disabled); await page.setOfflineMode(false);
    assert.equal(uploadCalls, before); assert.equal(images.size, 1);
    await page.setViewport({ width: 320, height: 568 });
    const box = await page.$eval('input[type=file]', el => { const r = el.getBoundingClientRect(); return { width: r.width, left: r.left }; });
    assert.ok(box.width > 0 && box.left >= 0 && box.left + box.width <= 320);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(out, 'partial-mobile.png'), fullPage: true });
    await click('Retry failed photos'); await text('Saved project workspace'); assert.equal(images.size, 2); assert.equal(uploadCalls, before + 1);
    console.log('PASS lost creation response, partial upload, offline retry and mobile recovery preserve identities');
    await page.goBack(); await page.waitForSelector('input[type=file]');
    assert.equal(images.size, 2); assert.equal(projects.size, 1);
    await page.goto(base); await page.waitForSelector('input[type=file]');
    await page.type('[aria-label="Project name"]', 'Navigation fixture'); await page.type('[aria-label="Completion year"]', '2024');
    const third = path.join(out, 'third.png'), fourth = path.join(out, 'fourth.png'); fs.writeFileSync(third, 'third'); fs.writeFileSync(fourth, 'fourth');
    const priorImages = images.size, priorUploads = uploadCalls; holdUpload = true;
    await upload([third, fourth]);
    for (let i = 0; !releaseUpload && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(releaseUpload); await page.evaluate(() => window.leaveIntake()); await text('Away from upload');
    releaseUpload(); await page.waitForNetworkIdle({ idleTime: 100 });
    assert.equal(uploadCalls, priorUploads + 1); await text('Away from upload');
    await page.evaluate(() => window.returnIntake()); await page.waitForSelector('input[type=file]');
    await upload([third, fourth]); await text('Saved project workspace'); assert.equal(images.size, priorImages + 2);
    console.log('PASS navigation during upload stops remaining work and late completion cannot redirect; reselection recovers');
    await page.goto(base + '/publish'); await text('Draft');
    await page.evaluate(() => window.publishTwice()); await text('Publish unavailable'); assert.equal(publishCalls, 1); assert.equal(published, false);
    await click('Publish'); await text('Published'); assert.equal(publishCalls, 2);
    await page.reload(); await text('Published'); assert.equal(publishCalls, 2);
    console.log('PASS failed publish, same-tick repeated clicks, deliberate retry and reopened publication');
    holdDraft = true; await page.evaluate(() => window.reloadDraft());
    for (let i = 0; !releaseDraft && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(releaseDraft); draftTitle = 'Newer saved draft';
    await page.evaluate(() => window.reloadDraft()); await text('Newer saved draft');
    releaseDraft(); await page.waitForNetworkIdle({ idleTime: 100 });
    assert.equal(await page.$eval('#draft-title', el => el.textContent), 'Newer saved draft');
    console.log('PASS delayed draft read cannot replace a newer read');
    await page.setViewport({ width: 1280, height: 900 }); await page.goto(base + '/tags'); await page.waitForSelector('[title="Confirm this tag"]');
    await page.$eval('[title="Confirm this tag"]', el => el.click()); await text('Sign in again'); assert.equal(await page.evaluate(() => window.tagRefreshes), 0);
    await page.$eval('[title="Confirm this tag"]', el => el.click()); await text('Tag service unavailable'); assert.equal(await page.evaluate(() => window.tagRefreshes), 0);
    await page.$eval('[title="Confirm this tag"]', el => el.click()); await page.waitForFunction(() => window.tagRefreshes === 1);
    console.log('PASS actual tagging surface reports expired-session/server failures and refreshes only after success');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

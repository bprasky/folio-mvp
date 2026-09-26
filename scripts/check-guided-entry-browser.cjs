// Actual tracker, Story, modal, guided and protected interview components.
// Only Next navigation/image/dynamic and loopback API responses are synthetic.
// --baseline bundles the committed entry components in memory: no source edits.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const root = path.resolve(__dirname, '..');
const baseline = process.argv.includes('--baseline');
const baselineCommit = baseline ? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() : null;
const out = path.join(root, '.tmp/guided-entry-browser', baseline ? 'baseline' : 'current');
const reviewOut = path.join(root, 'docs/reviews/guided-interview');
const projectId = 'entry-fixture', firstQuestion = 'What did the clients come to you wanting from this project?';
const baselineFiles = new Set(['src/app/project/[id]/ProjectProgressTracker.tsx', 'src/app/project/[id]/StoryInterviewPanel.tsx', 'src/components/posting/interview/InterviewModal.tsx']);
const controllerBundle = esbuild.buildSync({ entryPoints: [path.join(root, 'src/lib/interview/guided/controller.ts')], bundle: true, platform: 'node', format: 'cjs', packages: 'external', alias: { '@': path.join(root, 'src') }, write: false }).outputFiles[0].text;
const controllerModule = new Module(path.join(root, 'entry-fixture.cjs'));
controllerModule.filename = path.join(root, 'entry-fixture.cjs'); controllerModule.paths = module.paths; controllerModule._compile(controllerBundle, controllerModule.filename);
const controller = controllerModule.exports;
const categories = ['CLIENT_BRIEF', 'SCOPE_PARAMETERS', 'DESIGN_DIRECTION', 'SIGNATURE_IDENTITY', 'SURPRISE_PIVOT'];
const prepared = {
  contextFingerprint: 'entry-fixture', minimumTotalAnswers: 8,
  rooms: [{ id: 'living', name: 'Living room', imageIds: ['photo'], baseQuestions: 3, maxFollowUps: 1 }],
  questions: categories.map((category, index) => ({ id: `project-${category}-fixture`, text: index === 0 ? firstQuestion : 'What was the overall design idea for this project?', category, roomId: null, sourceImageIds: ['photo'], sourceAnswerIds: [], kind: 'prepared', status: 'pending' })),
};
let scenario = {}, saved = null;
const requests = [], unexpected = [], results = [], pendingReads = [];
const entry = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {useSearchParams} from 'next/navigation';
import Tracker from './src/app/project/[id]/ProjectProgressTracker';
import Story from './src/app/project/[id]/StoryInterviewPanel';
import {InterviewModal} from './src/components/posting/interview/InterviewModal';
import {deriveTrackerState} from './src/lib/publish/computeTrackerState';
const images=[{id:'photo',url:'/room.svg',name:'Living room',roomId:'living',room:'Living room',displayOrder:0,tags:[],noProducts:true}];
const rooms=[{id:'living',name:'Living room'}];
const state=deriveTrackerState({type:'completed',complete:{photos:true,rooms:true,tags:true,story:false,publish:false},materialsExist:true});
function App(){const params=useSearchParams();const view=params.get('view');return <>
{view==='story'?<Story projectId="${projectId}" projectName="Entry fixture" images={images} rooms={rooms} untaggedPhotoCount={0} taggedPhotoCount={1}/>:
 view==='modal'?<InterviewModal open onOpenChange={()=>{}} projectId="${projectId}" images={images} initialIntent="resume"/>:
 view==='publish'?<p>Editable draft review</p>:<Tracker projectId="${projectId}" state={state} currentView="overview"/>}
</>};createRoot(document.getElementById('root')).render(<App/>);`;
const navigation = `import React,{useSyncExternalStore} from 'react';
const subscribe=fn=>{window.addEventListener('fixture-navigation',fn);return()=>window.removeEventListener('fixture-navigation',fn)};
const go=(url,replace=false)=>{history[replace?'replaceState':'pushState']({},'',url);window.dispatchEvent(new Event('fixture-navigation'))};
const router={push:url=>go(url),replace:url=>go(url,true),refresh:()=>window.dispatchEvent(new Event('fixture-navigation')),back:()=>history.back()};
export const useRouter=()=>router;
export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search));
export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);
export const redirect=url=>go(url); export const notFound=()=>{throw Error('Unexpected notFound')};
export default function Link({href,children,prefetch,replace,...props}){return <a {...props} href={href} onClick={e=>{props.onClick?.(e);if(!e.defaultPrevented){e.preventDefault();go(href,replace)}}}>{children}</a>};`;

async function build() {
  fs.mkdirSync(out, { recursive: true });
  fs.mkdirSync(reviewOut, { recursive: true });
  await esbuild.build({ stdin: { contents: entry, resolveDir: root, sourcefile: 'entry-fixture.tsx', loader: 'tsx' }, bundle: true, outfile: path.join(out, 'app.js'), platform: 'browser', jsx: 'automatic', alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' }, plugins: [{ name: 'fixture-boundaries', setup(build) {
    build.onResolve({ filter: /^(next\/navigation|next\/link|next\/image|next\/dynamic)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root, contents:
      /navigation|link/.test(args.path) ? navigation : args.path === 'next/dynamic'
        ? 'import React,{lazy,Suspense} from "react";export default loader=>{const C=lazy(()=>loader().then(value=>({default:value.default||value})));return props=><Suspense fallback={<p>Loading interview…</p>}><C {...props}/></Suspense>}'
        : 'import React from "react";export default function Image({fill,unoptimized,priority,sizes,...props}){return <img {...props} style={fill?{position:"absolute",height:"100%",width:"100%",inset:0}:undefined}/>}' }));
    if (baseline) build.onLoad({ filter: /\.tsx$/ }, args => {
      const relative = path.relative(root, args.path).split(path.sep).join('/');
      if (baselineFiles.has(relative)) return { contents: execFileSync('git', ['show', `${baselineCommit}:${relative}`], { cwd: root, encoding: 'utf8' }), loader: 'tsx' };
    });
  } }] });
  const globals = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  const config = { ...require(path.join(root, 'tailwind.config.js')), content: [...baselineFiles].map(file => path.join(root, file)).concat([path.join(root, 'src/components/posting/interview/GuidedInterviewWorkspace.tsx'), path.join(root, 'src/components/ui/dialog.tsx'), path.join(root, 'src/components/posting/GenerationContextOptions.tsx')]) };
  fs.writeFileSync(path.join(out, 'app.css'), (await postcss([tailwind(config)]).process(globals, { from: path.join(root, 'src/app/globals.css') })).css + '\n:root{--font-headline:Georgia;--font-body:Arial}');
}

function handler(req, res) {
  const url = new URL(req.url, 'http://localhost'), endpoint = url.pathname;
  const json = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  if (endpoint.startsWith('/api/')) {
    const record = { endpoint, method: req.method, query: url.search }; requests.push(record);
    if (endpoint.endsWith('/generation-context')) return json({ bio: { available: true, source: 'individual' }, projectHistory: { available: true, count: 2 } });
    if (endpoint.endsWith('/spotlight')) {
      if (req.method === 'GET') return json({ enrolled: !!scenario.enrolled, enabled: !!scenario.enabled, actorId: 'fixture-designer' });
      req.resume(); return json({ questions: [], ordinary: [], ordinaryHistory: [], legacyReuseSources: [], tags: [], spotlights: [] });
    }
    if (endpoint.endsWith('/interview/guided')) {
      if (req.method === 'GET') return json(scenario.invalidGuided ? { ok: false } : { ok: true, session: saved }, scenario.guidedStatus || 200);
      let text = ''; req.on('data', chunk => { text += chunk; }); req.on('end', () => {
        try {
          const command = JSON.parse(text); record.command = command;
          if (!saved) saved = controller.createGuidedSession(projectId, prepared, command.requestId, command);
          else if (command.action !== 'start') saved = controller.acceptCommand(saved, command);
          if (saved.status === 'deciding') { controller.applyDecision(saved, { kind: 'advance' }); saved.version++; }
          json({ ok: true, session: saved });
        } catch (error) { json({ message: error.message }, error.status || 500); }
      }); return;
    }
    if (endpoint.endsWith('/interview/generate')) { req.resume(); return json({ ok: true }); }
    if (endpoint.endsWith('/interview')) {
      if (req.method !== 'GET') unexpected.push(record);
      const respond = () => json({ answers: scenario.answers || (saved ? controller.canonicalGuidedAnswers(saved) : []), coverage: [{ roomId: 'living', roomName: 'Living room', answered: scenario.answers?.some(answer => answer.answer?.trim()) ? 1 : 0, total: 1, complete: true }] });
      if (scenario.holdRead) { pendingReads.push(respond); return; }
      return respond();
    }
    if (endpoint.endsWith('/interview/questions')) {
      const question = { id: 'legacy-question', text: 'Legacy fixture question?', questionText: 'Legacy fixture question?', questionType: 'contextual', section: 'why', role: 'DESIGNER', type: 'generic', rooms: [], products: [], vendors: [] };
      return json({ questions: [question], rooms: [{ roomId: 'project', roomName: 'About This Project', questions: [question], budget: { baseQuestions: 5, maxFollowUps: 1 } }], globalGates: { minimumTotalAnswers: 5, warnings: [] }, projectSize: { roomCount: 0, targetQuestionCount: 5, size: 'focused' } });
    }
    if (endpoint === '/api/health/llm') return json({ ok: true });
    if (endpoint === `/api/projects/${projectId}`) return json({ rooms: [{ id: 'living', name: 'Living room' }], images: [] });
    if (endpoint.endsWith('/status')) return json({ status: 'DRAFT' });
    unexpected.push(record); return json({ error: 'Unexpected fixture request' }, 404);
  }
  if (endpoint === '/room.svg') { res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#ddd6cb"/></svg>'); }
  if (endpoint === '/app.js' || endpoint === '/app.css') { res.writeHead(200, { 'Content-Type': endpoint.endsWith('.js') ? 'text/javascript' : 'text/css' }); return fs.createReadStream(path.join(out, endpoint.slice(1))).pipe(res); }
  res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
}

async function main() {
  await build();
  const server = http.createServer(handler); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const executablePath = process.env.GUIDED_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(file => fs.existsSync(file));
  assert.ok(executablePath, 'Set GUIDED_TEST_BROWSER to an installed Chromium executable.');
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let page, pageErrors;
  const open = async (view, setup = {}) => {
    if (page) await page.browserContext().close();
    scenario = setup; saved = null; requests.length = 0; unexpected.length = 0; pendingReads.length = 0; pageErrors = [];
    const context = await browser.createBrowserContext(); page = await context.newPage();
    page.setDefaultTimeout(6000); await page.setViewport({ width: 1440, height: 1000 });
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.setRequestInterception(true); page.on('request', request => request.url().startsWith(base) || request.url().startsWith('data:') ? request.continue() : request.abort());
    await page.goto(`${base}/project/${projectId}?view=${view}`);
  };
  const click = async text => {
    await page.waitForFunction(text => [...document.querySelectorAll('button,a')].some(el => el.textContent.trim() === text), {}, text);
    for (const element of await page.$$('button,a')) if ((await element.evaluate(el => el.textContent.trim())) === text) { await element.click(); return; }
    throw Error(`Missing action ${text}`);
  };
  const storyReady = () => page.waitForFunction(() => document.querySelector('h1')?.textContent.includes('Your story') && !document.body.textContent.includes('Loading your answers'));
  const guidedReady = () => page.waitForSelector('[data-testid="guided-current-question"]');
  const assertNoDraftControls = async () => {
    const buttons = await page.$$eval('button', elements => elements.map(el => el.textContent.trim()));
    assert.ok(!buttons.includes('Generate draft')); assert.ok(!buttons.includes('Restart'));
    assert.equal(await page.evaluate(() => document.body.textContent.includes('Write it using')), false);
  };
  const noGuidedCalls = () => assert.equal(requests.filter(request => request.endpoint.endsWith('/interview/guided')).length, 0);
  const capture = async (name, work) => {
    try { await work(); assert.deepEqual(pageErrors, []); assert.deepEqual(unexpected, []); results.push({ name, status: 'pass' }); console.log('PASS ' + name); }
    catch (error) {
      const detail = { name, status: 'fail', error: error.message, pageErrors, unexpected, text: page ? await page.evaluate(() => document.body.innerText.slice(0, 1200)) : '' };
      results.push(detail); console.error('FAIL ' + JSON.stringify(detail));
      if (page) await page.screenshot({ path: path.join(out, `failure-${results.length}.png`) });
    }
  };
  try {
    await capture('Lifecycle Start interview opens the first question while the saved-only Story read is pending', async () => {
      await open('overview', { holdRead: true }); await click('Start interview'); await guidedReady();
      assert.equal(await page.$eval('[data-testid="guided-current-question"]', el => el.textContent), firstQuestion);
      assert.equal(new URL(page.url()).searchParams.has('action'), false);
      assert.equal(requests.filter(request => request.command?.action === 'start').length, 1);
      assert.ok(!requests.some(request => request.endpoint.endsWith('/interview/questions')));
      assert.equal(pendingReads.length, 1, 'the Story read remains unresolved when the first guided question appears');
      assert.equal(requests.find(request => request.endpoint.endsWith('/interview')).query, '?savedOnly=1');
      pendingReads.shift()();
      if (!baseline) await page.screenshot({ path: path.join(reviewOut, 'entry.png'), fullPage: true });
    });
    await capture('Close consumes navigation intent; explicit reopen restores the saved cursor', async () => {
      await open('story&action=interview'); await guidedReady();
      await page.type('#guided-response', 'We opened a clear route to the garden for everyday family use.');
      await page.click('[aria-label="Send response"]');
      await page.waitForFunction(first => document.querySelector('[data-testid="guided-current-question"]')?.textContent !== first, {}, firstQuestion);
      const questionId = saved.activeQuestionId;
      await click('Pause & close'); await page.waitForSelector('#guided-response', { hidden: true }); await storyReady();
      assert.equal(new URL(page.url()).searchParams.has('action'), false);
      await page.reload(); await storyReady(); assert.equal(await page.$('#guided-response'), null);
      await click('Resume interview'); await guidedReady();
      assert.equal(saved.activeQuestionId, questionId); assert.equal(saved.turns.length, 1);
      assert.equal(requests.filter(request => request.command?.action === 'start').length, 1);
    });
    await capture('Ordinary empty Story is review only and has no draft, context or restart controls', async () => {
      await open('story'); await storyReady(); await assertNoDraftControls();
      assert.equal(await page.$('[role="dialog"]'), null); noGuidedCalls();
    });
    await capture('Question-only saved rows do not unlock generation or count as room answers', async () => {
      await open('story', { answers: [{ questionId: 'question-only', prompt: 'What shaped this room?', answer: '   ', roomId: 'living' }] });
      await storyReady(); await assertNoDraftControls();
      assert.equal(await page.$eval('[aria-label="Rooms with a write-up"]', el => el.getAttribute('aria-valuenow')), '0');
      noGuidedCalls();
    });
    await capture('An accepted room answer unlocks draft controls and generates through the canonical route', async () => {
      await open('story', { answers: [{ questionId: 'accepted', prompt: 'What shaped this room?', answer: 'We opened the route toward the garden.', roomId: 'living' }] });
      await storyReady(); await page.waitForFunction(() => document.body.textContent.includes('Write it using'));
      const controls = await page.$$eval('button', elements => elements.filter(el => ['Restart', 'Generate draft', 'Resume interview'].includes(el.textContent.trim())).map(el => ({ text: el.textContent.trim(), disabled: el.disabled })));
      assert.equal(controls.length, 3); assert.ok(controls.every(control => !control.disabled));
      await click('Generate draft'); await page.waitForFunction(() => document.body.textContent.includes('Editable draft review'));
      assert.equal(requests.filter(request => request.endpoint.endsWith('/interview/generate')).length, 1); noGuidedCalls();
    });
    await capture('Server-enabled new guided session works with a client built flag-off', async () => {
      await open('modal'); await guidedReady(); assert.equal(saved.plan[0].text, firstQuestion);
      assert.ok(!requests.some(request => request.endpoint.endsWith('/interview/questions')));
    });
    await capture('An explicit guided 404 retains the actual legacy question flow', async () => {
      await open('modal', { guidedStatus: 404 });
      await page.waitForFunction(() => document.body.textContent.includes('Legacy fixture question?'));
      assert.equal(await page.$('#guided-response'), null); assert.ok(requests.some(request => request.endpoint.endsWith('/interview/questions')));
      assert.ok(!requests.some(request => request.command?.action === 'start'));
    });
    for (const setup of [{ guidedStatus: 503 }, { invalidGuided: true }]) await capture('Unverified guided availability fails closed: ' + JSON.stringify(setup), async () => {
      await open('modal', setup); await page.waitForFunction(() => document.body.textContent.includes('Unable to restore interview access'));
      assert.equal(await page.$('#guided-response'), null); assert.ok(!requests.some(request => request.endpoint.endsWith('/interview/questions') || request.command));
    });
    for (const enabled of [false, true]) await capture('Protected spotlight takes precedence when enabled=' + enabled, async () => {
      await open('modal', { enrolled: true, enabled });
      await page.waitForFunction(enabled => document.body.textContent.includes(enabled ? 'Private spotlight interview' : 'Private interviews are paused'), {}, enabled);
      noGuidedCalls(); assert.equal(await page.$('#guided-response'), null);
    });
    const report = JSON.stringify({ baseline, baselineCommit, fixture: 'Actual Tracker → Story → InterviewModal → GuidedInterviewWorkspace and protected interview components; synthetic Next navigation/image/dynamic and loopback HTTP responses, pure guided controller, no AI or database. No deployed/authenticated Next server verification.', results }, null, 2);
    fs.writeFileSync(path.join(out, 'results.json'), report);
    fs.writeFileSync(path.join(reviewOut, baseline ? 'entry-baseline-results.json' : 'entry-results.json'), report);
    console.log(`${results.filter(result => result.status === 'pass').length}/${results.length} entry regressions passed (${baseline ? 'committed baseline' : 'working tree'}).`);
    if (results.some(result => result.status === 'fail')) process.exitCode = 1;
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

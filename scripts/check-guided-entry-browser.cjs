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
const selectedCase = process.argv.find(value => value.startsWith('--case='))?.slice(7);
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
let resetReceipt = null;
let heldResetResponse = null, resetHeldSignal = null;
const draftKey = `folio.guided.draft.fixture-designer.${projectId}`;
function savedSession() {
  let session = controller.createGuidedSession(projectId, structuredClone(prepared), 'fixture-saved-start');
  session = controller.acceptCommand(session, { action: 'answer', requestId: 'fixture-saved-answer', version: session.version,
    questionId: session.activeQuestionId, text: 'The clients wanted quiet rooms and an open route toward the garden.' });
  controller.applyDecision(session, { kind: 'advance' });
  return session;
}
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
{view==='story'?<><Tracker projectId="${projectId}" state={state} currentView="story"/><Story projectId="${projectId}" projectName="Entry fixture" images={images} rooms={rooms} untaggedPhotoCount={0} taggedPhotoCount={1}/></>:
 view==='modal'?<InterviewModal open onOpenChange={()=>{}} projectId="${projectId}" images={images} initialIntent={params.get('restart')==='1'?'restart':'resume'}/>:
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
    if (endpoint.endsWith('/interview/reset')) {
      const snapshot = { revision: `fixture-revision-${saved?.version ?? 0}`, sessionId: saved?.id ?? null };
      if (req.method === 'GET') return json({ ok: true, snapshot });
      let text = ''; req.on('data', chunk => { text += chunk; }); req.on('end', () => {
        const command = JSON.parse(text); record.command = command;
        if (scenario.resetFailure) return json({ message: 'Fixture reset unavailable' }, 503);
        if (resetReceipt?.requestId === command.requestId) return json(resetReceipt.response);
        if (command.revision !== snapshot.revision || command.sessionId !== snapshot.sessionId) return json({ message: 'The interview changed. Reopen Start over to review it again.' }, 409);
        const previousVersion = saved?.version ?? 0;
        const fresh = structuredClone(prepared); fresh.questions.forEach(question => { question.id += '-' + command.requestId; });
        saved = controller.createGuidedSession(projectId, fresh, command.requestId);
        saved.version = previousVersion + 1; saved.resetId = command.requestId; scenario.answers = undefined;
        const response = { ok: true, session: saved, resetId: command.requestId };
        resetReceipt = { requestId: command.requestId, response };
        if (scenario.holdReset) { heldResetResponse = () => { json(response); heldResetResponse = null; }; resetHeldSignal?.(); return; }
        return json(response);
      }); return;
    }
    if (endpoint.endsWith('/interview/generate')) { req.resume(); return json({ ok: true }); }
    if (endpoint.endsWith('/interview')) {
      if (req.method !== 'GET') unexpected.push(record);
      const respond = () => json({ guided: !!saved, resetId: scenario.resetId ?? resetReceipt?.response.resetId ?? null, answers: scenario.answers || (saved ? controller.canonicalGuidedAnswers(saved) : []), coverage: [{ roomId: 'living', roomName: 'Living room', answered: scenario.answers?.some(answer => answer.answer?.trim()) ? 1 : 0, total: 1, complete: true }] });
      if (scenario.holdRead) { pendingReads.push(respond); return; }
      return respond();
    }
    if (endpoint.endsWith('/interview/questions')) {
      const question = { id: 'legacy-question', text: 'Legacy fixture question?', questionText: 'Legacy fixture question?', questionType: 'contextual', section: 'why', role: 'DESIGNER', type: 'generic', rooms: [], products: [], vendors: [] };
      return json({ questions: [question], rooms: [{ roomId: 'project', roomName: 'About This Project', questions: [question], budget: { baseQuestions: 5, maxFollowUps: 1 } }], globalGates: { minimumTotalAnswers: 5, warnings: [] }, projectSize: { roomCount: 0, targetQuestionCount: 5, size: 'focused' } });
    }
    if (endpoint === '/api/live-interviews' && req.method === 'GET') return json({ enabled: false, recordingEnabled: false });
    if (endpoint === '/api/health/llm') return json({ ok: true });
    if (endpoint === `/api/projects/${projectId}`) return json({ rooms: [{ id: 'living', name: 'Living room' }], images: [] });
    if (endpoint.endsWith('/status')) return json({ status: 'DRAFT' });
    unexpected.push(record); return json({ error: 'Unexpected fixture request' }, 404);
  }
  if (endpoint === '/room.svg') { res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#ddd6cb"/></svg>'); }
  if (endpoint === '/app.js' || endpoint === '/app.css') { res.writeHead(200, { 'Content-Type': endpoint.endsWith('.js') ? 'text/javascript' : 'text/css' }); return fs.createReadStream(path.join(out, endpoint.slice(1))).pipe(res); }
  res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
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
    scenario = setup; saved = setup.saved ? savedSession() : null; resetReceipt = null; heldResetResponse = null; resetHeldSignal = null; requests.length = 0; unexpected.length = 0; pendingReads.length = 0; pageErrors = [];
    const context = await browser.createBrowserContext(); page = await context.newPage();
    if (setup.legacyDraft) await page.evaluateOnNewDocument((id, draft) => localStorage.setItem('interviewDraft:' + id, JSON.stringify(draft)), projectId, setup.legacyDraft);
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
  const storyReady = () => page.waitForFunction(() => [...document.querySelectorAll('h1,h2')].some(el => el.textContent === 'Your interview') && !document.body.textContent.includes('Loading your answers'));
  const guidedReady = () => page.waitForSelector('[data-testid="guided-current-question"]');
  const dialogClick = async text => {
    await page.waitForFunction(text => [...document.querySelectorAll('[role="dialog"] button,[role="alertdialog"] button')].some(el => el.textContent.trim() === text && !el.disabled), {}, text);
    for (const element of await page.$$('[role="dialog"] button,[role="alertdialog"] button')) if ((await element.evaluate(el => el.textContent.trim())) === text) { await element.click(); return; }
    throw Error(`Missing dialog action ${text}`);
  };
  const assertNoDraftControls = async () => {
    const buttons = await page.$$eval('button', elements => elements.map(el => el.textContent.trim()));
    assert.ok(!buttons.includes('Generate draft')); assert.ok(!buttons.includes('Prepare draft')); assert.ok(!buttons.includes('Start over'));
    assert.equal(await page.evaluate(() => document.body.textContent.includes('Write it using')), false);
  };
  const noGuidedCalls = () => assert.equal(requests.filter(request => request.endpoint.endsWith('/interview/guided')).length, 0);
  const capture = async (name, work) => {
    if (selectedCase && !name.includes(selectedCase)) return;
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
      assert.equal(await page.$('[aria-label="Rooms with a write-up"]'), null, 'the resume screen has no room coverage dashboard');
      noGuidedCalls();
    });
    await capture('Saved answers have a simple resume screen; draft settings open only on request', async () => {
      await open('story', { answers: [{ questionId: 'accepted', prompt: 'What shaped this room?', answer: 'We opened the route toward the garden.', roomId: 'living' }] });
      await storyReady();
      assert.equal(await page.evaluate(() => document.body.textContent.includes('Write it using')), false);
      assert.equal(await page.$('[role="progressbar"]'), null);
      const controls = await page.$$eval('button', elements => elements.filter(el => ['Start over', 'Prepare draft', 'Resume interview'].includes(el.textContent.trim())).map(el => ({ text: el.textContent.trim(), disabled: el.disabled })));
      assert.equal(controls.length, 3); assert.ok(controls.every(control => !control.disabled));
      const disclosure = await page.$('details'); assert.ok(disclosure); assert.equal(await disclosure.evaluate(el => el.open), false);
      assert.match(await disclosure.$eval('summary', el => el.textContent), /Review saved answers/);
      await disclosure.$eval('summary', el => el.click());
      assert.equal(await disclosure.evaluate(el => el.open), true); assert.ok((await disclosure.evaluate(el => el.textContent)).includes('We opened the route toward the garden.'));
      await disclosure.$eval('summary', el => el.click());
      if (!baseline) await page.screenshot({ path: path.join(reviewOut, 'resume-desktop.png'), fullPage: true });
      await page.setViewport({ width: 390, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (!baseline) await page.screenshot({ path: path.join(reviewOut, 'resume-mobile.png'), fullPage: true });
      await click('Prepare draft'); await page.waitForFunction(() => document.body.textContent.includes('Write it using'));
      assert.equal(requests.filter(request => request.endpoint.endsWith('/interview/generate')).length, 0);
      await dialogClick('Generate draft'); await page.waitForFunction(() => document.body.textContent.includes('Editable draft review'));
      assert.equal(requests.filter(request => request.endpoint.endsWith('/interview/generate')).length, 1); noGuidedCalls();
    });
    await capture('Start over explains deletion; cancellation preserves saved answers and local drafts', async () => {
      await open('story', { saved: true }); await storyReady();
      const original = structuredClone(saved);
      await page.evaluate((key, session) => localStorage.setItem(key, JSON.stringify({ text: 'An unsent detail to keep.', inputModality: 'text', questionId: session.activeQuestionId, sessionId: session.id, pending: null })), draftKey, saved);
      await click('Start over');
      await page.waitForFunction(() => document.body.textContent.includes('Start this interview over?'));
      assert.ok(await page.evaluate(() => document.body.textContent.includes('Photos, rooms, tags and any existing draft stay in place.')));
      if (!baseline) await page.screenshot({ path: path.join(reviewOut, 'reset-confirmation.png'), fullPage: true });
      await dialogClick('Keep my answers'); await page.waitForSelector('[role="dialog"]', { hidden: true });
      assert.deepEqual(saved, original);
      assert.equal(requests.filter(request => request.endpoint.endsWith('/interview/reset') && request.method === 'POST').length, 0);
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).text, draftKey), 'An unsent detail to keep.');
    });
    await capture('Explicit restart intent resets before guided entry instead of resuming the old interview', async () => {
      await open('modal&restart=1', { saved: true }); await guidedReady();
      assert.equal(await page.$eval('[data-testid="guided-current-question"]', el => el.textContent), firstQuestion);
      assert.equal(saved.turns.length, 0); assert.equal(saved.activeQuestionId, saved.plan[0].id);
      assert.equal(requests.filter(request => request.endpoint.endsWith('/interview/reset') && request.method === 'POST').length, 1);
    });
    await capture('Failed reset retains work; retry starts once at the first question and clears stale local recovery', async () => {
      await open('story', { saved: true, resetFailure: true }); await storyReady();
      const old = structuredClone(saved);
      const staleDraft = { text: 'An unsent detail to keep until reset succeeds.', inputModality: 'text', questionId: old.activeQuestionId, sessionId: old.id,
        pending: { action: 'answer', requestId: 'old-pending-response', sessionId: old.id, version: old.version, questionId: old.activeQuestionId, text: 'An old pending response.' } };
      await page.evaluate((key, value, id) => {
        localStorage.setItem(key, JSON.stringify(value)); localStorage.setItem('interviewDraft:' + id, 'legacy draft');
        localStorage.setItem('folio.interview.qcache.flat.' + id, 'old questions'); sessionStorage.setItem('folio.interview.validation.' + id, 'old validation');
      }, draftKey, staleDraft, projectId);
      await click('Start over'); await dialogClick('Clear answers and start over');
      await page.waitForFunction(() => document.body.textContent.includes('Fixture reset unavailable'));
      assert.deepEqual(saved, old); assert.equal(await page.$('#guided-response'), null);
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).text, draftKey), staleDraft.text);
      const failedCommand = requests.find(request => request.endpoint.endsWith('/interview/reset') && request.method === 'POST').command;
      scenario.resetFailure = false; await dialogClick('Retry'); await guidedReady();
      assert.equal(await page.$eval('[data-testid="guided-current-question"]', el => el.textContent), firstQuestion);
      assert.notEqual(saved.id, old.id); assert.ok(saved.version > old.version); assert.equal(saved.turns.length, 0);
      const resetPosts = requests.filter(request => request.endpoint.endsWith('/interview/reset') && request.method === 'POST');
      assert.equal(resetPosts.length, 2); assert.deepEqual(resetPosts[1].command, failedCommand, 'uncertain resets retry the exact receipt rather than clear twice');
      assert.equal(await page.$eval('#guided-response', el => el.value), '');
      assert.ok(await page.evaluate((key, id) => !JSON.parse(localStorage.getItem(key) || 'null')?.text && !localStorage.getItem('interviewDraft:' + id) && !localStorage.getItem('folio.interview.qcache.flat.' + id) && !sessionStorage.getItem('folio.interview.validation.' + id), draftKey, projectId));
      const newSessionId = saved.id, firstId = saved.activeQuestionId;
      await click('Pause & close'); await storyReady(); await page.reload(); await storyReady();
      await page.evaluate((key, value) => localStorage.setItem(key, JSON.stringify(value)), draftKey, staleDraft);
      const beforeResume = requests.length;
      await click('Resume interview'); await guidedReady();
      assert.equal(saved.id, newSessionId); assert.equal(saved.activeQuestionId, firstId); assert.equal(saved.turns.length, 0);
      assert.equal(await page.$eval('#guided-response', el => el.value), '');
      assert.ok(!requests.slice(beforeResume).some(request => request.command?.requestId === staleDraft.pending.requestId), 'a stale local pending request is discarded before transport');
      assert.equal(requests.filter(request => request.endpoint.endsWith('/interview/reset') && request.method === 'POST').length, 2);
      await click('Pause & close'); await storyReady();
      const unboundDraft = structuredClone(staleDraft); delete unboundDraft.sessionId; delete unboundDraft.pending.sessionId;
      unboundDraft.pending.requestId = 'old-unbound-pending-response';
      await page.evaluate((key, value) => localStorage.setItem(key, JSON.stringify(value)), draftKey, unboundDraft);
      const beforeUnboundResume = requests.length;
      await click('Resume interview'); await guidedReady();
      assert.equal(await page.$eval('#guided-response', el => el.value), '', 'a pre-feature local draft from old question IDs cannot survive reset');
      assert.ok(!requests.slice(beforeUnboundResume).some(request => request.command?.requestId === unboundDraft.pending.requestId), 'unbound stale recovery is discarded before transport');
      assert.equal(saved.turns.length, 0);
    });
    await capture('A delayed reset acknowledgement preserves a new-session draft written by another tab', async () => {
      await open('story', { saved: true, holdReset: true }); await storyReady();
      const held = new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('The reset HTTP response was not held')), 6000); resetHeldSignal = () => { clearTimeout(timeout); resolve(); }; });
      await click('Start over'); await dialogClick('Clear answers and start over'); await held;
      assert.ok(heldResetResponse); assert.equal(saved.turns.length, 0);
      const freshText = 'A new-session answer drafted in another tab.';
      await page.evaluate((key, session, text) => localStorage.setItem(key, JSON.stringify({ sessionId: session.id, resetId: session.resetId, questionId: session.activeQuestionId, text, inputModality: 'text', pending: null })), draftKey, saved, freshText);
      heldResetResponse(); await guidedReady();
      assert.equal(await page.$eval('#guided-response', el => el.value), freshText, 'late cleanup cannot erase work bound to the new session');
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).text, draftKey), freshText);
      assert.equal(requests.filter(request => request.endpoint.endsWith('/interview/reset') && request.method === 'POST').length, 1);
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
    await capture('Legacy recovery rejects pre-reset unbound drafts and preserves drafts bound to the current reset', async () => {
      const fresh = { questionId: 'legacy-question', prompt: 'Legacy fixture question?', answer: 'Fresh answer written after reset.', roomId: 'project', role: 'DESIGNER', section: 'what' };
      for (const matching of [false, true]) {
        const text = matching ? 'Current local edit to retain.' : 'Removed answer from before reset.';
        await open('modal', { guidedStatus: 404, resetId: 'current-reset', answers: [fresh], legacyDraft: {
          ...(matching ? { resetId: 'current-reset' } : {}), answers: [{ ...fresh, answer: text }], followups: [], currentQuestionIndex: 0, phase: 'question', roomStatuses: {}, answerModality: {}, answerRoomIds: {},
        } });
        await page.waitForFunction((id, expected) => {
          const draft = JSON.parse(localStorage.getItem('interviewDraft:' + id) || 'null');
          return draft?.resetId === 'current-reset' && draft.answers?.some(answer => answer.answer === expected);
        }, {}, projectId, matching ? text : fresh.answer);
        assert.ok(!(await page.evaluate(id => localStorage.getItem('interviewDraft:' + id), projectId)).includes('Removed answer from before reset.'));
      }
    });
    for (const setup of [{ guidedStatus: 503 }, { invalidGuided: true }]) await capture('Unverified guided availability fails closed: ' + JSON.stringify(setup), async () => {
      await open('modal', setup); await page.waitForFunction(() => document.body.textContent.includes('Unable to restore interview access'));
      assert.equal(await page.$('#guided-response'), null); assert.ok(!requests.some(request => request.endpoint.endsWith('/interview/questions') || request.command));
    });
    for (const enabled of [false, true]) await capture('Protected spotlight takes precedence when enabled=' + enabled, async () => {
      await open('modal&restart=1', { enrolled: true, enabled });
      await page.waitForFunction(enabled => document.body.textContent.includes(enabled ? 'Private spotlight interview' : 'Private interviews are paused'), {}, enabled);
      noGuidedCalls(); assert.equal(await page.$('#guided-response'), null);
      assert.ok(!requests.some(request => request.endpoint.endsWith('/interview/reset')), 'spotlight protection precedes any ordinary restart');
    });
    const report = JSON.stringify({ baseline, baselineCommit, selectedCase, fixture: 'Actual Tracker → Story → InterviewModal → GuidedInterviewWorkspace and protected interview components; synthetic Next navigation/image/dynamic and loopback HTTP responses, pure guided controller, no AI or database. No deployed/authenticated Next server verification.', results }, null, 2);
    fs.writeFileSync(path.join(out, 'results.json'), report);
    fs.writeFileSync(path.join(reviewOut, baseline ? selectedCase ? 'reset-baseline-results.json' : 'entry-baseline-results.json' : 'entry-results.json'), report);
    console.log(`${results.filter(result => result.status === 'pass').length}/${results.length} entry regressions passed (${baseline ? 'committed baseline' : 'working tree'}).`);
    if (results.some(result => result.status === 'fail')) process.exitCode = 1;
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

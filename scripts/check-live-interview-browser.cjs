// Actual panel/capture helper in Chromium. Daily, recorder bytes and HTTP are synthetic.
// Loopback only; no app env, credentials, production records, microphone or camera.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const puppeteer = require('puppeteer-core');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.tmp/live-browser');
const results = [];
let starts = 0, enabled = true, eventCalls = [], actionCalls = [], uploadFailure = false, runNumber = 0;
let draftScope = 'a'.repeat(64), liveOwnerScope = null, recordingEnabled = true;
const startRequests = [], textRegistrations = [], providerReplies = [];
const startResponses = [];
let canonicalTextSaves = 0;
let failStart = false;
let limitStart = false;
let loseStartResponse = false, restoredSession = null;
let holdPause = false, releasePause = null, pauseObserved = null;
let heldProviderEvent = null, releaseProviderEvent = null, providerEventObserved = null;
let failedProviderSequence = null;
let holdStarts = false, startHeld = null;
const heldStarts = [];
const startReceipts = new Map();
const liveSessions = new Map();
const runs = new Map();
const deniedRuns = new Set();
const captureRequests = [];
const storageUploads = [];
const source = { kind: 'project', id: 'synthetic-project' };
const snapshot = { source, interviewId: 'canonical-fixture', version: 'v1', status: 'active', currentQuestion: { id: 'q1', text: 'What shaped this room?', sourceImageIds: [] }, sourceRefs: [] };
let live = null;
const entry = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {LiveInterviewPanel} from './src/components/interviews/LiveInterviewPanel';
import * as capture from './src/lib/live-interview/capture';
window.capture=capture; window.permissionDenied=false; window.holdMicrophone=false; window.permissions=[]; window.trackClones=[];
window.dailyCalls=[];window.respondMessages=[];window.activeChanges=[];window.canonicalChanges=[];
window.makeStream=()=>{const audio=new AudioContext(); const destination=audio.createMediaStreamDestination();
 const original=destination.stream.getAudioTracks()[0]; const clone=original.clone.bind(original);
 original.clone=()=>{const track=clone();window.trackClones.push(track);return track};return destination.stream;};
Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async options=>{window.permissions.push(options); if(window.permissionDenied)throw new Error('Microphone permission denied.');if(options.video){if(window.cameraDenied)throw new Error('Synthetic camera permission denied.');const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;canvas.getContext('2d').fillRect(0,0,1280,720);return canvas.captureStream(24);}if(window.holdMicrophone)await new Promise(resolve=>{window.resolveMicrophone=resolve});return window.makeStream();}}});
class Recorder{static instances=[];static isTypeSupported(type){return type.startsWith('audio/webm')||type.startsWith('video/webm')};
 constructor(stream,options){this.stream=stream;this.mimeType=options.mimeType;this.state='inactive';Recorder.instances.push(this)}
 start(){this.audioEnabledAtStart=this.stream.getAudioTracks().map(track=>track.enabled);this.state='recording'} emit(value){this.ondataavailable?.({data:new Blob([value],{type:this.mimeType})})}
 stop(){if(this.state==='inactive')return;this.state='inactive';setTimeout(()=>{this.emit('final');this.onstop?.()},35)}}
window.MediaRecorder=Recorder; window.Recorder=Recorder;
window.progress=[]; window.captureProgress=(...args)=>window.progress.push(args);
window.recoveryData=async()=>{const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('folio-private-live-capture',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
 try{return await new Promise((resolve,reject)=>{const tx=db.transaction(['runs','chunks']);const runs=tx.objectStore('runs').getAll();const chunks=tx.objectStore('chunks').getAll();
 tx.oncomplete=()=>resolve({runs:runs.result,chunks:chunks.result.map(chunk=>({runId:chunk.runId,index:chunk.index,bytes:chunk.blob.size}))});tx.onerror=()=>reject(tx.error)})}finally{db.close()}};
window.seedRecovery=async records=>{const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('folio-private-live-capture',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
 try{await new Promise((resolve,reject)=>{const tx=db.transaction(['runs','chunks'],'readwrite');for(const {run,chunks} of records){tx.objectStore('runs').put(run);for(const [index,text] of chunks.entries())tx.objectStore('chunks').put({runId:run.runId,index,blob:new Blob([text],{type:run.mimeType})})}tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}finally{db.close()}};
window.fixtureRoot=createRoot(document.getElementById('root'));
window.renderDirect=(key='direct',id='synthetic-project')=>window.fixtureRoot.render(<React.StrictMode><LiveInterviewPanel key={key} source={{kind:'project',id}} startIntent={window.entryIntent} presentation="primary" onActiveChange={value=>window.activeChanges.push(value)} onCanonicalChange={value=>window.canonicalChanges.push(value)}/></React.StrictMode>);
window.renderGuide=(step='story')=>window.fixtureRoot.render(<LiveInterviewPanel key="guide-recording" source={{kind:'project_guide',id:'synthetic-project'}} startIntent={window.entryIntent} presentation="primary" recordingSetup={step==='story'} callStage={step==='story'} workspaceStep={step}/>);
window.fixtureRoot.render(<LiveInterviewPanel source={{kind:'project',id:'synthetic-project'}} presentation="primary" onActiveChange={value=>window.activeChanges.push(value)} onCanonicalChange={value=>window.canonicalChanges.push(value)} onControlsReady={value=>window.panelControls=value}/>);`;
const dailyFixture = `export default {createCallObject(options){window.dailyOptions=options;const handlers={};const call={
 leaveCount:0,destroyCount:0,emit(name,event){for(const handler of handlers[name]||[])handler(event)},
 on(name,handler){(handlers[name]??=[]).push(handler);return call},participants(){return{}},async join(){if(window.failJoin)throw Error('Synthetic join failed');if(window.holdJoin)await new Promise((resolve,reject)=>{window.resolveJoin=resolve;window.rejectJoin=reject});if(!call.leaveCount){window.joined=true;window.left=false;window.destroyed=false}},
 setLocalAudio(value){window.micOn=value;return call},async setInputDevicesAsync(input){Object.assign(window.dailyOptions,input)},
 sendAppMessage(message,target){window.respondMessages.push({message,target});void fetch('/api/fixture/provider-respond',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(message)})},
 async leave(){call.leaveCount++;window.left=true;call.emit('left-meeting')},async destroy(){call.destroyCount++;window.destroyed=true}};
 window.dailyCalls.push(call);
 window.dailyCall=call;window.emitProvider=data=>(handlers['app-message']||[]).forEach(fn=>fn({data}));return call}};`;

function completeTypedReplies() {
  for (const reply of providerReplies) {
    const turn = live?.turns.find(turn => turn.inputMode === 'text' && turn.raw === reply.properties.text && turn.status === 'awaiting_final');
    if (!turn) continue;
    turn.status = 'saved'; turn.response = 'What was the next design decision?'; canonicalTextSaves++;
    live.snapshot = { ...live.snapshot, version: 'v' + (canonicalTextSaves + 1), currentQuestion: { id: 'q' + (canonicalTextSaves + 1), text: turn.response, sourceImageIds: [] } };
  }
}

async function build() {
  fs.mkdirSync(out, { recursive: true });
  await esbuild.build({ stdin: { contents: entry, resolveDir: root, sourcefile: 'live-fixture.tsx', loader: 'tsx' }, bundle: true,
    outfile: path.join(out, 'app.js'), platform: 'browser', jsx: 'automatic', alias: { '@': path.join(root, 'src') },
    define: { 'process.env.NODE_ENV': '"test"' }, plugins: [{ name: 'fake-daily', setup(build) {
      if (process.env.LIVE_BROWSER_SOURCE_REF) build.onLoad({ filter: /LiveInterviewPanel\.tsx$/ }, args => ({
        contents: execFileSync('git', ['show', process.env.LIVE_BROWSER_SOURCE_REF + ':' + path.relative(root, args.path).replaceAll('\\', '/')], { cwd: root, encoding: 'utf8' }), loader: 'tsx', resolveDir: path.dirname(args.path),
      }));
      build.onResolve({ filter: /^@daily-co\/daily-js$/ }, () => ({ path: 'daily', namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: dailyFixture, loader: 'js' }));
    } }] });
  const config = require(path.join(root, 'tailwind.config.js'));
  config.content = [path.join(root, 'src/components/interviews/LiveInterviewPanel.tsx')];
  const globals = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  const css = (await postcss([tailwind(config)]).process(globals, { from: path.join(root, 'src/app/globals.css') })).css;
  fs.writeFileSync(path.join(out, 'app.css'), css + '\n:root{--font-headline:Georgia;--font-body:Arial}');
}
function handler(req, res) {
  const url = new URL(req.url, 'http://fixture');
  const json = (value, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  if (url.pathname === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); fs.createReadStream(path.join(out, 'app.js')).pipe(res); return; }
  if (url.pathname === '/app.css') { res.setHeader('Content-Type', 'text/css'); fs.createReadStream(path.join(out, 'app.css')).pipe(res); return; }
  if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/storage/')) { res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><main id="root" style="max-width:520px;margin:auto"></main><script src="/app.js"></script></body></html>'); return; }
  if (req.method === 'GET' && url.pathname === '/api/live-interviews') return json({ enabled, recordingEnabled, draftScope });
  if (req.method === 'GET' && url.pathname.startsWith('/api/live-interviews/')) return liveOwnerScope === draftScope ? json(restoredSession || liveSessions.get(url.pathname.split('/').at(-1)) || live) : json({ error: 'Session unavailable' }, 404);
  const chunks = []; req.on('data', part => chunks.push(part)); req.on('end', () => {
    try {
      if (url.pathname.startsWith('/storage/')) {
        if (uploadFailure) { uploadFailure = false; return json({ error: 'Synthetic network interruption' }, 503); }
        const [, , runId, index] = url.pathname.split('/'); const run = runs.get(runId);
        storageUploads.push({ runId, index: Number(index) });
        run.chunks[Number(index)].body = Buffer.concat(chunks); return json({ ok: true });
      }
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      if (url.pathname === '/api/fixture/provider-respond') { providerReplies.push(body); return json({ retained: true }); }
      if (url.pathname === '/api/live-interviews') {
        const reply = value => { if (holdStarts) { heldStarts.push(() => json(value)); startHeld?.(); return; } return json(value); };
        if(limitStart) return json({message:'Daily allowance used. Continue in the step-by-step workspace.',code:'LIVE_DAILY_LIMIT',retryAt:new Date(Date.now()+60000).toISOString()},429);
        starts++; startRequests.push(body); if(failStart)return json({message:'Synthetic start failed. Retry this interview.'},503);
        if (startResponses.length) {
          liveOwnerScope = draftScope; live = structuredClone(startResponses.shift()); startReceipts.set(body.requestId, live); liveSessions.set(live.id, live); return reply(live);
        }
        const prior = startReceipts.get(body.requestId);
        if (prior) return reply(prior.status === 'ended' ? { ...prior, join: undefined } : prior);
        liveOwnerScope = draftScope; live = { id: 'live-fixture', status: 'active', snapshot: structuredClone(snapshot), turns: [], recordingEnabled,
          join: { url: 'https://synthetic.daily.co/fixture', token: 'synthetic-join-token', conversationId: 'synthetic-conversation' } };
        startReceipts.set(body.requestId,live);
        liveSessions.set(live.id, live);
        if (loseStartResponse) { loseStartResponse=false; return json({message:'Synthetic create response lost.'},503); }
        return reply(live);
      }
      if (url.pathname.startsWith('/api/live-interviews/')) {
        const session = liveSessions.get(url.pathname.split('/').at(-1)) || live;
        actionCalls.push(body.action);
        if(body.action==='consent_recording') { assert.equal(body.consent,true);session.consent={mode:body.mode};return json(session); }
        if (body.action === 'event') {
          eventCalls.push(body.event);
          if (heldProviderEvent) {
            const response = structuredClone(session), fails = heldProviderEvent === 'failure'; heldProviderEvent = null;
            releaseProviderEvent = () => json(fails ? { message: 'Synthetic old event failed.' } : response, fails ? 503 : 200);
            providerEventObserved?.(); return;
          }
          if (body.event.seq === failedProviderSequence) return json({ message: 'Synthetic old event failed.' }, 503);
        }
        if (body.action === 'prepare_text') {
          textRegistrations.push(body);
          const prior = session.turns.find(turn => turn.requestId === body.requestId);
          if (!prior) session.turns.push({ position: session.turns.length + 1, requestId: body.requestId, raw: body.text, inputMode: 'text', status: 'awaiting_final', questionId: body.questionId, receipt: 'synthetic-' + body.requestId });
          return json({ ...session, textRegistration: { created: !prior, requestId: body.requestId } });
        }
        if (['end', 'pause', 'switch_to_text'].includes(body.action)) {
          if (!['uncertain', 'starting', 'reconciling'].includes(session.status)) session.status = 'ended';
          for (const turn of session.turns) if (turn.status === 'awaiting_final' && turn.inputMode === 'text') { turn.status = 'needs_review'; turn.error = 'Your typed answer is retained. Review it before continuing.'; }
        }
        if (body.action === 'pause' && holdPause) { releasePause = () => json(session); pauseObserved?.(); return; }
        return json(session);
      }
      if (url.pathname === '/api/interview-media/capture') {
        captureRequests.push(body);
        if (body.action === 'start') {
          const runId = `run-${++runNumber}`; runs.set(runId, { chunks: [], status: 'recording', ...body });
          return json({ runId, maxChunkBytes: 5 * 1024 * 1024 });
        }
        const run = runs.get(body.runId); assert.ok(run, 'capture run must exist');
        if (deniedRuns.has(body.runId)) return json({ error: 'Synthetic authorization denied' }, 403);
        if (body.action === 'chunk') {
          assert.ok(body.bytes <= 5 * 1024 * 1024); assert.ok(body.index <= run.chunks.length, 'ordered reservations');
          run.chunks[body.index] ??= { bytes: body.bytes };
          return json({ signedUrl: `http://${req.headers.host}/storage/${body.runId}/${body.index}` });
        }
        if (body.action === 'ack') {
          const chunk = run.chunks[body.index];
          if (!chunk?.body) return json({ error: 'Missing upload' }, 409);
          assert.equal(chunk.bytes, chunk.body.length); return json({ saved: true });
        }
        if (body.action === 'finalize') {
          assert.equal(body.chunkCount, run.chunks.length); assert.ok(run.chunks.every(chunk => chunk.body));
          run.status = 'processing'; run.durationMs = body.durationMs; return json({ state: 'processing' });
        }
        if (body.action === 'incomplete') { run.status = 'incomplete'; return json({ state: 'incomplete' }); }
      }
      json({ error: 'Unexpected fixture API' }, 404);
    } catch (error) { json({ error: error.message }, 500); }
  });
}
async function main() {
  await build();
  const server = http.createServer(handler); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const executablePath = process.env.GUIDED_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(file => fs.existsSync(file));
  assert.ok(executablePath, 'Chromium is required for the real IndexedDB capture checks.');
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage(); const errors = [];
  if (process.env.LIVE_BROWSER_CHECK) page.setDefaultTimeout(5000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true); page.on('request', request => request.url().startsWith(base) || request.url().startsWith('data:') ? request.continue() : request.abort());
  const check = async (name, test) => { if (process.env.LIVE_BROWSER_CHECK && !name.includes(process.env.LIVE_BROWSER_CHECK)) return; await test(); results.push(name); console.log(`PASS ${name}`); };
  const click = async text => {
    for (const button of await page.$$('button')) if ((await button.evaluate(el => el.textContent)).trim() === text) { await button.click(); return; }
    throw new Error(`Missing button ${text}`);
  };
  const text = value => page.waitForFunction(value => document.body.innerText.includes(value), {}, value);
  const callReady = () => page.waitForFunction(() => window.joined && window.dailyOptions && !window.left && !window.destroyed
    && [...document.querySelectorAll('button')].some(button => button.textContent === 'End' && !button.disabled && button.getBoundingClientRect().height > 0));
  const callEnded = () => page.waitForFunction(() => window.left && window.destroyed
    && [...document.querySelectorAll('button')].some(button => ['Start with typed replies', 'Resume live interview'].includes(button.textContent) && !button.disabled && button.getBoundingClientRect().height > 0));
  const fillReply = value => page.$eval('textarea', (element, value) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  const freshPanel = async () => {
    recordingEnabled = false; restoredSession = null; startResponses.length = 0;
    await page.evaluate(() => sessionStorage.clear()); await page.reload(); await text('Start live interview');
  };
  const savedProgress = (status = 'active') => ({ id: 'live-fixture', status, recordingEnabled: false,
    snapshot: { ...structuredClone(snapshot), version: 'saved-room-story', currentQuestion: { id: 'q-next', text: 'How did you choose the materials?', sourceImageIds: [] } },
    turns: [{ position: 1, status: 'saved', raw: 'The existing doorway set the proportions.', questionId: 'q1', receipt: 'saved-room-answer' }],
    ...(status === 'active' ? { join: { url: 'https://synthetic.daily.co/fixture', token: 'synthetic-join-token', conversationId: 'synthetic-conversation' } } : {}),
  });
  const flushEvents = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  try {
    await page.goto(base); await text('Start live interview');
    await check('page load neither opens microphone nor creates paid session', async () => {
      assert.equal(starts, 0); assert.equal(await page.evaluate(() => window.permissions.length), 0);
    });
    await check('microphone denial prevents provider creation', async () => {
      await page.evaluate(() => { window.permissionDenied = true; }); await click('Start live interview'); await text('Microphone permission denied.'); assert.equal(starts, 0);
      await page.evaluate(() => { window.permissionDenied = false; });
    });
    await check('recording requires separate explicit consent', async () => {
      await page.click('input[value="audio"]');
      assert.equal(await page.$$eval('button', buttons => buttons.find(b => b.textContent === 'Start live interview').disabled), true);
      assert.equal(runNumber, 0); await page.click('input[value="none"]');
    });
    await check('explicit no-recording start joins once and keeps camera off', async () => {
      await click('Start live interview'); await callReady(); assert.equal(starts, 1); assert.equal(runNumber, 0);
      assert.equal(await page.evaluate(() => window.dailyOptions.videoSource), false);
      assert.equal(await page.evaluate(() => window.permissions.at(-1).video), false);
    });
    await check('partial captions never ingest answers; duplicate PAL events normalized', async () => {
      await page.evaluate(() => window.emitProvider({ message_type: 'conversation', event_type: 'conversation.utterance.streaming', properties: { role: 'pal', speech: 'A provisional caption' } }));
      await text('A provisional caption'); assert.equal(eventCalls.length, 0);
      await page.evaluate(() => {
        for (const role of ['pal', 'replica']) window.emitProvider({ message_type: 'conversation', event_type: 'conversation.stopped_speaking', seq: 7, inference_id: 'inference-1', properties: { role, interrupted: false } });
      });
      await page.waitForFunction(() => !!window.joined); await new Promise(resolve => setTimeout(resolve, 150));
      assert.equal(eventCalls.length, 1); assert.equal(eventCalls[0].properties.role, 'pal'); assert.equal(eventCalls[0].conversation_id, 'synthetic-conversation');
    });
    await check('one caption surface and real speaking events drive the call display without another session', async () => {
      const before=starts;
      const status=()=>page.$eval('[data-testid="host-call-stage"] [role=status]',node=>node.textContent);
      assert.equal(await status(),'Connected');
      assert.equal(await page.$$eval('[aria-label="Conversation captions"]',nodes=>nodes.length),1);
      assert.equal(await page.evaluate(()=>document.body.innerText.includes('awaiting canonical save')),false);
      await click('Captions');assert.equal(await page.$('[aria-label="Conversation captions"]'),null);
      await click('Captions');await text('A provisional caption');
      await click('Mute microphone');await text('Microphone muted');
      assert.equal(await page.evaluate(()=>window.dailyOptions.audioSource.enabled),false);
      await click('Unmute microphone');assert.equal(await status(),'Connected');
      const speaking=async(type,role,seq,conversation_id='synthetic-conversation')=>page.evaluate(data=>window.emitProvider(data),{message_type:'conversation',event_type:'conversation.'+type,conversation_id,seq,properties:{role}});
      await speaking('started_speaking','replica',100);await text('Host speaking');
      await speaking('started_speaking','user',101,'another-conversation');assert.equal(await status(),'Host speaking');
      await speaking('started_speaking','user',102);await text('Listening to you');
      await speaking('stopped_speaking','pal',103);assert.equal(await status(),'Listening to you');
      await speaking('stopped_speaking','user',104);await page.waitForFunction(()=>document.querySelector('[data-testid="host-call-stage"] [role=status]').textContent==='Connected');
      assert.equal(starts,before);
    });
    await check('Type instead releases the microphone and keeps the same call and avatar visible', async () => {
      const before = await page.evaluate(() => { window.voiceTrack = window.dailyOptions.audioSource; window.avatarElement = document.querySelector('video[aria-label="Folio AI interviewer"]'); return { calls: window.dailyCalls.length, permissions: window.permissions.length }; });
      await click('Type instead'); await text('Microphone off · your interviewer still speaks');
      await page.waitForFunction(() => window.dailyOptions.audioSource === false);
      assert.deepEqual(await page.evaluate(() => ({ calls: window.dailyCalls.length, permissions: window.permissions.length })), before);
      assert.equal(await page.evaluate(() => window.voiceTrack.readyState), 'ended');
      assert.equal(await page.evaluate(() => window.micOn), false);
      assert.equal(await page.evaluate(() => !!window.left || !!window.destroyed), false);
      assert.equal(await page.evaluate(() => window.avatarElement === document.querySelector('video[aria-label="Folio AI interviewer"]') && window.avatarElement.getBoundingClientRect().height > 0), true);
      assert.equal(actionCalls.includes('switch_to_text'), false);
    });
    await check('typed replies register once, send exactly conversation.respond, and clear only after canonical confirmation', async () => {
      const reply = 'The doorway set the rhythm of the whole room.';
      const before = { registrations: textRegistrations.length, replies: providerReplies.length, saves: canonicalTextSaves };
      await fillReply(reply);
      const delivered = page.waitForResponse(response => response.url().endsWith('/api/fixture/provider-respond'));
      await page.$eval('form', form => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
      await delivered;
      assert.equal(textRegistrations.length, before.registrations + 1);
      assert.equal(providerReplies.length, before.replies + 1);
      assert.deepEqual(await page.evaluate(() => window.respondMessages.at(-1)), { message: { message_type: 'conversation', event_type: 'conversation.respond', conversation_id: 'synthetic-conversation', properties: { text: reply } }, target: '*' });
      assert.equal(await page.$eval('textarea', element => element.value), reply);
      assert.equal(await page.$eval('textarea', element => element.disabled), true);
      assert.equal(live.turns.at(-1).status, 'awaiting_final'); assert.equal(canonicalTextSaves, before.saves);
      completeTypedReplies(); completeTypedReplies();
      await page.waitForFunction(() => document.querySelector('textarea')?.value === '' && !document.querySelector('textarea')?.disabled);
      assert.equal(canonicalTextSaves, before.saves + 1);
      assert.equal(live.turns.at(-1).raw, reply);
      assert.equal(await page.$eval('[aria-label="Conversation captions"]',node=>node.textContent),live.snapshot.currentQuestion.text,'a new canonical question replaces stale captions');
      assert.equal(await page.evaluate(scope => sessionStorage.getItem('folio.live.text.v1.' + scope), draftScope), null);
    });
    await check('unsent text stays bound to its original question and blocks microphone re-entry', async () => {
      const reply = 'This answer belongs to the question I started with.';
      const original = structuredClone(live.snapshot);
      await fillReply(reply);
      assert.equal(await page.$$eval('button', buttons => buttons.find(button => button.textContent === 'Use microphone instead').disabled), true);
      live.snapshot = { ...live.snapshot, version: 'v3', currentQuestion: { id: 'q3', text: 'A different question from another tab.', sourceImageIds: [] } };
      await text('This draft was written for:');
      assert.equal(await page.$eval('textarea', element => element.value), reply);
      assert.equal(await page.$eval('button[type="submit"]', element => element.disabled), true);
      const registered = textRegistrations.length;
      await page.$eval('form', form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      await text('The question changed while you were typing.');
      assert.equal(textRegistrations.length, registered);
      const retained = await page.evaluate(scope => JSON.parse(sessionStorage.getItem('folio.live.text.v1.' + scope)), draftScope);
      assert.equal(retained.questionId, original.currentQuestion.id); assert.equal(retained.version, original.version);
      await click('Use this draft for the current question');
      assert.equal(await page.$eval('button[type="submit"]', element => element.disabled), false);
      assert.equal(await page.evaluate(scope => JSON.parse(sessionStorage.getItem('folio.live.text.v1.' + scope)).questionId, draftScope), 'q3');
      await click('Clear unsent reply');
      assert.equal(await page.$eval('textarea', element => element.value), '');
    });
    await check('voice re-entry requests consent; denial keeps the typed call available', async () => {
      const before = await page.evaluate(() => ({ calls: window.dailyCalls.length, permissions: window.permissions.length }));
      await page.evaluate(() => { window.permissionDenied = true; });
      await click('Use microphone instead'); await text('Microphone permission denied.');
      assert.equal(await page.evaluate(() => window.permissions.length), before.permissions + 1);
      assert.equal(await page.evaluate(() => window.dailyCalls.length), before.calls);
      assert.equal(await page.evaluate(() => !!window.left || !!window.destroyed || window.micOn), false);
      assert.ok(await page.$('textarea'));
      await page.evaluate(() => { window.permissionDenied = false; });
      await click('Use microphone instead'); await text('Mute microphone');
      assert.equal(await page.evaluate(() => window.permissions.length), before.permissions + 2);
      assert.equal(await page.evaluate(() => window.dailyCalls.length), before.calls);
      assert.equal(await page.evaluate(() => window.micOn), true);
      assert.equal(await page.$('form textarea'), null);
    });
    await check('microphone permission loss ends the call and releases resources', async () => {
      await page.waitForFunction(()=>window.dailyOptions.audioSource.readyState==='live');
      await page.evaluate(()=>window.dailyOptions.audioSource.dispatchEvent(new Event('ended')));
      await text('Microphone access ended. The call stopped');
      assert.ok(actionCalls.includes('pause'));assert.equal(await page.evaluate(()=>window.dailyOptions.audioSource.readyState),'ended');
    });
    await check('explicit typed start creates no microphone or recording and End still releases the call', async () => {
      recordingEnabled = false;
      await page.evaluate(() => sessionStorage.clear()); await page.reload(); await text('Start live interview');
      await page.setViewport({ width: 1280, height: 900 });
      await page.screenshot({ path: path.join(out, 'primary-entry-desktop.png'), fullPage: true });
      const before = { starts, captures: runNumber };
      await click('Type instead'); await text('Start with typed replies');
      assert.equal(starts, before.starts); assert.equal(await page.evaluate(() => window.permissions.length), 0);
      await click('Start with typed replies'); await callReady(); await text('Microphone off · your interviewer still speaks');
      assert.equal(starts, before.starts + 1); assert.equal(runNumber, before.captures);
      assert.equal(await page.evaluate(() => window.permissions.length), 0);
      assert.equal(await page.evaluate(() => window.dailyOptions.audioSource), false);
      assert.equal(startRequests.at(-1).inputMode, 'text'); assert.equal(startRequests.at(-1).microphoneReady, false);
      const desktop = await page.$eval('video[aria-label="Folio AI interviewer"]', element => ({ width: element.getBoundingClientRect().width, parent: element.closest('section').getBoundingClientRect().width }));
      assert.ok(desktop.width >= desktop.parent - 40, JSON.stringify(desktop));
      await page.screenshot({ path: path.join(out, 'primary-typed-desktop.png'), fullPage: true });
      await page.setViewport({ width: 390, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const mobile = await page.$eval('video[aria-label="Folio AI interviewer"]', element => ({ width: element.getBoundingClientRect().width, parent: element.closest('section').getBoundingClientRect().width }));
      assert.ok(mobile.width >= mobile.parent - 40, JSON.stringify(mobile));
      await page.screenshot({ path: path.join(out, 'primary-typed-mobile.png'), fullPage: true });
      await click('End'); await callEnded();
      assert.equal(actionCalls.at(-1), 'end');
    });
    await check('restored unsent text never auto-joins or resends; unresolved submitted text remains retained', async () => {
      await click('Start with typed replies'); await callReady(); await text('Microphone off · your interviewer still speaks');
      const reply = 'Restore this draft without sending it for me.';
      await fillReply(reply);
      const before = { starts, replies: providerReplies.length, registrations: textRegistrations.length };
      await page.reload(); await text('Start with typed replies');
      assert.equal(starts, before.starts); assert.equal(providerReplies.length, before.replies);
      assert.equal(await page.evaluate(() => window.permissions.length), 0);
      await click('Start with typed replies'); await callReady(); await text('Microphone off · your interviewer still speaks');
      assert.equal(await page.$eval('textarea', element => element.value), reply);
      const delivered = page.waitForResponse(response => response.url().endsWith('/api/fixture/provider-respond'));
      await click('Send reply'); await delivered;
      assert.equal(textRegistrations.length, before.registrations + 1);
      assert.equal(providerReplies.length, before.replies + 1);
      const pendingStarts = starts;
      await page.reload(); await text('Review this answer');
      assert.equal(starts, pendingStarts); assert.equal(providerReplies.length, before.replies + 1);
      assert.equal(textRegistrations.length, before.registrations + 1);
      assert.equal(live.turns.at(-1).status, 'needs_review'); assert.equal(live.turns.at(-1).raw, reply);
      assert.equal(await page.evaluate(scope => JSON.parse(sessionStorage.getItem('folio.live.text.v1.' + scope)).text, draftScope), reply);
    });
    await check('draft restoration is isolated to the account authorized by availability', async () => {
      const originalScope = draftScope;
      const retained = await page.evaluate(scope => sessionStorage.getItem('folio.live.text.v1.' + scope), originalScope);
      assert.ok(retained);
      draftScope = 'b'.repeat(64);
      const before = starts;
      await page.reload(); await text('Start live interview');
      assert.equal(starts, before);
      assert.equal(await page.evaluate(() => document.body.textContent.includes('Restore this draft without sending it for me.')), false);
      assert.equal(await page.evaluate(scope => sessionStorage.getItem('folio.live.text.v1.' + scope), originalScope), retained);
      assert.equal(await page.evaluate(scope => sessionStorage.getItem('folio.live.text.v1.' + scope), draftScope), null);
      draftScope = originalScope;
      await page.reload(); await text('Review this answer');
      assert.equal(await page.evaluate(scope => JSON.parse(sessionStorage.getItem('folio.live.text.v1.' + scope)).text, draftScope), JSON.parse(retained).text);
    });
    await check('a previous reply confirmed after End is cleared before starting another call', async () => {
      const turn = live.turns.at(-1); turn.status = 'saved'; turn.response = 'The late save is confirmed.';
      live.snapshot = { ...live.snapshot, version: 'late-confirmed' };
      const replies = providerReplies.length;
      await click('Start with typed replies'); await callReady(); await text('Microphone off · your interviewer still speaks');
      await page.waitForFunction(() => document.querySelector('textarea')?.value === '' && !document.querySelector('textarea')?.disabled);
      assert.equal(providerReplies.length, replies);
      assert.equal(await page.evaluate(scope => sessionStorage.getItem('folio.live.text.v1.' + scope), draftScope), null);
      await click('End'); await callEnded();
    });
    await check('failed recording upload during Type instead preserves the call and resets the next start to no recording', async () => {
      recordingEnabled = true;
      await page.reload(); await text('Resume live interview');
      await page.click('input[value="audio"]'); await page.click('input[type="checkbox"]');
      await click('Resume live interview'); await callReady(); await text('Recording your voice');
      const before = await page.evaluate(() => ({ calls: window.dailyCalls.length, permissions: window.permissions.length }));
      const captures = runNumber;
      uploadFailure = true;
      await click('Type instead'); await text('Recording needs attention');
      await text('Microphone off · your interviewer still speaks');
      assert.equal(await page.evaluate(() => !!window.left || !!window.destroyed || window.micOn), false);
      assert.equal(await page.evaluate(() => window.dailyCalls.length), before.calls);
      assert.equal(await page.evaluate(() => window.dailyOptions.audioSource), false);
      await click('End'); await callEnded();
      await click('Start with typed replies'); await callReady(); await text('Microphone off · your interviewer still speaks');
      assert.equal(startRequests.at(-1).mode, 'none'); assert.equal(startRequests.at(-1).inputMode, 'text');
      assert.equal(await page.evaluate(() => window.permissions.length), before.permissions);
      assert.equal(runNumber, captures);
      await click('End'); await callEnded();
      await page.evaluate(() => window.capture.discardStoredCaptures('live-fixture'));
      recordingEnabled = false;
    });
    await check('an inactive unsent draft can be cleared without starting a call or microphone', async () => {
      await page.evaluate(scope => sessionStorage.setItem('folio.live.text.v1.' + scope, JSON.stringify({ text: 'Clear this before joining.', questionId: 'q1', version: 'v1', questionText: 'What shaped this room?' })), draftScope);
      const before = starts;
      await page.reload(); await text('Clear this before joining.');
      assert.ok(await page.$('[aria-label="Unsent typed reply"]'));
      await click('Clear unsent reply');
      assert.equal(starts, before); assert.equal(await page.evaluate(() => window.permissions.length), 0);
      assert.equal(await page.evaluate(scope => JSON.parse(sessionStorage.getItem('folio.live.text.v1.' + scope)).text, draftScope), '');
      assert.equal(await page.$('[aria-label="Unsent typed reply"]'), null);
    });
    await check('capture final chunk uploads before finalize; clones stop independently', async () => {
      const runId = await page.evaluate(async () => {
        window.original = window.makeStream();
        const capture = await window.capture.startCreatorCapture({ sessionId: 'flush', stream: window.original, mode: 'audio', offsetMs: 0, onProgress: window.captureProgress });
        window.Recorder.instances.at(-1).emit('first'); await capture.stop();
        return capture.runId;
      });
      const run = runs.get(runId); assert.equal(run.status, 'processing'); assert.equal(Buffer.concat(run.chunks.map(c => c.body)).toString(), 'firstfinal');
      assert.equal(await page.evaluate(() => window.original.getAudioTracks()[0].readyState), 'live');
      assert.equal(await page.evaluate(() => window.trackClones.at(-1).readyState), 'ended');
    });
    await check('initial mute is effective at recorder start and preserves source track state', async () => {
      const observed = await page.evaluate(async () => {
        const cases = [];
        for (const input of [{ sourceEnabled: true, initiallyMuted: true }, { sourceEnabled: false }, { sourceEnabled: true, initiallyMuted: false }]) {
          const stream = window.makeStream(); const original = stream.getAudioTracks()[0]; original.enabled = input.sourceEnabled;
          const capture = await window.capture.startCreatorCapture({ sessionId: 'initial-mute', stream, mode: 'audio', offsetMs: 0,
            onProgress: window.captureProgress, initiallyMuted: input.initiallyMuted });
          const recorder = window.Recorder.instances.at(-1);
          cases.push({ atStart: recorder.audioEnabledAtStart, originalEnabled: original.enabled });
          await capture.stop(); original.stop();
        }
        return cases;
      });
      assert.deepEqual(observed, [
        { atStart: [false], originalEnabled: true },
        { atStart: [false], originalEnabled: false },
        { atStart: [true], originalEnabled: true },
      ]);
    });
    await check('bounded chunks and upload backpressure stop recorder without dropping produced bytes', async () => {
      const runId = await page.evaluate(async () => {
        const capture = await window.capture.startCreatorCapture({ sessionId: 'backpressure', stream: window.makeStream(), mode: 'audio', offsetMs: 0, onProgress: window.captureProgress });
        const recorder = window.Recorder.instances.at(-1); recorder.emit(new Uint8Array(26 * 1024 * 1024));
        if (recorder.state !== 'inactive') throw new Error('Recorder failed to stop at queue limit');
        await capture.stop(); return capture.runId;
      });
      const run = runs.get(runId); assert.equal(run.status, 'processing'); assert.ok(run.chunks.every(c => c.bytes <= 5 * 1024 * 1024));
      assert.equal(run.chunks.reduce((n, c) => n + c.body.length, 0), 26 * 1024 * 1024 + 5);
    });
    await check('upload failure stops capture and retries same retained sequence', async () => {
      uploadFailure = true;
      await page.evaluate(async () => {
        window.failed = await window.capture.startCreatorCapture({ sessionId: 'retry', stream: window.makeStream(), mode: 'audio', offsetMs: 0, onProgress: window.captureProgress });
        window.Recorder.instances.at(-1).emit('retained');
      });
      await page.waitForFunction(() => window.progress.at(-1)?.[0] === 'incomplete');
      const runId = await page.evaluate(async () => { await window.failed.retry(); return window.failed.runId; });
      const run = runs.get(runId); assert.equal(run.status, 'processing'); assert.equal(Buffer.concat(run.chunks.map(c => c.body)).toString(), 'retainedfinal');
    });
    await check('recording readiness purges legacy and expired recovery while preserving unexpired bytes', async () => {
      const before = captureRequests.length;
      const remaining = await page.evaluate(async () => {
        const base = { mimeType: 'audio/webm', chunkCount: 1, durationMs: 500, stopped: true, damaged: false };
        await window.seedRecovery([
          { run: { ...base, runId: 'legacy-recovery', sessionId: 'legacy' }, chunks: ['legacy private bytes'] },
          { run: { ...base, runId: 'expired-recovery', sessionId: 'expired', expiresAt: Date.now() - 1 }, chunks: ['expired private bytes'] },
          { run: { ...base, runId: 'unexpired-recovery', sessionId: 'retain-other', expiresAt: Date.now() + 60_000 }, chunks: ['keep private bytes'] },
        ]);
        await window.capture.checkCaptureReady('audio');
        return window.recoveryData();
      });
      assert.deepEqual(remaining.runs.map(run => run.runId), ['unexpired-recovery']);
      assert.deepEqual(remaining.chunks, [{ runId: 'unexpired-recovery', index: 0, bytes: 18 }]);
      assert.equal(captureRequests.length, before, 'expiry deletion does not send private bytes to any API');
    });
    await check('failed discard authorization retains every scoped recovery byte', async () => {
      for (const runId of ['discard-a', 'discard-b']) runs.set(runId, { chunks: [], status: 'recording', sessionId: 'discard-session' });
      deniedRuns.add('discard-a');
      const retained = await page.evaluate(async () => {
        const base = { sessionId: 'discard-session', mimeType: 'audio/webm', chunkCount: 1, durationMs: 500, stopped: true, damaged: false, expiresAt: Date.now() + 60_000 };
        await window.seedRecovery([
          { run: { ...base, runId: 'discard-a' }, chunks: ['first recovery'] },
          { run: { ...base, runId: 'discard-b' }, chunks: ['second recovery'] },
        ]);
        let message = '';
        try { await window.capture.discardStoredCaptures('discard-session'); } catch (error) { message = error.message; }
        return { message, data: await window.recoveryData() };
      });
      assert.match(retained.message, /authorization denied/);
      assert.deepEqual(retained.data.runs.map(run => run.runId).sort(), ['discard-a', 'discard-b', 'unexpired-recovery']);
      assert.deepEqual(retained.data.chunks.map(chunk => [chunk.runId, chunk.bytes]), [['discard-a', 14], ['discard-b', 15], ['unexpired-recovery', 18]]);
      assert.equal(runs.get('discard-a').status, 'recording'); assert.equal(runs.get('discard-b').status, 'recording');
    });
    await check('authenticated discard removes only requested session runs and chunks', async () => {
      deniedRuns.delete('discard-a');
      const retained = await page.evaluate(async () => {
        await window.capture.discardStoredCaptures('discard-session'); return window.recoveryData();
      });
      assert.deepEqual(retained.runs.map(run => run.runId), ['unexpired-recovery']);
      assert.deepEqual(retained.chunks, [{ runId: 'unexpired-recovery', index: 0, bytes: 18 }]);
      assert.equal(runs.get('discard-a').status, 'incomplete'); assert.equal(runs.get('discard-b').status, 'incomplete');
      assert.equal(captureRequests.filter(input => input.action === 'incomplete' && input.runId === 'unexpired-recovery').length, 0);
    });
    await check('global retained backlog blocks a new recorder before server reservation', async () => {
      const before = runNumber;
      runs.set('global-backlog', { chunks: [], status: 'recording', sessionId: 'backlog-session' });
      const message = await page.evaluate(async () => {
        await window.seedRecovery([{ run: { runId: 'global-backlog', sessionId: 'backlog-session', mimeType: 'audio/webm', chunkCount: 1,
          durationMs: 500, stopped: true, damaged: false, expiresAt: Date.now() + 60_000 }, chunks: [new Uint8Array(25 * 1024 * 1024)] }]);
        try {
          await window.capture.startCreatorCapture({ sessionId: 'new-session', stream: window.makeStream(), mode: 'audio', offsetMs: 0, onProgress: window.captureProgress });
          return 'unexpectedly started';
        } catch (error) { return error.message; }
      });
      assert.match(message, /Retry or discard previous device recording recovery/); assert.equal(runNumber, before);
      await page.evaluate(() => window.capture.discardStoredCaptures('backlog-session'));
    });
    await check('page reload restores stopped queued capture and finalizes exact original sequence', async () => {
      uploadFailure = true;
      const runId = await page.evaluate(async () => {
        const handle = await window.capture.startCreatorCapture({ sessionId: 'reload-recovery', stream: window.makeStream(), mode: 'audio', offsetMs: 0, onProgress: window.captureProgress });
        window.Recorder.instances.at(-1).emit('before-reload'); return handle.runId;
      });
      await page.waitForFunction(async runId => (await window.recoveryData()).runs.some(run => run.runId === runId && run.stopped), {}, runId);
      await page.reload(); await page.waitForFunction(() => !!window.capture);
      assert.equal(await page.evaluate(() => window.Recorder.instances.length), 0, 'recovery has no surviving recorder instance');
      await page.evaluate(() => window.capture.retryStoredCaptures('reload-recovery', window.captureProgress));
      const run = runs.get(runId); assert.equal(run.status, 'processing');
      assert.equal(Buffer.concat(run.chunks.map(chunk => chunk.body)).toString(), 'before-reloadfinal');
      assert.equal(storageUploads.filter(upload => upload.runId === runId).length, 2, 'only the two original data chunks are uploaded');
      const local = await page.evaluate(() => window.recoveryData());
      assert.ok(!local.runs.some(run => run.runId === runId)); assert.ok(!local.chunks.some(chunk => chunk.runId === runId));
      assert.ok(local.runs.some(run => run.runId === 'unexpired-recovery'), 'another session is retained');
    });
    await check('explicit entry starts once under StrictMode without a second Start button; microphone denial uses typed Tavus', async () => {
      await page.evaluate(() => sessionStorage.clear()); await page.reload(); await text('Start live interview');
      const before=starts;
      await page.evaluate(() => {window.permissionDenied=true;window.entryIntent={requestId:'explicit-entry-denied-mic',consumed:false};window.renderDirect();});
      await callReady();assert.equal(starts,before+1);assert.equal(startRequests.at(-1).inputMode,'text');assert.equal(startRequests.at(-1).mode,'none');
      assert.equal(startRequests.at(-1).microphoneReady,false);assert.equal(await page.evaluate(()=>window.dailyCalls.length),1);
      await click('End');await callEnded();
      await page.evaluate(()=>window.renderDirect('same-intent-remount'));await text('Use microphone instead');
      assert.equal(starts,before+1,'remount cannot replay consumed entry');
      await page.reload();await text('Resume live interview');assert.equal(starts,before+1,'refresh does not retain entry authorization');
    });
    await check('Type instead while permission is pending joins the same intended call without waiting for microphone', async()=>{
      await page.evaluate(()=>sessionStorage.clear());await page.reload();await text('Start live interview');const before=starts;
      await page.evaluate(()=>{window.holdMicrophone=true;window.entryIntent={requestId:'explicit-entry-typed-optout',consumed:false};window.renderDirect();});
      await page.waitForFunction(()=>!!window.resolveMicrophone);await click('Type instead');await callReady();
      assert.equal(starts,before+1);assert.equal(startRequests.at(-1).inputMode,'text');assert.equal(startRequests.at(-1).microphoneReady,false);
      await page.evaluate(()=>window.resolveMicrophone());assert.equal(await page.evaluate(()=>window.micOn),false);
      await click('End');await callEnded();
    });
    await check('failed explicit entry stops automatic attempts and preserves request identity for deliberate Retry', async()=>{
      await page.evaluate(()=>sessionStorage.clear());await page.reload();await text('Start live interview');const before=starts;failStart=true;
      await page.evaluate(()=>{window.permissionDenied=true;window.entryIntent={requestId:'explicit-entry-failure-receipt',consumed:false};window.renderDirect();});
      await text('Retry interview');assert.equal(starts,before+1);assert.equal(await page.evaluate(()=>window.dailyCalls.length),0);
      await page.evaluate(()=>window.renderDirect());assert.equal(starts,before+1);
      await page.evaluate(()=>window.renderDirect('failed-entry-remount'));await text('Retry interview');
      assert.equal(starts,before+1,'a consumed failed entry remount exposes Retry without automatically retrying');
      failStart=false;await click('Retry interview');await callReady();assert.equal(starts,before+2);
      assert.equal(startRequests.at(-1).requestId,startRequests.at(-2).requestId);
      await click('End');await callEnded();
    });
    await check('source replacement cancels an unresolved microphone start before provider creation', async()=>{
      await page.evaluate(()=>sessionStorage.clear());await page.reload();await text('Start live interview');const before=starts;
      await page.evaluate(()=>{window.holdMicrophone=true;window.entryIntent={requestId:'explicit-entry-source-change',consumed:false};window.renderDirect();});
      await page.waitForFunction(()=>!!window.resolveMicrophone);
      await page.evaluate(()=>window.renderDirect('different-source','other-project'));
      await page.evaluate(()=>window.resolveMicrophone());await text('Type instead');assert.equal(starts,before);
    });
    await check('a confirmed ended session after join failure allows a fresh deliberate Retry', async()=>{
      await page.evaluate(()=>sessionStorage.clear());await page.reload();await text('Start live interview');const before=starts;
      await page.evaluate(()=>{window.permissionDenied=true;window.failJoin=true;window.entryIntent={requestId:'explicit-entry-join-failure',consumed:false};window.renderDirect();});
      await text('Retry interview');assert.equal(live.status,'ended');assert.equal(starts,before+1);
      const failedRequest=startRequests.at(-1).requestId;
      await page.evaluate(()=>{window.failJoin=false});loseStartResponse=true;await click('Retry interview');await text('Retry interview');
      assert.equal(starts,before+2);assert.notEqual(startRequests.at(-1).requestId,failedRequest);
      const unknownRetryKey=startRequests.at(-1).requestId;
      await page.evaluate(()=>window.renderDirect('unknown-second-attempt'));await text('Retry interview');
      await click('Retry interview');await callReady();assert.equal(starts,before+3);
      assert.equal(startRequests.at(-1).requestId,unknownRetryKey,'a lost response to a fresh deliberate retry survives remount');
      await click('End');await callEnded();
    });
    await check('an older restored ended session cannot rotate an unknown newer start key, including after remount', async()=>{
      for(const remount of [false,true]) {
        restoredSession={id:'live-fixture',status:'ended',snapshot:structuredClone(snapshot),turns:[]};liveOwnerScope=draftScope;
        await page.evaluate(()=>{sessionStorage.clear();sessionStorage.setItem('folio.live.session.'+JSON.stringify({kind:'project',id:'synthetic-project'}),'live-fixture')});
        await page.reload();await text('Resume live interview');loseStartResponse=true;const before=starts;
        await page.evaluate(remount=>{window.permissionDenied=true;window.entryIntent={requestId:'entry-unknown-after-ended-'+remount,consumed:false};window.renderDirect();},remount);
        await text('Retry interview');assert.equal(starts,before+1);const unknownKey=startRequests.at(-1).requestId;
        if(remount){await page.evaluate(()=>window.renderDirect('unknown-after-ended-remount'));await text('Retry interview');}
        await click('Retry interview');await callReady();assert.equal(starts,before+2);
        assert.equal(startRequests.at(-1).requestId,unknownKey,'the old terminal session cannot prove this newer request failed');
        restoredSession=null;await click('End');await callEnded();
      }
    });
    await check('source replacement during provider join cannot activate the obsolete call after join resolves', async()=>{
      await page.evaluate(()=>sessionStorage.clear());await page.reload();await text('Start live interview');const before=starts;
      await page.evaluate(()=>{window.permissionDenied=true;window.holdJoin=true;window.entryIntent={requestId:'explicit-entry-pending-join',consumed:false};window.renderDirect();});
      await page.waitForFunction(()=>!!window.resolveJoin);assert.equal(starts,before+1);
      await page.evaluate(()=>window.renderDirect('different-source-join','other-project'));await text('Use microphone instead');
      await page.waitForFunction(()=>window.left && window.destroyed);await page.evaluate(()=>window.resolveJoin());
      await page.waitForFunction(()=>window.left && window.destroyed);
      assert.equal(await page.evaluate(()=>window.activeChanges.at(-1)),false);assert.equal(live.status,'ended');assert.equal(starts,before+1);
    });
    await check('disconnect recovery pauses once, resumes saved progress on one click, and ignores obsolete call events', async () => {
      for (const event of ['participant-left', 'left-meeting', 'error']) {
        await freshPanel(); startResponses.push(savedProgress()); await click('Start live interview'); await callReady();
        const before = { starts, pauses: actionCalls.filter(action => action === 'pause').length };
        await page.evaluate(() => {
          window.dailyCall.emit('participant-left', { participant: { local: true } });
          window.dailyCall.emit('participant-left', { participant: { local: false }, reason: 'hidden' });
          window.dailyCall.emit('track-stopped', { participant: { local: false } });
        });
        assert.equal(await page.evaluate(() => window.left), false, 'local departure or stopped media is not a remote disconnect');
        await page.evaluate(event => { window.disconnectedCall = window.dailyCall; window.dailyCall.emit(event, { participant: { local: false } }); }, event);
        await page.waitForFunction(() => window.left && window.destroyed, { timeout: 5000 }); await callEnded();
        assert.equal(actionCalls.filter(action => action === 'pause').length, before.pauses + 1, 'leave-meeting cascade must not end twice');
        assert.deepEqual(await page.evaluate(() => [window.disconnectedCall.leaveCount, window.disconnectedCall.destroyCount]), [1, 1]);
        assert.equal(starts, before.starts, 'disconnect does not authorize a replacement call');
        assert.equal(live.turns[0].raw, 'The existing doorway set the proportions.');
        startResponses.push(savedProgress()); await click('Resume live interview'); await callReady();
        assert.equal(starts, before.starts + 1); assert.equal(await page.evaluate(() => window.canonicalChanges.at(-1).version), 'saved-room-story');
        const actionsBefore = actionCalls.length, eventsBefore = eventCalls.length;
        await page.evaluate(() => {
          for (const event of ['participant-left', 'left-meeting', 'error']) window.disconnectedCall.emit(event, { participant: { local: false } });
          window.disconnectedCall.emit('app-message', { data: { message_type: 'conversation', event_type: 'conversation.stopped_speaking', seq: 999, inference_id: 'obsolete-call', properties: { role: 'pal', interrupted: false } } });
        });
        await flushEvents(); assert.equal(actionCalls.length, actionsBefore); assert.equal(eventCalls.length, eventsBefore);
        assert.equal(await page.evaluate(() => window.activeChanges.at(-1)), true); assert.equal(await page.evaluate(() => window.left || window.destroyed), false);
        await click('End'); await callEnded();
      }
    });
    await check('disconnect recovery cannot reactivate a call whose pending join resolves after departure', async () => {
      await freshPanel(); await page.evaluate(() => { window.holdJoin = true; }); await click('Start live interview');
      await page.waitForFunction(() => !!window.resolveJoin); const before = starts;
      await page.evaluate(() => window.dailyCall.emit('left-meeting'));
      await page.waitForFunction(() => window.left && window.destroyed, { timeout: 5000 }); await callEnded();
      await page.evaluate(() => window.resolveJoin()); await flushEvents();
      assert.equal(await page.evaluate(() => window.activeChanges.at(-1)), false); assert.equal(starts, before);
        assert.equal(await page.$$eval('button', buttons => buttons.some(button => button.textContent === 'End' && button.getBoundingClientRect().height > 0)), false);
    });
    await check('disconnect recovery replaces a confirmed ended response once and keeps the saved question', async () => {
      await freshPanel(); restoredSession = savedProgress('ended'); liveOwnerScope = draftScope;
      await page.evaluate(() => sessionStorage.setItem('folio.live.session.' + JSON.stringify({ kind: 'project', id: 'synthetic-project' }), 'live-fixture'));
      await page.reload(); await text('Resume live interview'); restoredSession = null;
      const before = starts; startResponses.push(savedProgress('ended'), savedProgress());
      await click('Resume live interview'); await callReady(); assert.equal(starts, before + 2);
      assert.notEqual(startRequests.at(-1).requestId, startRequests.at(-2).requestId);
      assert.equal(await page.evaluate(() => window.dailyCalls.length), 1);
      assert.equal(await page.evaluate(() => window.canonicalChanges.at(-1).currentQuestion.id), 'q-next');
      assert.equal(live.turns[0].receipt, 'saved-room-answer'); await click('End'); await callEnded();
    });
    await check('disconnect recovery keeps Resume disabled until pending pause cleanup completes despite an old join resolving', async () => {
      await freshPanel(); await page.evaluate(() => { window.holdJoin = true; }); await click('Start live interview');
      await page.waitForFunction(() => !!window.resolveJoin); const before = starts;
      holdPause = true; const observed = new Promise(resolve => { pauseObserved = resolve; });
      try {
        await page.evaluate(() => window.dailyCall.emit('left-meeting')); await observed;
        await page.evaluate(() => window.resolveJoin()); await flushEvents();
        assert.equal(await page.$$eval('button', buttons => buttons.find(button => /Preparing live interview|Resume live interview/.test(button.textContent)).disabled), true);
        await page.$$eval('button', buttons => buttons.find(button => /Preparing live interview|Resume live interview/.test(button.textContent)).click());
        assert.equal(starts, before); assert.equal(await page.evaluate(() => window.activeChanges.at(-1)), false);
      } finally { holdPause = false; pauseObserved = null; releasePause?.(); releasePause = null; }
      await callEnded(); assert.equal(starts, before);
    });
    await check('disconnect recovery ignores a late rejected old join after a replacement call is active', async () => {
      for (const resumedId of ['live-resumed', 'live-fixture']) {
      await freshPanel(); await page.evaluate(() => { window.holdJoin = true; }); await click('Start live interview');
      await page.waitForFunction(() => !!window.rejectJoin);
      await page.evaluate(() => { window.rejectOldJoin = window.rejectJoin; window.dailyCall.emit('left-meeting'); });
      await page.waitForFunction(() => window.left && window.destroyed, { timeout: 5000 }); await callEnded();
      await page.evaluate(() => { window.holdJoin = false; });
      startResponses.push(savedProgress('ended'), { ...savedProgress(), id: resumedId });
      await click('Resume live interview'); await callReady(); const before = starts;
      await page.evaluate(() => window.rejectOldJoin(new Error('Synthetic obsolete join rejection'))); await flushEvents();
      assert.equal(live.id, resumedId); assert.equal(live.status, 'active'); assert.equal(starts, before);
      assert.equal(await page.evaluate(() => window.activeChanges.at(-1)), true);
      assert.equal(await page.$$eval('button', buttons => buttons.find(button => button.textContent === 'End').disabled), false);
      assert.equal(await page.evaluate(() => document.body.innerText.includes('Synthetic obsolete join rejection')), false);
      await click('End'); await callEnded();
      }
    });
    await check('disconnect recovery ignores an old provider event response or failure after same-session rejoin', async () => {
      for (const outcome of ['success', 'failure']) {
        await freshPanel(); startResponses.push(savedProgress()); await click('Start live interview'); await callReady();
        heldProviderEvent = outcome; failedProviderSequence = outcome === 'failure' ? 12345 : null;
        const previousEvents = eventCalls.filter(event => event.inference_id === 'old-event-response').length;
        const observed = new Promise(resolve => { providerEventObserved = resolve; });
        await page.evaluate(() => window.emitProvider({ message_type: 'conversation', event_type: 'conversation.stopped_speaking', seq: 12345, inference_id: 'old-event-response', properties: { role: 'pal', interrupted: false } }));
        await observed; await page.evaluate(() => window.dailyCall.emit('left-meeting')); await callEnded();
        const resumed = savedProgress(); resumed.snapshot.version = 'replacement-question'; resumed.snapshot.currentQuestion.id = 'replacement-question';
        startResponses.push(resumed); await click('Resume live interview'); await callReady();
        const before = { starts, pauses: actionCalls.filter(action => action === 'pause').length };
        const delivered = page.waitForResponse(response => response.request().postData()?.includes('old-event-response')
          && (outcome === 'success' || eventCalls.filter(event => event.inference_id === 'old-event-response').length >= previousEvents + 3));
        releaseProviderEvent(); await delivered; await flushEvents();
        assert.equal(await page.evaluate(() => window.canonicalChanges.at(-1).version), 'replacement-question');
        assert.equal(await page.evaluate(() => window.activeChanges.at(-1)), true); assert.equal(live.status, 'active');
        assert.equal(starts, before.starts); assert.equal(actionCalls.filter(action => action === 'pause').length, before.pauses);
        providerEventObserved = null; releaseProviderEvent = null; failedProviderSequence = null;
        await click('End'); await callEnded();
      }
    });
    await check('disconnect recovery preserves an active same-key retry when the canceled start response arrives first', async () => {
      await freshPanel(); holdStarts = true; const before = { starts, actions: actionCalls.length };
      try {
        let observed = new Promise(resolve => { startHeld = resolve; });
        await click('Start live interview'); await observed;
        await page.evaluate(() => window.panelControls.stop());
        observed = new Promise(resolve => { startHeld = resolve; });
        await click('Start live interview'); await observed;
        assert.equal(starts, before.starts + 2); assert.equal(startRequests.at(-1).requestId, startRequests.at(-2).requestId);
        const firstDelivered = page.waitForResponse(response => response.url().endsWith('/api/live-interviews') && response.request().method() === 'POST');
        heldStarts.shift()(); await firstDelivered; await flushEvents();
        assert.equal(actionCalls.length, before.actions, 'the old response must not end the session claimed by the pending retry');
        assert.equal(live.status, 'active'); assert.equal(await page.evaluate(() => window.dailyCalls.length), 0);
        heldStarts.shift()(); await callReady(); assert.equal(starts, before.starts + 2);
        assert.equal(await page.evaluate(() => window.dailyCalls.length), 1);
      } finally { holdStarts = false; startHeld = null; for (const release of heldStarts.splice(0)) release(); }
      await click('End'); await callEnded();
    });
    await check('disconnect recovery is bounded when both the original and replacement responses are ended', async () => {
      await freshPanel(); const before = starts; startResponses.push(savedProgress('ended'), savedProgress('ended'));
      await click('Start live interview'); await text('The session is being reconciled.'); await flushEvents();
      assert.equal(starts, before + 2); assert.notEqual(startRequests.at(-1).requestId, startRequests.at(-2).requestId);
      assert.equal(await page.evaluate(() => window.dailyCalls.length), 0); assert.equal(startResponses.length, 0);
    });
    await check('disconnect recovery preserves uncertain and retained-answer request identities without replacement', async () => {
      for (const status of ['uncertain', 'reconciling', 'ended']) {
        await freshPanel(); const before = starts; const response = savedProgress(status); response.notice = 'Synthetic retained response: review or reconcile before continuing.';
        if (status === 'ended') response.turns[0].status = 'needs_review';
        startResponses.push(response); await click('Start live interview'); await text(response.notice);
        assert.equal(starts, before + 1); const key = startRequests.at(-1).requestId;
        await click('Resume live interview'); await text(response.notice); await flushEvents();
        assert.equal(starts, before + 2); assert.equal(startRequests.at(-1).requestId, key);
        assert.equal(await page.evaluate(() => window.dailyCalls.length), 0); assert.equal(live.turns[0].raw, response.turns[0].raw);
      }
    });
    await check('disconnect recovery retains a lost replacement response key through remount and deliberate Retry', async () => {
      await freshPanel(); const before = starts; startResponses.push(savedProgress('ended')); loseStartResponse = true;
      await page.evaluate(() => { window.permissionDenied = true; window.entryIntent = { requestId: 'confirmed-ended-lost-replacement', consumed: false }; window.renderDirect(); });
      await text('Retry interview'); assert.equal(starts, before + 2);
      const replacementKey = startRequests.at(-1).requestId; assert.notEqual(replacementKey, startRequests.at(-2).requestId);
      assert.equal(await page.evaluate(() => window.dailyCalls.length), 0);
      await page.evaluate(() => window.renderDirect('lost-replacement-remount')); await text('Retry interview'); assert.equal(starts, before + 2);
      await click('Retry interview'); await callReady(); assert.equal(starts, before + 3); assert.equal(startRequests.at(-1).requestId, replacementKey);
      await click('End'); await callEnded();
    });
    await check('project host can consent and record during the same call; Stop finalizes without ending Tavus', async () => {
      recordingEnabled=true;
      await page.evaluate(()=>{sessionStorage.clear();window.permissionDenied=false;window.holdJoin=false;window.entryIntent={requestId:'guide-media-synthetic-entry',consumed:false};window.renderGuide();});
      await callReady();await text('Make something worth sharing');const before=starts,captured=captureRequests.length;
      assert.equal(await page.$eval('[aria-label="Prepare your interview recording"] button',e=>e.disabled),true);
      assert.equal(captureRequests.length,captured,'auto-entry did not record');
      await page.select('[aria-label="Prepare your interview recording"] select','audio');
      await page.click('[aria-label="Prepare your interview recording"] input[type=checkbox]');
      await click('Record my voice');await text('Recording your voice');assert.equal(starts,before);assert.ok(actionCalls.includes('consent_recording'));
      assert.equal(captureRequests.filter(r=>r.action==='start').at(-1).mimeType.split(';')[0],'audio/webm');
      await click('Stop recording');await text('Private recording is processing');assert.equal(await page.evaluate(()=>window.left),false);
      assert.ok(captureRequests.some(r=>r.action==='finalize'));
      await page.select('[aria-label="Prepare your interview recording"] select','video');
      await page.click('[aria-label="Prepare your interview recording"] input[type=checkbox]');await page.evaluate(()=>window.cameraDenied=true);
      const priorRuns=captureRequests.filter(r=>r.action==='start').length;
      await click('Record camera and voice');await text('Synthetic camera permission denied');
      assert.equal(captureRequests.filter(r=>r.action==='start').length,priorRuns);assert.equal(await page.evaluate(()=>window.left),false);
      await page.evaluate(()=>window.cameraDenied=false);await click('Record camera and voice');await text('Recording your voice and camera');
      assert.equal(starts,before);assert.equal(await page.evaluate(()=>window.dailyOptions.videoSource),false,'camera is private, not sent to Tavus');
      assert.equal(await page.$eval('video[aria-label="Your private camera preview"]',e=>e.srcObject.getVideoTracks()[0].getSettings().width),1280);
      const finalized=captureRequests.filter(r=>r.action==='finalize').length;
      await page.evaluate(()=>window.renderGuide('rooms'));await text('Private recording is processing');
      assert.equal(await page.$('video[aria-label="Your private camera preview"]'),null);
      assert.equal(await page.$('[aria-label="Prepare your interview recording"]'),null);
      assert.equal(captureRequests.filter(r=>r.action==='finalize').length,finalized+1);
      assert.equal(starts,before);assert.equal(await page.evaluate(()=>window.left),false,'Leaving Story finishes capture but keeps the host.');
      await click('End');await callEnded();
    });
    await check('daily quota shows its reset time and blocks an identical retry instead of looping', async () => {
      limitStart=true;await page.evaluate(()=>{sessionStorage.clear();window.entryIntent={requestId:'limited-synthetic-entry',consumed:false};window.renderDirect('limited');});
      await text('Live interview available later');assert.equal(await page.$$eval('button',items=>items.find(e=>e.textContent==='Live interview available later').disabled),true);
      await text('step-by-step workspace');limitStart=false;
    });
    await check('rollout disabled hides new live entry', async () => {
      enabled = false; await page.evaluate(() => sessionStorage.clear()); await page.reload(); await page.waitForFunction(() => !!window.capture);
      await new Promise(resolve => setTimeout(resolve, 100)); assert.equal(await page.$('section[aria-label="Live interview"]'), null);
    });
    assert.deepEqual(errors, []);
    console.log(`PASS ${results.length} live browser/capture checks; all provider and recording bytes synthetic.`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

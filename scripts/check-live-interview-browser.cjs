// Actual panel/capture helper in Chromium. Daily, recorder bytes and HTTP are synthetic.
// Loopback only; no app env, credentials, production records, microphone or camera.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.tmp/live-browser');
const results = [];
let starts = 0, enabled = true, eventCalls = [], actionCalls = [], uploadFailure = false, runNumber = 0;
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
window.capture=capture; window.permissionDenied=false; window.permissions=[]; window.trackClones=[];
window.makeStream=()=>{const audio=new AudioContext(); const destination=audio.createMediaStreamDestination();
 const original=destination.stream.getAudioTracks()[0]; const clone=original.clone.bind(original);
 original.clone=()=>{const track=clone();window.trackClones.push(track);return track};return destination.stream;};
Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async options=>{window.permissions.push(options); if(window.permissionDenied)throw new Error('Microphone permission denied.');return window.makeStream();}}});
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
window.fixtureRoot.render(<LiveInterviewPanel source={{kind:'project',id:'synthetic-project'}}/>);`;
const dailyFixture = `export default {createCallObject(options){window.dailyOptions=options;const handlers={};const call={
 on(name,handler){(handlers[name]??=[]).push(handler);return call},participants(){return{}},async join(){window.joined=true},
 setLocalAudio(value){window.micOn=value;return call},async leave(){window.left=true},async destroy(){window.destroyed=true}};
 window.dailyCall=call;window.emitProvider=data=>(handlers['app-message']||[]).forEach(fn=>fn({data}));return call}};`;

async function build() {
  fs.mkdirSync(out, { recursive: true });
  await esbuild.build({ stdin: { contents: entry, resolveDir: root, sourcefile: 'live-fixture.tsx', loader: 'tsx' }, bundle: true,
    outfile: path.join(out, 'app.js'), platform: 'browser', jsx: 'automatic', alias: { '@': path.join(root, 'src') },
    define: { 'process.env.NODE_ENV': '"test"' }, plugins: [{ name: 'fake-daily', setup(build) {
      build.onResolve({ filter: /^@daily-co\/daily-js$/ }, () => ({ path: 'daily', namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: dailyFixture, loader: 'js' }));
    } }] });
}
function handler(req, res) {
  const url = new URL(req.url, 'http://fixture');
  const json = (value, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  if (url.pathname === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); fs.createReadStream(path.join(out, 'app.js')).pipe(res); return; }
  if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/storage/')) { res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="root"></main><script src="/app.js"></script></body></html>'); return; }
  if (req.method === 'GET' && url.pathname === '/api/live-interviews') return json({ enabled, recordingEnabled: true });
  if (req.method === 'GET' && url.pathname === '/api/live-interviews/live-fixture') return json(live);
  const chunks = []; req.on('data', part => chunks.push(part)); req.on('end', () => {
    try {
      if (url.pathname.startsWith('/storage/')) {
        if (uploadFailure) { uploadFailure = false; return json({ error: 'Synthetic network interruption' }, 503); }
        const [, , runId, index] = url.pathname.split('/'); const run = runs.get(runId);
        storageUploads.push({ runId, index: Number(index) });
        run.chunks[Number(index)].body = Buffer.concat(chunks); return json({ ok: true });
      }
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      if (url.pathname === '/api/live-interviews') {
        starts++; live = { id: 'live-fixture', status: 'active', snapshot, turns: [], recordingEnabled: true,
          join: { url: 'https://synthetic.daily.co/fixture', token: 'synthetic-join-token', conversationId: 'synthetic-conversation' } };
        return json(live);
      }
      if (url.pathname === '/api/live-interviews/live-fixture') {
        actionCalls.push(body.action);
        if (body.action === 'event') eventCalls.push(body.event);
        if (['end', 'pause', 'switch_to_text'].includes(body.action)) live.status = 'ended';
        return json(live);
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
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true); page.on('request', request => request.url().startsWith(base) || request.url().startsWith('data:') ? request.continue() : request.abort());
  const check = async (name, test) => { await test(); results.push(name); console.log(`PASS ${name}`); };
  const click = async text => {
    for (const button of await page.$$('button')) if ((await button.evaluate(el => el.textContent)).trim() === text) { await button.click(); return; }
    throw new Error(`Missing button ${text}`);
  };
  const text = value => page.waitForFunction(value => document.body.textContent.includes(value), {}, value);
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
      await click('Start live interview'); await page.waitForFunction(()=>window.joined && window.dailyOptions); assert.equal(starts, 1); assert.equal(runNumber, 0);
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
    await check('switch to text ends provider and releases call', async () => {
      await click('Switch to text'); await page.waitForFunction(()=>window.destroyed && window.left && [...document.querySelectorAll('button')].some(button=>button.textContent==='Resume live interview'&&!button.disabled)); assert.ok(actionCalls.includes('switch_to_text'));
      assert.equal(await page.evaluate(() => window.destroyed && window.left), true);
    });
    await check('microphone permission loss ends the call and releases resources', async () => {
      await click('Resume live interview');await page.waitForFunction(()=>window.dailyOptions.audioSource.readyState==='live');
      await page.evaluate(()=>window.dailyOptions.audioSource.dispatchEvent(new Event('ended')));
      await text('Microphone access ended. The call stopped');
      assert.ok(actionCalls.includes('pause'));assert.equal(await page.evaluate(()=>window.dailyOptions.audioSource.readyState),'ended');
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
    await check('rollout disabled hides new live entry', async () => {
      enabled = false; await page.evaluate(() => sessionStorage.clear()); await page.reload(); await page.waitForFunction(() => !!window.capture);
      await new Promise(resolve => setTimeout(resolve, 100)); assert.equal(await page.$('section[aria-label="Live interview"]'), null);
    });
    assert.deepEqual(errors, []);
    console.log(`PASS ${results.length} live browser/capture checks; all provider and recording bytes synthetic.`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

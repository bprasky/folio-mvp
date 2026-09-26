// Actual guided React UI + pure controller in a loopback-only fixture.
// Preparation, transcription, persistence and generation transports are synthetic.
// No application env, auth cookie, production API or database is loaded.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const Module = require('node:module');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs/reviews/guided-interview');
const fixtureOut = path.join(root, '.tmp/guided-browser');
const results = [];
const capture = async (name, fn) => { await fn(); results.push(name); console.log('PASS ' + name); };
function loadController() {
  const source = esbuild.buildSync({ entryPoints: [path.join(root, 'src/lib/interview/guided/controller.ts')], bundle: true, platform: 'node', format: 'cjs', packages: 'external', alias: { '@': path.join(root, 'src') }, write: false }).outputFiles[0].text;
  const filename = path.join(root, 'guided-fixture.cjs');
  const mod = new Module(filename); mod.filename = filename; mod.paths = module.paths; mod._compile(source, filename); return mod.exports;
}
const controller = loadController();
const rooms = [{ id: 'living', name: 'Living room', imageIds: ['living-photo'], baseQuestions: 2, maxFollowUps: 1 }, { id: 'kitchen', name: 'Kitchen', imageIds: ['kitchen-photo'], baseQuestions: 2, maxFollowUps: 1 }];
const categories = ['CLIENT_BRIEF', 'SCOPE_PARAMETERS', 'DESIGN_DIRECTION', 'SIGNATURE_IDENTITY', 'SURPRISE_PIVOT'];
const questions = ['What did the clients come to you wanting from this project?', 'What were you working within on this project?', 'What was the overall design idea for this project?', 'What in this project is most recognizably yours?', 'What discovery changed the direction of this project along the way?'];
const prepared = { rooms, contextFingerprint: 'local-fixture', minimumTotalAnswers: 5, questions: categories.map((category, i) => ({ id: 'project-' + category + '-fixture', text: questions[i], category, roomId: null, sourceImageIds: rooms.flatMap(room => room.imageIds), sourceAnswerIds: [], kind: 'prepared', status: 'pending' })) };
const roomPlan = () => rooms.flatMap(room => ['What did you want this room to make possible?', 'What shaped the layout of this room?'].map((text, index) => ({ id: room.id + '-' + index, text, roomId: room.id, category: 'room_design', sourceImageIds: room.imageIds, sourceAnswerIds: [], kind: 'prepared', status: 'pending' })));
let saved = null, failSave = false, loseReply = false, failTranscription = false, transcript = 'The two doorways leave a clear path through the room.', generationCalls = 0;
const requests = [];
const entry = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {GuidedInterviewWorkspace} from './src/components/posting/interview/GuidedInterviewWorkspace';
window.microphoneStarts=0; window.stoppedTracks=0;
Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>{window.microphoneStarts++;return {getTracks:()=>[{stop:()=>{window.stoppedTracks++}}]};}}});
class Recorder {static isTypeSupported(type){return type==='audio/webm'};state='inactive';mimeType='audio/webm';start(){this.state='recording'};stop(){this.state='inactive';setTimeout(()=>{this.ondataavailable?.({data:new Blob(['fixture recording'],{type:'audio/webm'})});this.onstop?.()},40)}}
window.MediaRecorder=Recorder;
const photos=[{id:'living-photo',url:'/living.svg',name:'Living room, looking toward the windows',roomId:'living',displayOrder:0},{id:'kitchen-photo',url:'/kitchen.svg',name:'Kitchen, looking toward the doorway',roomId:'kitchen',displayOrder:1}];
function App(){const[open,setOpen]=useState(true);return <><button onClick={()=>setOpen(true)}>Resume guided interview</button><p>Local synthetic review fixture</p>{open&&<GuidedInterviewWorkspace projectId="fixture-project" actorId="fixture-designer" projectName="The Orchard House" images={photos} onClose={()=>setOpen(false)} onDraftGenerated={()=>{document.getElementById('destination').textContent='Editable draft review';}}/>}<output id="destination"/></>};
createRoot(document.getElementById('root')).render(<App/>);`;

async function build() {
  fs.mkdirSync(fixtureOut, { recursive: true }); fs.mkdirSync(out, { recursive: true });
  await esbuild.build({ stdin: { contents: entry, resolveDir: root, sourcefile: 'fixture.tsx', loader: 'tsx' }, bundle: true,
    outfile: path.join(fixtureOut, 'app.js'), platform: 'browser', jsx: 'automatic', alias: { '@': path.join(root, 'src') },
    define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'fixture-next', setup(build) {
      build.onResolve({ filter: /^(next\/navigation|next\/image)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root, contents: args.path === 'next/navigation'
        ? 'export const useRouter=()=>({push:url=>{document.getElementById("destination").textContent=url},refresh:()=>{}});'
        : 'import React from "react";export default function Image({fill,unoptimized,priority,sizes,...props}){return <img {...props} style={fill?{position:"absolute",height:"100%",width:"100%",inset:0}:undefined}/>}' }));
    } }] });
  const globals = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  const config = require(path.join(root, 'tailwind.config.js'));
  config.content = [path.join(root, 'src/components/posting/interview/GuidedInterviewWorkspace.tsx'), path.join(root, 'src/components/posting/GenerationContextOptions.tsx')];
  let css = (await postcss([tailwind(config)]).process(globals, { from: path.join(root, 'src/app/globals.css') })).css;
  let fonts = '', heading = 'Georgia', body = 'Arial';
  const cssDir = path.join(root, '.next/static/css');
  if (fs.existsSync(cssDir)) for (const file of fs.readdirSync(cssDir).filter(file => file.endsWith('.css'))) {
    for (const face of fs.readFileSync(path.join(cssDir, file), 'utf8').match(/@font-face\{[^}]+\}/g) || []) {
      if (/Cormorant_Garamond|Instrument_Sans/.test(face)) {
        fonts += face; const family = face.match(/font-family:([^;]+)/)?.[1];
        if (family && /Cormorant_Garamond/.test(face)) heading = family;
        if (family && /Instrument_Sans/.test(face)) body = family;
      }
    }
  }
  css += fonts + '\n:root{--font-headline:' + heading + ';--font-body:' + body + '}';
  fs.writeFileSync(path.join(fixtureOut, 'app.css'), css);
  fs.writeFileSync(path.join(fixtureOut, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guided interview — synthetic fixture</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
}

function scene(kitchen) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="#e6e1d7"/><path d="M0 690H1200V900H0" fill="#b6a18a"/><path d="M0 0H1200V80H0" fill="#d1c9b9"/><rect x="735" y="140" width="290" height="460" fill="#606b59"/><path d="M880 140V600M735 370H1025" stroke="#e2dbc9" stroke-width="17"/><rect x="740" y="145" width="130" height="210" fill="#8b9b7c"/>${kitchen ? '<rect x="130" y="300" width="460" height="320" rx="2" fill="#888e7d"/><path d="M285 300V620M440 300V620" stroke="#d9d2c4" stroke-width="3"/><path d="M190 660H870V800H190" fill="#958372"/><path d="M155 640H910V665H155" fill="#eee9df"/>' : '<rect x="125" y="535" width="555" height="220" rx="30" fill="#c1b698"/><rect x="145" y="510" width="225" height="170" rx="25" fill="#cbbfa2"/><rect x="390" y="510" width="250" height="170" rx="25" fill="#cbbfa2"/><ellipse cx="570" cy="776" rx="180" ry="45" fill="#71604d"/><path d="M300 250V535M228 260H373L345 170H258Z" fill="#d6c39e" stroke="#80755d" stroke-width="5"/>'}<text x="30" y="860" font-family="sans-serif" font-size="18" fill="#51493e">Synthetic ${kitchen ? 'kitchen' : 'living room'} image · layout verification fixture</text></svg>`;
}

function serverHandler(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const json = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  if (pathname.endsWith('/generation-context')) return json({ bio: { available: false }, projectHistory: { available: false } });
  if (pathname.endsWith('/interview/transcribe')) {
    req.resume(); if (failTranscription) { failTranscription = false; return json({ error: 'Fixture transcription unavailable' }, 503); }
    return json({ transcript });
  }
  if (pathname.endsWith('/interview/generate')) { generationCalls++; req.resume(); return json({ ok: true }); }
  if (pathname.endsWith('/interview/guided')) {
    if (req.method === 'GET') return json({ ok: true, session: saved });
    let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => {
      try {
        const command = JSON.parse(body); requests.push(command);
        if (failSave) { failSave = false; return json({ message: 'Fixture save unavailable' }, 503); }
        if (!saved) saved = controller.createGuidedSession('fixture-project', prepared, command.requestId);
        else if (command.action !== 'start') saved = controller.acceptCommand(saved, command);
        if (saved.status === 'deciding') {
          const turn = saved.turns.find(turn => turn.id === saved.pendingDecisionTurnId);
          const q = saved.plan.find(q => q.id === turn?.questionId);
          controller.applyDecision(saved, turn?.text === 'It should feel calm.' && controller.followUpAllowed(saved, q)
            ? { kind: 'followup', text: 'What is one moment in the project that best shows that idea in practice?', purpose: 'Ground the stated idea.', sourceAnswerIds: [turn.id] } : { kind: 'advance' });
          if (!saved.roomsPrepared && controller.projectPhaseComplete(saved) && !saved.activeQuestionId) controller.appendRoomPlan(saved, roomPlan());
          saved.version++;
        }
        if (loseReply) { loseReply = false; return json({ message: 'Fixture lost the successful save acknowledgement' }, 503); }
        json({ ok: true, session: saved });
      } catch (error) { json({ code: error.code, message: error.message }, error.status || 500); }
    }); return;
  }
  if (pathname === '/living.svg' || pathname === '/kitchen.svg') { res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); return res.end(scene(pathname.includes('kitchen'))); }
  if (pathname.startsWith('/api/')) return json({ error: 'Fixture blocked unexpected API' }, 404);
  let file = path.join(fixtureOut, pathname === '/app.js' ? 'app.js' : pathname === '/app.css' ? 'app.css' : 'index.html');
  if (/^\/_next\/static\/media\/[a-zA-Z0-9._-]+\.woff2$/.test(pathname)) file = path.join(root, '.next', pathname.slice('/_next/'.length));
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.woff2') ? 'font/woff2' : 'text/html' }); fs.createReadStream(file).pipe(res);
}

async function main() {
  await build();
  const server = http.createServer(serverHandler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const executablePath = process.env.GUIDED_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(file => fs.existsSync(file));
  assert.ok(executablePath, 'Set GUIDED_TEST_BROWSER to an installed Chromium executable.');
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true); page.on('request', request => request.url().startsWith(base) || request.url().startsWith('data:') ? request.continue() : request.abort());
  const clickText = async text => {
    const buttons = await page.$$('button');
    for (const button of buttons) if ((await button.evaluate(el => el.textContent)).trim() === text) { await button.click(); return; }
    throw new Error('Missing button: ' + text);
  };
  const idle = () => page.waitForFunction(() => !document.querySelector('[aria-label="Send response"]')?.disabled && !document.querySelector('#guided-response')?.disabled || document.querySelector('#guided-response') && !document.querySelector('#guided-response').disabled, { timeout: 10000 });
  const fill = async text => { await page.$eval('#guided-response', (el, value) => { const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); }, text); };
  try {
    await page.setViewport({ width: 1440, height: 960 }); await page.goto(base); await page.waitForSelector('#guided-response'); await idle();
    await capture('Automatic preparation; microphone remains off until user action', async () => {
      assert.equal(await page.evaluate(() => window.microphoneStarts), 0); assert.equal(saved.plan.length, 5);
      assert.equal(await page.$eval('[data-testid="guided-current-question"]', el => el.textContent), questions[0]);
    });
    await capture('Browsing during typing preserves the question and explicit image attribution', async () => {
      await fill('It should feel calm.'); await page.click('[aria-label="Next photograph"]');
      assert.equal(await page.$eval('[data-testid="guided-current-question"]', el => el.textContent), questions[0]);
      await page.click('[aria-label="Send response"]'); await idle();
      assert.equal(saved.turns[0].selectedImageId, null); assert.equal(saved.plan.length, 6);
      assert.equal(saved.plan.find(q => q.id === saved.activeQuestionId).kind, 'followup');
    });
    await page.screenshot({ path: path.join(out, 'desktop.png'), fullPage: true });
    await capture('Failed saves retain composer text and retry uses the same request ID', async () => {
      failSave = true; await fill('The first gathering showed how easily people could move between the two rooms.'); await page.click('[aria-label="Send response"]');
      await page.waitForFunction(() => document.body.textContent.includes('Fixture save unavailable'));
      const failed = requests.at(-1); assert.equal(await page.$eval('#guided-response', el => el.value), failed.text);
      await clickText('Retry save'); await idle(); assert.equal(requests.at(-1).requestId, failed.requestId);
    });
    await capture('Lost successful response replays once without duplicate evidence', async () => {
      loseReply = true; await fill('We kept the footprint and focused on the relationship between the shared rooms.'); await page.click('[aria-label="Send response"]');
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(el => el.textContent === 'Retry save'));
      const count = saved.turns.length; await clickText('Retry save'); await idle(); assert.equal(saved.turns.length, count);
    });
    await capture('Pause and refresh restore the exact cursor and unsent response', async () => {
      await fill('The plan began with a clear route from the entrance.'); const question = saved.activeQuestionId;
      await clickText('Pause & close'); await page.waitForSelector('#guided-response', { hidden: true });
      await page.reload(); await page.waitForSelector('#guided-response'); await idle();
      assert.equal(saved.activeQuestionId, question); assert.equal(await page.$eval('#guided-response', el => el.value), 'The plan began with a clear route from the entrance.');
    });
    await capture('Long transcription is retained in full and blocked explicitly at save limit', async () => {
      await fill(''); transcript = 'Spoken detail '.repeat(190); failTranscription = true;
      await page.click('[aria-label="Start microphone recording"]');
      await page.waitForFunction(() => document.body.textContent.includes('Stop ·'));
      const stop = await page.$$('button'); for (const button of stop) if ((await button.evaluate(el => el.textContent)).includes('Stop ·')) { await button.click(); break; }
      await page.waitForFunction(() => document.body.textContent.includes('Fixture transcription unavailable'));
      await clickText('Retry transcription');
      await page.waitForFunction(() => document.querySelector('#guided-response')?.value.length > 2000);
      assert.equal(await page.$eval('#guided-response', el => el.value), transcript);
      assert.equal(await page.$eval('[aria-label="Send response"]', el => el.disabled), true);
      assert.equal(await page.evaluate(() => window.microphoneStarts), 1);
      assert.ok((await page.evaluate(() => window.stoppedTracks)) > 0);
    });
    await fill('The doorways gave us a clear way to organize how people move through the house.'); await page.click('[aria-label="Send response"]'); await idle();
    await capture('Project obligations precede rooms; room transition uses exact image IDs', async () => {
      while (!saved.roomsPrepared) { await clickText('Skip question'); await idle(); }
      assert.equal(saved.plan.filter(q => q.roomId === null && q.kind === 'prepared').length, 5);
      assert.equal(saved.plan.find(q => q.id === saved.activeQuestionId).roomId, 'living');
      await page.waitForFunction(() => document.querySelector('section[aria-label="Project photographs"] img')?.getAttribute('src') === '/living.svg');
      await page.click('summary'); await clickText('Kitchen: 0 answered'); await idle();
      assert.equal(saved.plan.find(q => q.id === saved.activeQuestionId).roomId, 'kitchen');
      assert.ok(saved.plan.some(q => q.roomId === 'living' && q.status === 'pending'));
      await page.click('summary'); await clickText('Living room: 0 answered'); await idle();
      await clickText('Discuss this photo'); await fill('The route between the doors leaves room for people to sit together.'); await page.click('[aria-label="Send response"]'); await idle();
      assert.equal(saved.turns.at(-1).selectedImageId, 'living-photo');
    });
    await capture('Room skip preserves accepted material and records intentional skips', async () => {
      await clickText('Skip room'); await clickText('Skip remaining room questions'); await idle();
      assert.ok(saved.plan.some(q => q.roomId === 'living' && q.status === 'answered'));
      assert.ok(saved.turns.some(turn => turn.roomId === 'living' && turn.kind === 'skip'));
      assert.equal(saved.plan.find(q => q.id === saved.activeQuestionId).roomId, 'kitchen');
    });
    await capture('Earlier conversation stays still while typing', async () => {
      await page.$eval('[role="log"]', el => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll', { bubbles: true })); });
      await fill('The shared view across the room organized the plan.');
      assert.equal(await page.$eval('[role="log"]', el => el.scrollTop), 0);
      await clickText('Latest question');
    });
    await page.setViewport({ width: 390, height: 844 });
    await capture('Mobile panel and composer fit without horizontal overflow', async () => {
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.waitForFunction(() => { const rect = document.querySelector('[data-testid="guided-current-question"]')?.getBoundingClientRect(); return rect && rect.top >= 0 && rect.bottom <= innerHeight; });
      const rect = await page.$eval('[aria-label="Send response"]', el => ({ top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom }));
      assert.ok(rect.top >= 0 && rect.bottom <= 844, JSON.stringify(rect));
    });
    await page.screenshot({ path: path.join(out, 'mobile.png'), fullPage: true });
    await page.click('[aria-label="Send response"]'); await idle();
    await capture('Corrections keep original exchange and replace accepted evidence', async () => {
      await page.$eval('[role="log"]', el => { el.scrollTop = 0; });
      await clickText('Correct this answer'); await fill('Actually, they wanted a place for larger family gatherings, with quieter rooms nearby.');
      await clickText('Pause & close'); await page.waitForSelector('#guided-response', { hidden: true });
      await page.reload(); await page.waitForSelector('[aria-label="Save correction"]');
      assert.equal(await page.$eval('#guided-response', el => el.value), 'Actually, they wanted a place for larger family gatherings, with quieter rooms nearby.');
      await page.click('[aria-label="Save correction"]'); await idle();
      assert.ok(saved.turns.some(turn => turn.supersededBy)); assert.equal(saved.turns.at(-1).kind, 'correction');
    });
    await capture('Partial completion offers an editable draft and never publishes', async () => {
      await clickText('Finish with what I have'); await page.waitForFunction(() => document.body.textContent.includes('Prepare editable draft'));
      assert.ok(await page.evaluate(() => document.body.textContent.includes('shorter coverage')));
      await clickText('Prepare editable draft'); await page.waitForFunction(() => document.querySelector('#destination')?.textContent === 'Editable draft review');
      assert.equal(generationCalls, 1); assert.equal(saved.status, 'finished'); assert.ok(!requests.some(request => request.action === 'publish'));
    });
    await capture('A partial finished interview resumes its remaining prepared question', async () => {
      await clickText('Resume guided interview'); await page.waitForFunction(() => document.body.textContent.includes('Resume remaining questions'));
      await clickText('Resume remaining questions'); await idle();
      assert.equal(saved.status, 'active'); assert.equal(saved.plan.find(q => q.id === saved.activeQuestionId).status, 'active');
    });
    await capture('Skipping every remaining question still discloses shorter coverage', async () => {
      await clickText('Skip question');
      await page.waitForFunction(() => document.body.textContent.includes('Prepare editable draft'));
      assert.equal(saved.plan.filter(question => ['pending', 'active'].includes(question.status)).length, 0);
      assert.ok(await page.evaluate(() => document.body.textContent.includes('questions were skipped') && document.body.textContent.includes('shorter coverage')));
    });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'browser-results.json'), JSON.stringify({ fixture: 'Actual React component + controller; synthetic API, model, microphone and memory persistence; no production data.', passed: results }, null, 2));
  } catch (error) {
    await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true });
    console.error('Fixture failure state:', await page.evaluate(() => ({ text: document.body.innerText.slice(-3500), draft: document.querySelector('#guided-response')?.value })));
    throw error;
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

// Actual React review tray in Chromium; deterministic HTTP/research fixtures only.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.tmp/schedule-browser');
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#ddd"/><rect x="120" y="240" width="60" height="80" fill="#9b5b32"/></svg>');
const row = { name: 'Cognac leather chair', room: 'Living Room', brand: 'Fixture' };
const original = { id: 'row', description: row.name, roomType: row.room, extractedVendor: row.brand, extractedMaterial: 'Cognac leather', topSuggestion: { finishSchedule: { row, state: 'queued', matches: [], warnings: [] } } };
let tags = [structuredClone(original)], calls = 0, fail = false, confirms = [], manual = [];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const entry = path.join(out, 'entry.tsx');
  fs.writeFileSync(entry, `import React,{useState,useCallback,useEffect} from 'react'; import {createRoot} from 'react-dom/client'; import {FinishScheduleReview} from '../../src/components/project/FinishScheduleReview';
function App(){const [tags,setTags]=useState([]);const refresh=useCallback(async()=>{setTags(await(await fetch('/tags')).json())},[]);useEffect(()=>{refresh()},[refresh]);return <FinishScheduleReview tags={tags} photos={[{id:'photo',url:${JSON.stringify(image)}}]} onRefresh={refresh} onPlace={tag=>fetch('/manual',{method:'POST',body:JSON.stringify(tag)})} onDismiss={async id=>{await fetch('/dismiss',{method:'POST'});await refresh()}} onConfirm={async(tag,useResearch)=>{const r=await fetch('/confirm',{method:'POST',body:JSON.stringify({id:tag.id,useResearch})});if(r.ok)await refresh()}}/>}createRoot(document.getElementById('root')).render(<App/>);`);
  await esbuild.build({ entryPoints: [entry], bundle: true, outfile: path.join(out, 'bundle.js'), platform: 'browser', jsx: 'automatic', tsconfig: path.join(root, 'tsconfig.json') });
  const server = http.createServer(async(req,res) => {
    let body=''; for await(const chunk of req)body+=chunk;
    const json = (v,status=200) => {res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(v));};
    if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.join(out,'bundle.js')));return;}
    if(req.url==='/tags'){json(tags);return;}
    if(req.url==='/confirm'){confirms.push(JSON.parse(body));tags=[];json({ok:true});return;}
    if(req.url==='/manual'){manual.push(JSON.parse(body));json({ok:true});return;}
    if(req.url==='/dismiss'){tags=[];json({ok:true});return;}
    if(req.url.includes('/research')){
      calls++;
      if(fail){json({error:'Unavailable'},503);return;}
      tags[0].topSuggestion.finishSchedule = {...tags[0].topSuggestion.finishSchedule,state:'done',matches:[{imageId:'photo',x:.25,y:.7,confidence:'high',reason:'Brown leather seat'}],research:{productUrl:'https://vendor.test/chair',productName:'Cognac leather chair',exact:true,confidence:'high',priceCents:50000,sku:'C-01',dimensions:'24 in wide',material:'Leather',description:'Leather chair from the source',finish:'Cognac'},warnings:[]};
      json({review:tags[0].topSuggestion.finishSchedule});return;
    }
    res.end('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  server.unref();
  const browser = await puppeteer.launch({executablePath:process.env.GUIDED_TEST_BROWSER || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    const url=`http://127.0.0.1:${server.address().port}`;
    const waitText=text=>page.waitForFunction(t=>document.body.innerText.includes(t),{},text);
    const clickText=text=>page.evaluate(t=>[...document.querySelectorAll('button')].find(b=>b.textContent===t).click(),text);
    await page.setViewport({width:390,height:844});await page.goto(url);
    await waitText('Confirm suggested tag');assert.equal(calls,1);
    assert.equal(await page.$eval('[aria-label="Suggested pin"]',e=>e.style.left),'25%');
    assert.match(await page.$eval('body',e=>e.innerText),/\$500 \(source\)/);
    await page.click('input[type="checkbox"]');await clickText('Place manually');
    await page.waitForFunction(()=>true); await new Promise(r=>setTimeout(r,50));assert.equal(manual[0].useResearch,false);
    await clickText('Confirm suggested tag');await waitText('0 to review');assert.equal(confirms.length,1);assert.equal(confirms[0].useResearch,false);
    console.log('PASS auto research, source/field preview, percent pin, opt-out and confirmation');
    tags=[structuredClone(original)];fail=true;await page.reload();await waitText('Processing stopped.');
    const failedCalls=calls;await new Promise(r=>setTimeout(r,2200));assert.equal(calls,failedCalls,'failed HTTP must not spin');
    fail=false;await clickText('Resume');await waitText('Confirm suggested tag');
    console.log('PASS visible request failure, paused retries and Resume');
    await page.reload();await waitText('Confirm suggested tag');const readyCalls=calls;
    await new Promise(r=>setTimeout(r,2200));assert.equal(calls,readyCalls,'ready rows resume without rerunning');
    await clickText('Dismiss');await waitText('0 to review');assert.equal(errors.length,0,errors.join('\n'));
    console.log('PASS reload retains results, dismiss and no browser exceptions');
  } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

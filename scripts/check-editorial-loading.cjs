// Actual loading/layout components, synthetic routing/session/data boundaries.
// No production APIs or accounts. Set LOADING_TEST_BROWSER to Chromium.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.tmp/editorial-loading');
fs.mkdirSync(out, { recursive: true });

async function main() {
  await esbuild.build({
    stdin: { contents: `
      import React,{useState,StrictMode} from 'react';
      import {createRoot} from 'react-dom/client';
      import {LoadingBrandProvider,LoadingSurface} from './src/components/loading/LoadingBrand';
      import Layout from './src/components/layouts/RoleBasedLayout';
      import Home from './src/app/loading';
      import Feed from './src/app/feed/loading';
      import Events from './src/app/events/loading';
      import Photographer from './src/app/photographer/[username]/loading';
      import {HomepageHeroXL} from './src/components/homepage/HomepageHeroXL';
      function App(){const [state,setState]=useState({loading:true,route:'/',nested:false});window.fixture=(next)=>{history.replaceState({},'',next.route||state.route);setState(s=>({...s,...next}))};
        const Component=state.route.startsWith('/feed')?Feed:state.route==='/events'?Events:state.route.startsWith('/photographer/')?Photographer:Home;
        return <LoadingBrandProvider><Layout>{state.loading?<Component/>:<div data-ready><section className="pt-2"><HomepageHeroXL hero={{postSlug:'fixture',heroImageUrl:'/fixture.jpg',title:'A considered home',eyebrow:'At home',designerName:'Studio'}}/></section><button id="ready-action" onClick={()=>window.clicked=true}>Ready action</button></div>}{state.nested&&<LoadingSurface label="Loading section"><div style={{height:100}}/></LoadingSurface>}</Layout></LoadingBrandProvider>;
      }createRoot(document.getElementById('root')).render(<StrictMode><App/></StrictMode>);
    `, resolveDir: root, loader: 'tsx' },
    outfile: path.join(out, 'bundle.js'), bundle: true, platform: 'browser', jsx: 'automatic',
    alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' },
    plugins: [{ name: 'boundaries', setup(build) {
      build.onResolve({ filter: /^(next-auth\/react|next\/image|next\/navigation)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onResolve({ filter: /(?:\/)(SupportModal|FolioBadgeModal|CreateCollaborationModal|Footer)$/ }, args => ({ path: args.path, namespace: 'empty' }));
      build.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:'export const Footer=()=>null;export const CreateCollaborationModal=()=>null;export default ()=>null;'}));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root, contents: args.path === 'next-auth/react'
        ? `export const useSession=()=>({status:window.sessionStatus||'loading',data:null});export const signOut=()=>{};`
        : args.path === 'next/navigation' ? `export const usePathname=()=>location.pathname;export const useRouter=()=>({push:()=>{},replace:()=>{}});export const useSearchParams=()=>new URLSearchParams(location.search);`
        : `import React from 'react';export default ({fill,priority,unoptimized,...p})=><img {...p} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}}/>;` }));
    } }],
  });
  const globals = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  const config = require(path.join(root, 'tailwind.config.js'));
  config.content = [path.join(root, 'src/**/*.{ts,tsx}'), {raw:'pt-4 sm:pt-8',extension:'html'}];
  let css = (await postcss([tailwind(config)]).process(globals, { from: path.join(root, 'src/app/globals.css') })).css;
  // Use build-produced fonts when available; functional checks do not rely on a font download.
  let fonts='', heading='Georgia', body='Arial';
  const cssDir=path.join(root,'.next/static/css');
  if(fs.existsSync(cssDir))for(const file of fs.readdirSync(cssDir).filter(f=>f.endsWith('.css'))){
    for(const face of fs.readFileSync(path.join(cssDir,file),'utf8').match(/@font-face\{[^}]+\}/g)||[]){
      if(/Cormorant_Garamond|Instrument_Sans/.test(face)&&!/Fallback/.test(face)){
        fonts+=face;const family=face.match(/font-family:([^;]+)/)[1];
        if(/Cormorant_Garamond/.test(face))heading=family;else body=family;
      }
    }
  }
  css+=fonts+`\n:root{--font-headline:${heading};--font-body:${body}}`;
  fs.writeFileSync(path.join(out,'globals.css'),css);
  const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/bundle.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
  const server=http.createServer((req,res)=>{
    const name=new URL(req.url,'http://localhost').pathname;
    if(name.startsWith('/api/')){res.setHeader('Content-Type','application/json');return res.end('{"notifications":[],"unreadCount":0}');}
    if(name==='/fixture.jpg'){res.setHeader('Content-Type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#ddd"/></svg>');}
    const file=/\.woff2$/.test(name)?path.join(root,'.next/static/media',path.basename(name)):path.join(out,path.basename(name));
    if(/\.(js|css|woff2)$/.test(name)&&fs.existsSync(file)){res.setHeader('Content-Type',name.endsWith('.css')?'text/css':name.endsWith('.woff2')?'font/woff2':'application/javascript');return fs.createReadStream(file).pipe(res);}
    res.setHeader('Content-Type','text/html');res.end(html);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const executablePath=process.env.LOADING_TEST_BROWSER||'/usr/bin/chromium';
  const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base=`http://127.0.0.1:${server.address().port}`;
  await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith(base)?r.continue():r.abort());
  const set=async state=>{await page.evaluate(s=>window.fixture(s),state);await page.evaluate(()=>new Promise(requestAnimationFrame));};
  const opacity=()=>page.$eval('.folio-loading-mark',e=>Number(getComputedStyle(e).opacity));
  const waitMark=()=>page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.folio-loading-mark')).opacity)>.1);
  const waitHidden=()=>page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.folio-loading-mark')).opacity)===0);
  const results=[];
  try{
    for(const width of [320,390,768,1440]){
      await page.setViewport({width,height:1000});await page.goto(base,{waitUntil:'networkidle0'});await page.evaluate(()=>document.fonts.ready);
      await waitMark();
      const initial=await page.$eval('[data-skeleton-hero]',e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}));
      assert.equal(await page.$eval('[data-folio-brand-target]',e=>getComputedStyle(e).opacity),'1');
      assert.equal(await page.$eval('.folio-loading-mark',e=>getComputedStyle(e).pointerEvents),'none');
      await page.screenshot({path:path.join(out,`home-loading-${width}.png`)});
      await set({loading:false});
      const loaded=await page.$eval('[data-ready] section a > div:first-child',e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}));
      assert.deepEqual(initial,loaded,'Homepage hero geometry must match');
      assert.ok(await page.$('[data-ready]'),'Content ready before animation finishes');
      await waitHidden();
      for(const route of ['/events','/feed','/feed?mode=updates','/photographer/fixture']){
        await set({loading:true,route});await waitMark();
        const documentWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
        assert.ok(documentWidth<=width,`${route} overflow at ${width}: ${documentWidth}`);
        await page.screenshot({path:path.join(out,`${route.includes('updates')?'updates':route.split('/')[1]}-${width}.png`)});
        await set({loading:false});await waitHidden();
      }
      results.push(`Matched hero geometry and no loading overflow at ${width}px across five layouts`);
    }
    // Resize while pending remeasures the mark; the existing header survives auth resolution.
    await set({loading:true,route:'/'});await waitMark();
    await page.evaluate(()=>{window.originalBrand=document.querySelector('[data-folio-brand-target]');window.sessionStatus='unauthenticated'});
    await page.setViewport({width:390,height:844});await set({loading:true});
    const center=await page.$eval('.folio-loading-mark',e=>{const r=e.getBoundingClientRect();return r.left+r.width/2});
    assert.ok(Math.abs(center-195)<2,'Mark stays centered after resize');
    assert.equal(await page.evaluate(()=>window.originalBrand===document.querySelector('[data-folio-brand-target]')),true);
    await set({loading:false});
    await page.$eval('#ready-action',e=>e.click());assert.equal(await page.evaluate(()=>window.clicked),true);
    await waitHidden();results.push('Resize, persistent header across session resolution, and ready content interaction');
    // Fast loads: the decoration never flashes or prolongs loading.
    await set({loading:true,route:'/'});await set({loading:false});await waitHidden();
    await new Promise(r=>setTimeout(r,200));assert.equal(await opacity(),0);results.push('Fast load skips branding');
    // New fallback during an exit cancels the old animation without hiding the new state.
    await set({loading:true});await waitMark();await set({loading:false});await set({loading:true});await waitMark();
    await new Promise(r=>setTimeout(r,320));assert.ok(await opacity()>.1);results.push('Interrupted transition remains loading');
    // Overlapping boundaries resolve only after the last source leaves.
    await set({nested:true});await set({loading:false});assert.ok(await opacity()>.1);
    await set({nested:false});await waitHidden();results.push('Nested fallback handoff');
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    await set({loading:true});await waitMark();await set({loading:false});await waitHidden();
    assert.equal(await page.$eval('.folio-loading-mark',e=>e.getAnimations().length),0);results.push('Reduced motion has no collapse animation');
    await page.emulateMediaFeatures([]);
    await set({loading:true,route:'/project/fixture'});await waitMark();
    assert.equal(await page.$$eval('[data-skeleton-hero]',els=>els.length),0);results.push('Inherited root fallback never impersonates homepage');
    await set({route:'/auth/signin'});await waitHidden();
    assert.equal(await page.$$eval('[data-folio-brand-target]',els=>els.length),0);results.push('Auth routes remain unbranded');
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors,fonts:heading,scope:'Actual React components; synthetic router/session/data. No production API calls.'},null,2));
    console.log(JSON.stringify({results,errors,fonts:heading},null,2));
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1});

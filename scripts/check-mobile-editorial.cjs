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
const out = path.join(root, '.tmp/mobile-editorial');
fs.mkdirSync(out, { recursive: true });

async function main() {
  await esbuild.build({
    stdin: { contents: `
      import React,{useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {EditorialMasthead} from './src/components/navigation/EditorialMasthead';
      import {HomepageHeroXL} from './src/components/homepage/HomepageHeroXL';
      import {BoostReel} from './src/components/homepage/BoostReel';
      import {HomepageSkeleton} from './src/components/homepage/HomepageSkeleton';
      const hero={postSlug:'fixture',heroImageUrl:'/fixture.jpg',title:'Against Cape Town’s mountains, Bradley Prasky chose weight.',eyebrow:'Editorial feature',designerName:'Bradley Prasky'};
      const items=Array.from({length:7},(_,i)=>({productId:String(i),productSlug:'product-'+i,name:'Considered natural stone table '+i,imageUrl:'/fixture.jpg',vendorName:'Studio',isBoosted:false,slotPosition:i}));
      function App(){const [user,setUser]=useState(null);window.setUser=u=>{window.fixtureUser=u;setUser(u)};
        return <><EditorialMasthead/><main><section className="pt-4 sm:pt-8"><HomepageHeroXL hero={hero}/></section><section className="px-4 sm:px-10 mt-6 sm:mt-4 max-w-[1440px] mx-auto"><BoostReel items={items} totalTagged={10} postSlug="fixture"/></section></main><div data-loading hidden><HomepageSkeleton/></div></>;
      }createRoot(document.getElementById('root')).render(<App/>);
    `, resolveDir: root, loader: 'tsx' },
    outfile: path.join(out, 'bundle.js'), bundle: true, platform: 'browser', jsx: 'automatic',
    alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' },
    plugins: [{ name: 'boundaries', setup(build) {
      build.onResolve({ filter: /^(next-auth\/react|next\/image|next\/navigation)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onResolve({ filter: /(?:\/)(SupportModal|FolioBadgeModal|CreateCollaborationModal|Footer)$/ }, args => ({ path: args.path, namespace: 'empty' }));
      build.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:'export const Footer=()=>null;export const CreateCollaborationModal=()=>null;export default ()=>null;'}));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root, contents: args.path === 'next-auth/react'
        ? `export const useSession=()=>({status:window.fixtureUser?'authenticated':'unauthenticated',data:window.fixtureUser?{user:window.fixtureUser}:null});export const signOut=()=>{};`
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
  const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
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
  const results=[];
  try {
    for(const width of [320,375,390,430,768,1440]) {
      await page.setViewport({width,height:1000});await page.goto(base,{waitUntil:'networkidle0'});
      await page.waitForSelector('h1');await page.evaluate(()=>document.fonts.ready);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow '+width);
      const geometry=await page.evaluate(()=>{const h=document.querySelector('h1');const img=document.querySelector('main img');const list=document.querySelector('[role=list]');const children=[...list.children];return {headline:h.getBoundingClientRect().top,imageBottom:img.getBoundingClientRect().bottom,clamp:getComputedStyle(h).webkitLineClamp,rows:children.map(e=>e.getBoundingClientRect().top),scroll:list.scrollWidth>list.clientWidth};});
      if(width<640){
        assert.ok(geometry.headline>=geometry.imageBottom,'Headline below image');assert.equal(geometry.clamp,'none');
        assert.ok(geometry.scroll,'Products horizontally scroll');assert.ok(geometry.rows.every(y=>y===geometry.rows[0]),'Products never wrap');
        await page.$eval('[role=list]',e=>e.scrollLeft=e.scrollWidth);
        assert.ok(await page.$eval('[role=list]',e=>e.scrollLeft>0),'Rail scroll reaches last item');
        assert.equal(await page.$eval('a[aria-label="Search Folio"]',e=>e.getAttribute('href')),'/search');
        await page.click('[aria-label="Toggle menu"]');
        assert.ok(await page.$('a[href="/auth/signin"]'),'Sign in remains accessible');
        await page.click('[aria-label="Toggle menu"]');
        await page.$eval('[role=list]',e=>e.scrollLeft=0);
      }else{assert.ok(geometry.headline<geometry.imageBottom,'Desktop overlay retained');}
      await page.screenshot({path:path.join(out,'mobile-'+width+'.png')});
      await page.evaluate(()=>window.setUser({id:'fixture',name:'Designer',role:'DESIGNER'}));
      await page.waitForSelector('[aria-label="Notifications"]');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Authenticated header fits '+width);
      if(width<640){
        await page.click('[aria-label="Notifications"]');
        assert.ok(await page.evaluate(()=>{const e=[...document.querySelectorAll('div')].find(e=>e.className.includes('max-h-96'));const b=e.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth}),'Notification panel fits');
        await page.click('[aria-label="Notifications"]');
        await page.click('[aria-label="Toggle menu"]');assert.ok(await page.$('a[href="/inbox"]'));assert.ok(await page.$('[aria-label="Open my Folio Badge"]'));
      }
      results.push('PASS '+width+'px anonymous/authenticated, hero and reel');
    }
    assert.deepEqual(errors,[]);console.log(results.join('\n'));
  } finally {await browser.close();server.close();}
}
main().catch(e=>{console.error(e);process.exit(1)});

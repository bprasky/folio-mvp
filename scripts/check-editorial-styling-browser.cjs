// Actual React components/CSS with local data and framework adapters. No account writes.
// Compare against the reviewed parent to detect layout, ordering and utility regressions.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const puppeteer = require('puppeteer-core');
require('tsx/cjs');
const { themeInitializationScript } = require('../src/lib/theme.ts');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.tmp/editorial-browser');
const base = process.env.EDITORIAL_BASE_REF || 'd1390362';
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const changed = new Set(git(['diff', '--name-only', base]).trim().split(/\r?\n/));
const read = (file, before) => before && changed.has(file) ? git(['show', `${base}:${file}`]) : fs.readFileSync(path.join(root, file), 'utf8');
fs.mkdirSync(out, { recursive: true });

const posts = Array.from({ length: 12 }, (_, i) => ({ id: `project-${i}`, title: `Project ${i + 1}`, imageUrl: `/photo.jpg?i=${i}`, postSlug: `project-${i}`, isEditorial: i < 2, publishedAt: '2026-11-01T12:00:00Z' }));
const products = Array.from({ length: 7 }, (_, i) => ({ productId: `product-${i}`, productSlug: `product-${i}`, name: `Material ${i + 1}`, imageUrl: `/photo.jpg?i=${i}`, vendorName: 'Fixture maker', isBoosted: i < 2, boostId: i < 2 ? `boost-${i}` : undefined, slotPosition: i + 1 }));
const data = { hero: { postSlug: 'fixture-feature', title: 'A home shaped by light and material', heroImageUrl: '/photo.jpg', studio: 'Fixture Design Studio', eyebrow: 'Editorial Feature' }, reel: { items: products, totalTagged: 10 }, feedPosts: posts, nextCursor: 'page-2' };
const projects = posts.map((p, i) => ({ ...p, name: p.title, status: 'published', images: [{ url: p.imageUrl }], rooms: [], storyHref: `/p/${p.postSlug}`, heroImage: p.imageUrl, saveCount: i }));
const shop = products.map((p, i) => ({ ...p, id: p.productId, vendor: p.vendorName, cropUrl: null, price: null, category: i % 2 ? 'LIGHTING' : 'FURNITURE', projectCount: 7 - i, sourceImageUrl: null, projectTitle: null, projectId: null }));
const moments = posts.map(p => ({ ...p, projectTitle: p.title, designerName: 'Fixture Studio', tagCompletionScore: 0.9 }));
const source = `import React from 'react'; import {createRoot} from 'react-dom/client';
import {HomepagePage} from './src/components/homepage/HomepagePage';
import {HomepageSkeleton} from './src/components/homepage/HomepageSkeleton';
import FlowMosaic from './src/components/feed/FlowMosaic';
import ProjectFlowMosaic from './src/components/org-profile/feed-layout/ProjectFlowMosaic';
import Designer from './src/app/designer/page';
import Shop from './src/app/designer/profile/tabs/ShopFeed';
import SearchMosaic from './src/components/search/SearchMosaic';
import {ThemeToggle} from './src/components/ThemeToggle';
import {Button} from './src/components/ui/button'; import {Input} from './src/components/ui/input';
import {Card} from './src/components/ui/card'; import {RidgeCard} from './src/components/ui/ridge-card';
import {Dialog,DialogContent,DialogTitle} from './src/components/ui/dialog';
const f=window.fixture;const route=location.pathname;
function Utilities(){const [open,setOpen]=React.useState(false);return <div className="p-6 space-y-4">
<Card data-probe="card">Card</Card><RidgeCard data-probe="ridge">Ridge card</RidgeCard>
<Input data-probe="input" aria-label="Fixture input"/><Button data-probe="button" onClick={()=>setOpen(true)}>Open dialog</Button>
<Dialog open={open} onOpenChange={setOpen}><DialogContent data-probe="dialog" aria-describedby={undefined}><DialogTitle>Fixture dialog</DialogTitle><Button onClick={()=>setOpen(false)}>Close</Button></DialogContent></Dialog></div>}
async function boot(){let content;
if(route==='/') content=await HomepagePage();
else if(route==='/skeleton')content=<HomepageSkeleton/>;
else if(route==='/events')content=<FlowMosaic events={f.projects} canEdit/>;
else if(route==='/org/fixture')content=<ProjectFlowMosaic projects={f.projects}/>;
else if(route==='/onboarding')content=<FlowMosaic events={f.projects} preserveOrder onSelect={id=>window.selected=id}/>;
else if(route==='/designer')content=<Designer/>;
else if(route==='/shop')content=<Shop products={f.shop}/>;
else if(route==='/search')content=<SearchMosaic moments={f.moments} scope="public" onMomentClick={m=>window.selected=m.id} onMomentSave={id=>window.saved=id}/>;
else if(route==='/settings')content=<ThemeToggle/>;
else content=<Utilities/>;
createRoot(document.getElementById('root')).render(content);window.ready=true;}boot();`;

async function build(before) {
  const label = before ? 'before' : 'after';
  await esbuild.build({ stdin: { contents: source, loader: 'tsx', resolveDir: root }, bundle: true, outfile: path.join(out, `${label}.js`), platform: 'browser', jsx: 'automatic', alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' }, plugins: [{ name: 'fixture-boundaries', setup(b) {
    b.onResolve({ filter: /^(next\/(link|image|navigation)|next-auth\/react|@\/lib\/(auth|homepage\/getHomepageData))$|RoleContext$|ProjectCreationModal$|AddToProjectModal$/ }, a => ({ path: a.path, namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => {
      let contents;
      if (a.path==='next/link') contents=`import React from 'react';export default ({href,children,prefetch,scroll,onClick,...p})=><a href={href} {...p} onClick={e=>{onClick?.(e);if(!e.defaultPrevented){e.preventDefault();window.lastHref=href;}}}>{children}</a>`;
      else if(a.path==='next/image') contents=`import React from 'react';export default React.forwardRef(({fill,priority,unoptimized,quality,loader,style,...p},ref)=><img ref={ref} {...p} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',...style}:style}/>);`;
      else if(a.path==='next/navigation') contents=`import {useSyncExternalStore} from 'react';const subscribe=f=>{window.addEventListener('fixture-route',f);return()=>window.removeEventListener('fixture-route',f)};let cached='',params;export function useSearchParams(){const search=useSyncExternalStore(subscribe,()=>location.search);if(!params||cached!==search){cached=search;params=new URLSearchParams(search)}return params}export const usePathname=()=>location.pathname;export const useRouter=()=>({push:url=>{history.pushState({},'',url);window.dispatchEvent(new Event('fixture-route'))},replace:url=>history.replaceState({},'',url),refresh:()=>{}});`;
      else if(a.path==='@/lib/auth')contents=`export const auth=async()=>({user:{id:'fixture'}});`;
      else if(a.path==='@/lib/homepage/getHomepageData')contents=`export const getHomepageData=async()=>window.fixture.data;`;
      else if(/RoleContext$/.test(a.path))contents=`export const useRole=()=>({role:'designer',activeProfileId:null,setActiveProfileId:()=>{}});`;
      else if(a.path==='next-auth/react')contents=`export const useSession=()=>({data:{user:{id:'fixture',role:'designer'}},status:'authenticated'});`;
      else contents='export default function UnusedModal(){return null}';
      return { loader:'tsx',contents,resolveDir:root };
    });
    b.onLoad({ filter: /\.(tsx?|css)$/ }, a => { const file=path.relative(root,a.path).replaceAll('\\','/');if(before&&changed.has(file))return {contents:read(file,true),loader:file.endsWith('.css')?'local-css':file.endsWith('.tsx')?'tsx':'ts',resolveDir:path.dirname(a.path)}; });
  }}] });
  const context={module:{exports:{}},require}; vm.runInNewContext(read('tailwind.config.js',before),context);
  const config=context.module.exports;
  config.content=[{raw:source,extension:'tsx'},...git(['ls-files','src/**/*.tsx']).trim().split(/\r?\n/).map(file=>({raw:read(file,before),extension:'tsx'}))];
  let css=read('src/app/globals.css',before).replace(/@import\s+"([^"]+)";/g,(_,file)=>file.startsWith('../styles/')?read('src/'+file.slice(3),before):'');
  css=(await postcss([tailwind(config)]).process(css,{from:path.join(root,'src/app/globals.css')})).css;
  css=css.replace(/@import[^;]+;/g,'');
  css+=`@font-face{font-family:EditorialHeadline;src:url('/fonts/CormorantGaramond.ttf')}@font-face{font-family:EditorialBody;src:url('/fonts/InstrumentSans.ttf')} :root{--font-headline:EditorialHeadline;--font-body:EditorialBody}`;
  fs.writeFileSync(path.join(out,`${label}.css`),css);
}

async function main(){
  await build(true); await build(false);
  const analytics=[];
  const server=http.createServer(async(req,res)=>{
    const u=new URL(req.url,'http://fixture');
    if(u.pathname==='/api/analytics/boost'){let body='';for await(const c of req)body+=c;analytics.push(JSON.parse(body));res.end('{}');return;}
    if(u.pathname==='/api/projects'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(projects));return;}
    if(u.pathname==='/api/homepage-feed'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({feedPosts:u.searchParams.has('cursor')?[{...posts[0],id:'extra',title:'Next page project',postSlug:'extra'}]:[posts[0]],nextCursor:null}));return;}
    if(u.pathname.startsWith('/fonts/')){res.end(fs.readFileSync(path.join(root,'public/fonts/publication',path.basename(u.pathname))));return;}
    if(u.pathname==='/photo.jpg'){
      if(process.env.EDITORIAL_PHOTO){res.setHeader('Content-Type','image/jpeg');res.end(fs.readFileSync(process.env.EDITORIAL_PHOTO));}
      else{res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#c8bcaa"/><path d="M0 700L1600 500V1000H0Z" fill="#827767"/><rect x="960" y="100" width="400" height="650" fill="#f2ede4"/></svg>');}return;
    }
    if(/^\/(before|after)\.(js|css)$/.test(u.pathname)){res.setHeader('Content-Type',u.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(out,u.pathname.slice(1))));return;}
    const label=u.searchParams.get('version')==='before'?'before':'after';
    res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script>${themeInitializationScript}</script><link rel="stylesheet" href="/${label}.css"></head><body><div id="root"></div><script>window.fixture=${JSON.stringify({data,projects,shop,moments})}</script><script src="/${label}.js"></script></body></html>`);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await puppeteer.launch({executablePath:process.env.EDITORIAL_TEST_BROWSER||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const results=[]; const errors=[];
  try{
    const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
    const origin=`http://127.0.0.1:${server.address().port}`;
    const go=async(route,version='after')=>{await page.goto(`${origin}${route}${route.includes('?')?'&':'?'}version=${version}`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.ready);await page.evaluate(()=>document.fonts.ready);};
    const clickText=async(text)=>page.evaluate(t=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===t);if(!e)throw Error('Missing button '+t);e.click()},text);
    if(process.env.EDITORIAL_CAPTURE_ONLY==='1'){
      const labels=[];
      for(const width of [390,1440])for(const theme of ['light','dark'])for(const version of ['before','after']){
        await page.setViewport({width,height:1000});await go('/settings');await page.evaluate(t=>localStorage.setItem('folio-theme',t),theme);await go('/',version);
        const colors=await page.evaluate(()=>[document.querySelector('.folio-eyebrow'),document.querySelector('nav[aria-label="Filter homepage feed"] button')].map(e=>{const s=getComputedStyle(e);return {text:e.textContent,color:s.color,background:s.backgroundColor}}));
        labels.push({width,theme,version,colors});
        await page.screenshot({path:path.join(out,`${version}-home-${theme}-${width}.png`),clip:{x:0,y:0,width,height:width<640?1500:1800}});
      }
      for(let i=0;i<labels.length;i+=2)assert.deepEqual(labels[i].colors,labels[i+1].colors,'Existing label colors must not regress');
      fs.writeFileSync(path.join(out,'visual-baseline.json'),JSON.stringify(labels,null,2));
      console.log('CAPTURED before/after light/dark desktop/mobile; existing label colors identical.');return;
    }
    const snapshot=()=>page.evaluate(()=>{
      const grids=[...document.querySelectorAll('.grid-flow-dense')];
      return {overflow:document.documentElement.scrollWidth>innerWidth,theme:document.documentElement.dataset.theme,
        grids:grids.map(g=>({cols:getComputedStyle(g).gridTemplateColumns.split(' ').length,gap:getComputedStyle(g).gap,tiles:[...g.children].map(e=>({text:e.textContent,links:[...e.querySelectorAll('a')].map(a=>a.getAttribute('href')),column:getComputedStyle(e).gridColumn,row:getComputedStyle(e).gridRow,height:e.getBoundingClientRect().height,top:e.getBoundingClientRect().top-g.getBoundingClientRect().top,radius:getComputedStyle(e).borderRadius}))}))};
    });
    for(const width of [320,390,768,1440]){
      await page.setViewport({width,height:width<640?844:1000});
      for(const theme of ['light','dark']){
        await go('/settings'); await page.evaluate(t=>localStorage.setItem('folio-theme',t),theme);
        for(const route of ['/','/events','/org/fixture','/onboarding','/designer','/shop']){
          await go(route,'before');const before=await snapshot();
          await go(route);const after=await snapshot();
          assert.equal(after.theme,theme);
          // Existing unrelated mobile overflow is recorded, never hidden by changing layouts.
          assert.equal(after.overflow,before.overflow,`${route} overflow changed at ${width}`);
          assert.equal(after.grids.length,before.grids.length);
          for(let g=0;g<after.grids.length;g++){
            const a=after.grids[g],b=before.grids[g];assert.equal(a.cols,b.cols);assert.equal(a.tiles.length,b.tiles.length);assert.equal(a.gap,'10px');
            for(let i=0;i<a.tiles.length;i++){
              const x=a.tiles[i],y=b.tiles[i];for(const k of ['text','links','column','row'])assert.deepEqual(x[k],y[k],`${route} ${k} changed`);
              assert.equal(x.radius,'6px');assert.ok(Math.abs(x.height-y.height-2)<1,`${route} tile height changed unexpectedly`);assert.ok(Math.abs(x.top-y.top)<1,`${route} placement changed`);
            }
          }
          results.push({route,width,theme,tiles:after.grids.flatMap(g=>g.tiles).length,preexistingOverflow:before.overflow});
        }
        await go('/search');assert.equal(await page.$eval('.cursor-pointer',e=>getComputedStyle(e).borderRadius),'6px');
        await page.click('.cursor-pointer');assert.equal(await page.evaluate(()=>window.selected),'project-0');
        await page.$eval('.cursor-pointer button',e=>e.click());assert.equal(await page.evaluate(()=>window.saved),'project-0');
        await go('/');
        const home=await page.evaluate(()=>({edges:[...document.querySelectorAll('.folio-editorial-container')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.left+parseFloat(s.paddingLeft)}),products:[...document.querySelectorAll('[data-product-id]')].map(e=>e.dataset.productId),scroll:document.querySelector('[role=list]').scrollWidth>document.querySelector('[role=list]').clientWidth,heroRadius:getComputedStyle(innerWidth<640?document.querySelector('img').parentElement:document.querySelector('a')).borderRadius,rule:getComputedStyle(document.querySelector('.border-y')).borderTopColor}));
        assert.equal(new Set(home.edges).size,1);assert.equal(home.edges[0],width<640?16:32);assert.equal(home.heroRadius,'8px');assert.deepEqual(home.products,products.map(p=>p.productId));assert.equal(home.scroll,width<640);assert.ok(home.rule.includes('0.7'));
        if(width===390||width===1440)await page.screenshot({path:path.join(out,`home-${theme}-${width}.png`),fullPage:true});
        await page.click('[data-product-id="product-0"]');assert.equal(await page.evaluate(()=>window.lastHref),'/products/product-0');
        await clickText('Following');await page.waitForFunction(()=>document.querySelectorAll('article').length===1);assert.equal(await page.$eval('h1',e=>e.textContent),data.hero.title);assert.equal(await page.$$eval('[data-product-id]',e=>e.length),7);
        await clickText('Following');await page.waitForFunction(()=>document.querySelectorAll('article').length===12);await clickText('Load more');await page.waitForFunction(()=>document.querySelectorAll('article').length===13);
        await go('/onboarding');await page.focus('[data-testid=mosaic-card-link]');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.selected),'project-0');
        await go('/shop');await page.click('article');assert.equal(await page.$eval('.max-w-3xl',e=>getComputedStyle(e).borderRadius),'28px');
        // Generic controls, cards and dialog frames must remain byte-for-byte equivalent in computed appearance.
        const utility=[];
        for(const version of ['before','after']){await go('/utility',version);await clickText('Open dialog');utility.push(await page.$$eval('[data-probe]',els=>els.map(e=>{const s=getComputedStyle(e);return [e.dataset.probe,s.borderRadius,s.backgroundColor,s.borderColor,s.padding,s.boxShadow]})));await page.keyboard.press('Escape');assert.equal(await page.$('[role=dialog]'),null);}
        assert.deepEqual(utility[1],utility[0]);
      }
    }
    await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:'dark'}]);await go('/settings');await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'networkidle0'});assert.equal(await page.$eval('html',e=>e.dataset.theme),'light');
    await page.focus('[role=switch]');await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>localStorage.getItem('folio-theme')),'dark');await go('/');assert.equal(await page.$eval('html',e=>e.dataset.theme),'dark');await page.reload({waitUntil:'networkidle0'});assert.equal(await page.$eval('html',e=>e.dataset.theme),'dark');
    assert.ok(analytics.some(e=>e.event==='boost_click'&&e.placement==='homepage_reel'));assert.ok(analytics.some(e=>e.event==='boost_impression'&&e.placement==='homepage_reel'));
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({base,results,errors,analyticsEvents:analytics.length},null,2));
    console.log(`PASS ${results.length} baseline comparisons; mobile/light/dark, unchanged order and row placement, aligned edges, filters/pagination/reel analytics, search/selection, unchanged utility frames and saved theme.`);
    console.log('Pre-existing overflow cases:',JSON.stringify(results.filter(r=>r.preexistingOverflow)));
  }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1});

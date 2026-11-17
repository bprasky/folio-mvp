// Real React/CSS in Chromium. Server authorization is tested separately by check-project-channel-routes.cjs.
// Optional PUBLIC_POST_FIXTURES/PUBLIC_ASSET_FIXTURES use read-only public snapshots, never private records.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
require('tsx/cjs');
const { publicPost } = require('../src/lib/post/publicPost.ts');
const { themeInitializationScript, THEME_STORAGE_KEY } = require('../src/lib/theme.ts');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.tmp/publication-layout');
fs.mkdirSync(out, { recursive: true });
const publicPosts = process.env.PUBLIC_POST_FIXTURES ? fs.readdirSync(process.env.PUBLIC_POST_FIXTURES).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(process.env.PUBLIC_POST_FIXTURES, f)))) : [];
const manifest = process.env.PUBLIC_ASSET_FIXTURES ? JSON.parse(fs.readFileSync(path.join(process.env.PUBLIC_ASSET_FIXTURES, 'manifest.json'))) : [];
const assets = new Map(manifest.filter(r => r.status === 200).map(r => [r.url, `/public-assets/${r.file}`]));
function localize(value) {
  if (typeof value === 'string') return assets.get(value) || value;
  if (Array.isArray(value)) return value.map(localize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localize(v)]));
  return value;
}
const heroQuote0 = 'A short approved quotation for space zero.';
const heroQuote1 = 'We opened this room to the garden, giving the family a quieter place to gather throughout the day.';
function fixture(count = 5) {
  return { id: 'fixture-post', projectId: 'fixture-project', slug: 'fixture', status: 'PUBLISHED', heroAssetId: count > 1 ? 'photo-1' : 'photo-0', excerpt: 'A photographic project with an independently published Folio feature.',
    project: { id: 'fixture-project', title: 'Channel fixture', description: 'Original project description.', isPublic: true, city: 'Miami', designerOrg: { id:'fixture-studio', name: 'Fixture Studio' }, designer: { id:'fixture-designer', name: 'Fixture designer' },
      images: Array.from({ length: count }, (_, i) => ({ id: `photo-${i}`, url: `/photo.svg?i=${i}`, name: `Photograph ${i}`, room: `Space ${Math.floor(i / 2)}`, roomId: `room-${Math.floor(i / 2)}`, inclusion: 'INCLUDED', tags: i === 0 ? [{ id: 'tag', productId: 'chair', product: { id: 'chair', name: 'Fixture chair', imageUrl: '/photo.svg', isPending: false } }] : [] })) },
    credits: [{ name: 'Fixture collaborator', role: 'Architecture', organizationId:'fixture-architect' }, { name: 'Fixture collaborator', role: 'Architecture', organizationId:'fixture-architect' }, { name: '' }, { name: 'Photo studio', url: 'https://example.com' }],
    expandedBlocks: { lead: { title: 'The original fixture headline', deck: 'The original fixture deck' }, introduction: ['The original introduction remains in the publication. Fixture designer worked with Fixture collaborator.'],
      galleryChapters: Array.from({ length: Math.ceil(count / 2) }, (_, i) => ({ id: `room-${i}`, roomId: `room-${i}`, title: `Space ${i}`, imageIds: [`photo-${i * 2}`, `photo-${i * 2 + 1}`], body: [`Original narrative for space ${i}.`], pullQuote: i === 0 ? heroQuote0 : i === 1 ? { selected: { text: heroQuote1 }, alternatives: [{text:'UNSELECTED_QUOTE'}] } : null })) } };
}
const source = `import React from 'react';import {createRoot} from 'react-dom/client';
import {StoryRenderer} from './src/components/story/StoryRenderer';
import {EditorialMasthead} from './src/components/navigation/EditorialMasthead';
import {ThemeToggle} from './src/components/ThemeToggle';
const f=window.fixture;
createRoot(document.getElementById('root')).render(<><EditorialMasthead/><main>
<nav aria-label="Project navigation" className="flex min-h-12 items-center border-b border-[var(--folio-border-subtle)] bg-[var(--surface-canvas)] px-5 text-[var(--folio-text-primary)] sm:px-10"><a href="/p/fixture" className="inline-flex min-h-11 items-center text-sm">← Back to project</a><span className="ml-auto font-serif">{f.post.project.title}</span></nav>
<StoryRenderer post={f.post}/></main>{new URLSearchParams(location.search).has('themeControls')&&<aside><ThemeToggle/></aside>}</>);`;
async function build() {
  await esbuild.build({ stdin: { contents: source, resolveDir: root, loader: 'tsx' }, outfile: path.join(out, 'bundle.js'), bundle: true, platform: 'browser', jsx: 'automatic', alias: { '@': path.join(root, 'src') },
    define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_FOLIO_EDITORIAL_PROFILE_HERO': '"true"', 'process.env': '{}' },
    plugins: [{ name: 'framework-boundaries', setup(b) {
      b.onResolve({ filter: /^(next\/navigation|next\/link|next\/image|next-auth\/react)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root, contents: args.path === 'next-auth/react' ? `export const useSession=()=>({status:'unauthenticated',data:null});export const signOut=async()=>{};` : args.path === 'next/navigation'
        ? `const router={push:u=>location.assign(u),refresh(){}};export const useRouter=()=>router;export const useSearchParams=()=>new URLSearchParams(location.search);export const usePathname=()=>location.pathname;`
        : args.path === 'next/link' ? `import React from 'react';export default ({href,children,prefetch,scroll,...p})=><a href={href} {...p}>{children}</a>;`
          : `import React from 'react';export default React.forwardRef(({fill,priority,unoptimized,quality,loader,style,...p},ref)=><img ref={ref} {...p} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',...style}:style}/>);` }));
    } }],
  });
  const globals = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  const config = require(path.join(root, 'tailwind.config.js'));
  config.content = [path.join(root, 'src/components/navigation/**/*.tsx'), path.join(root, 'src/components/story/**/*.tsx'), path.join(root, 'src/components/org-profile/**/*.tsx'), path.join(root, 'src/components/feed/**/*.tsx'), path.join(root, 'src/app/p/**/*.tsx')];
  let css = (await postcss([tailwind(config)]).process(globals, { from: path.join(root, 'src/app/globals.css') })).css;
  css += '@font-face{font-family:FixtureHeadline;src:url(/fonts/CormorantGaramond.ttf);font-weight:400 600}@font-face{font-family:FixtureBody;src:url(/fonts/InstrumentSans.ttf);font-weight:400 600}:root{--font-headline:FixtureHeadline;--font-body:FixtureBody}body{font-family:var(--font-body)}';
  fs.writeFileSync(path.join(out, 'globals.css'), css);
}

async function main() {
  await build();
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://fixture');
    if(url.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({items:[],unreadCount:0}));return;}
    if(url.pathname==='/photo.svg'){
      const shape=url.searchParams.get('shape'),w=shape==='portrait'?800:shape==='square'?1000:1600,h=shape==='portrait'?1200:1000;
      res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'"><rect width="100%" height="100%" fill="#c5b59f"/><rect x="40" y="60" width="55%" height="70%" fill="#f0e9dd"/><path d="M0 '+h*.8+'L'+w+' '+h*.65+'V'+h+'H0Z" fill="#66746b"/><text x="60" y="140" font-size="32">'+(shape||'landscape')+'</text></svg>');return;
    }
    if(url.pathname.startsWith('/fonts/')){res.end(fs.readFileSync(path.join(root,'public/fonts/publication',path.basename(url.pathname))));return;}
    if(url.pathname.startsWith('/public-assets/')&&process.env.PUBLIC_ASSET_FIXTURES){res.end(fs.readFileSync(path.join(process.env.PUBLIC_ASSET_FIXTURES,path.basename(url.pathname))));return;}
    if(['/bundle.js','/bundle.css','/globals.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(out,path.basename(url.pathname))));return;}
    const original=publicPosts.find(p=>p.slug===url.pathname.split('/')[2]);
    const post=original?publicPost(localize(original)):fixture();
    if(!original){
      for(const image of post.project.images)image.url+='&shape='+(url.searchParams.get('shape')||'landscape');
      if(url.searchParams.has('long'))post.expandedBlocks.galleryChapters[0].body=Array.from({length:24},(_,i)=>'Paragraph '+i+'. The family wanted a place to gather, with daylight reaching the quiet corners of the room. Each material was selected for the way it would age.');
      if(url.searchParams.has('gallery'))post.expandedBlocks.galleryChapters=[];
      if(url.searchParams.has('accent'))post.expandedBlocks.presentation={version:1,accent:'#52624F',roomOrder:[]};
    }
    const theme=url.searchParams.get('theme');
    const initialize=(theme?`localStorage.setItem('${THEME_STORAGE_KEY}',${JSON.stringify(theme)});`:'')+themeInitializationScript+'window.initialTheme=document.documentElement.dataset.theme;';
    res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>'+initialize+'</script><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/bundle.css"></head><body><div id="root"></div><script>window.fixture='+JSON.stringify({post}).replaceAll('<','\u003c')+'</script><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(r=>server.listen(Number(process.env.PUBLICATION_PREVIEW_PORT||0),'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port;
  if(process.env.PUBLICATION_PREVIEW_PORT){console.log('Publication preview: '+origin+'/p/fixture/feature?room=room-0');return;}
  const executablePath=process.env.CHANNEL_TEST_BROWSER||['C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(fs.existsSync);
  server.unref();
  const browser=await puppeteer.launch({executablePath,userDataDir:fs.mkdtempSync(path.join(out,'chrome-')),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const results=[],errors=[];
  try{
    const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
    const settle=async()=>{await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>{const panel=document.querySelector('[data-publication-text]');return !panel||getComputedStyle(panel).opacity==='1';});};
    const go=async query=>{await page.goto(origin+'/p/fixture/feature?room=room-0&'+query,{waitUntil:'networkidle0'});await page.waitForSelector('[data-publication-phase="ready"]');await settle();};
    const palette={light:{background:'rgb(250, 248, 245)',ink:'rgb(26, 26, 26)',rule:'rgb(227, 222, 214)'},dark:{background:'rgb(27, 27, 25)',ink:'rgb(245, 245, 243)',rule:'rgb(58, 58, 54)'}};
    const verifyTheme=async(theme,{accent=false,initial=true}={})=>{
      const colors=await page.evaluate(key=>{
        const style=selector=>getComputedStyle(document.querySelector(selector));
        const masthead=getComputedStyle(document.querySelector('header > div'),'::before');
        return {theme:document.documentElement.dataset.theme,initial:window.initialTheme,saved:localStorage.getItem(key),body:style('body').backgroundColor,scheme:style('body').colorScheme,header:masthead.backgroundColor,blur:masthead.backdropFilter,nav:style('[aria-label="Project navigation"]').backgroundColor,navInk:style('[aria-label="Project navigation"]').color,text:style('[data-publication-text]').color,panel:style('[data-publication-text]').backgroundColor,select:style('[aria-label="Go to room"]').backgroundColor,rule:style('[aria-label="Project navigation"]').borderBottomColor};
      },THEME_STORAGE_KEY);
      const expected=palette[theme];
      assert.equal(colors.theme,theme);assert.equal(colors.saved,theme,'Reader preserves saved preference');
      if(initial)assert.equal(colors.initial,theme,'Saved theme is applied before React renders');
      assert.equal(colors.scheme,theme,'Native controls follow theme');
      for(const surface of ['body','header','nav'])assert.equal(colors[surface],expected.background,surface+' follows '+theme);
      for(const text of ['text','navInk'])assert.equal(colors[text],expected.ink,text+' follows '+theme);
      assert.equal(colors.rule,expected.rule);assert.equal(colors.blur,'none','Masthead remains crisp in either theme');
      if(!accent){assert.equal(colors.panel,expected.background);assert.equal(colors.select,expected.background);}
      else assert.notEqual(colors.panel,expected.background,'Saved accent still supplies a subtle tint');
      const luminance=color=>{
        const channels=color.startsWith('color(srgb')?color.slice(11,-1).trim().split(/\s+/).map(Number):color.match(/[\d.]+/g).slice(0,3).map(n=>Number(n)/255);
        return channels.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      };
      const ink=luminance(colors.text),paper=luminance(colors.panel);
      assert.ok((Math.max(ink,paper)+.05)/(Math.min(ink,paper)+.05)>=7,'Reading text retains strong contrast, including saved accents');
      return colors;
    };
    for(const [width,height] of [[1920,1080],[1440,1000],[1280,720],[1024,1024],[820,1180],[768,1024],[390,844],[320,640]]){
      await page.setViewport({width,height});
      for(const shape of ['landscape','portrait','square']){
       for(const theme of ['light','dark']){
        await go('shape='+shape+'&theme='+theme+'&long=1');
        await verifyTheme(theme);
        const layout=await page.evaluate(()=>{
          const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};
          const image=document.querySelector('[data-publication-image]'),text=document.querySelector('[data-publication-text]'),copy=document.querySelector('[role="region"]'),strip=document.querySelector('[aria-label="All rooms"]');
          const blurred=[...document.querySelectorAll('[data-publication-view] *')].filter(e=>getComputedStyle(e).filter.includes('blur')||getComputedStyle(e).backdropFilter!=='none');
          return {image:rect(image),text:rect(text),copy:rect(copy),strip:rect(strip),header:rect(document.querySelector('header')),photoFit:getComputedStyle(image.querySelector('img')).objectFit,photoAspect:image.querySelector('img').naturalWidth/image.querySelector('img').naturalHeight,copyOverflow:getComputedStyle(copy).overflowY,bodyColor:getComputedStyle(document.body).backgroundColor,blurred:blurred.length,overflow:document.documentElement.scrollWidth>innerWidth};
        });
        assert.equal(layout.overflow,false,'No horizontal overflow '+width+' '+shape);
        assert.equal(layout.blurred,0,'No blurred reader layers');assert.equal(layout.photoFit,'contain','Original image remains uncropped');
        assert.equal(layout.bodyColor,palette[theme].background,'Publication respects '+theme+' preference');
        assert.equal(layout.header.height,width<768?60:72,'Compact real masthead');
        if(width<=800){assert.ok(layout.text.y>=layout.image.bottom,'Reading follows image');assert.ok(layout.strip.y>=layout.image.bottom&&layout.strip.bottom<=layout.text.y+1,'Room strip sits between image and story');assert.equal(layout.copyOverflow,'visible','Phone article scrolls with document');}
        else {
          assert.ok(layout.text.x>=layout.image.right-1,'Reading beside photo');assert.equal(layout.text.y,layout.image.y);assert.equal(layout.copyOverflow,'auto');
          const photoWidth=Math.min(layout.image.width,layout.image.height*layout.photoAspect);
          assert.ok(layout.image.width-photoWidth<2,'Image column fits the actual photograph without horizontal dead space');
          assert.ok(layout.copy.width<=540,'Reading line length remains bounded');
          if(width>=1024)assert.ok(layout.copy.width>=310,'Reading column is not cramped');
        }
        await page.$eval('[role="region"]',e=>e.scrollTop=e.scrollHeight);
        assert.equal(await page.$eval('[data-publication-image]',e=>getComputedStyle(e.querySelector('img')).objectFit),'contain');
        await page.$eval('[role="region"]',e=>e.scrollTop=0);
        if(shape==='landscape'||width===1024||width===1440)await page.screenshot({path:path.join(out,'reader-'+width+'-'+shape+'-'+theme+'.png'),fullPage:width<=800});
        results.push({width,height,shape,theme,...layout});
       }
      }
    }
    await page.setViewport({width:1440,height:1000});await go('shape=portrait');
    await page.click('[aria-label="View full photograph without text"]');assert.equal(await page.$('[data-publication-text]'),null);
    await page.keyboard.press('Escape');await page.waitForSelector('[data-publication-text]');assert.ok(await page.$('[aria-label="Space 0 article"]'),'Escape restores the open article');
    await page.click('[aria-label="Collapse room article"]');await page.click('[aria-label="Read Space 0"]');
    const nextRoom=await page.$eval('[aria-label="Go to room"]',e=>e.options[2].value);await page.select('[aria-label="Go to room"]',nextRoom);
    await page.waitForSelector('[aria-label="Space 1 article"]');assert.equal(await page.$('[aria-label="Read Space 1"]'),null,'Desktop room changes open the article');
    await page.click('[aria-label="Space 1, photograph 2"]');assert.equal(await page.$eval('[data-publication-phase]',e=>e.dataset.publicationPhoto),'photo-3');
    await go('gallery=1');
    await page.click('[aria-label="Next room"]');
    assert.equal(await page.$eval('[data-publication-phase]',e=>e.dataset.publicationReading),'false','Selecting a photo-only gallery does not open a reading pane');
    await page.click('[aria-label="Previous room"]');await page.click('[aria-label="View full photograph of Space 0"]');await page.waitForSelector('[aria-label="Show room details"]');await page.click('[aria-label="Show room details"]');
    for(const theme of ['light','dark']){await go('accent=1&theme='+theme);await verifyTheme(theme,{accent:true});}
    await go('theme=light&themeControls=1');await verifyTheme('light');
    // Use the actual Settings switch, then the production head initializer on reload.
    await page.evaluate(()=>history.replaceState(null,'','?room=room-0&themeControls=1'));
    for(const theme of ['dark','light']){
      await page.click('[role="switch"]');await verifyTheme(theme,{initial:false});
      await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-publication-text]');await verifyTheme(theme);
    }
    for(const theme of ['light','dark']){
      await go('theme='+theme);await page.evaluate(()=>document.querySelector('[data-publication-view]').remove());
      assert.equal(await page.$eval('body',e=>getComputedStyle(e).backgroundColor),theme==='dark'?palette.dark.background:'rgb(255, 255, 255)','Leaving reader preserves app theme');
      assert.equal(await page.evaluate(key=>localStorage.getItem(key),THEME_STORAGE_KEY),theme);
    }
    for(const theme of ['light','dark']){
      await page.goto(origin+'/p/fixture/feature?theme='+theme,{waitUntil:'networkidle0'});
      await page.waitForSelector('[aria-label="Project introduction"]');await settle();await verifyTheme(theme);
      assert.equal(await page.$('[aria-label^="Begin "]'),null,'Desktop arrival has no gate');
      assert.equal(await page.$('[aria-label="Read project introduction"]'),null);
      assert.ok(await page.$eval('[aria-label="Project introduction"]',e=>e.innerText.includes('The original introduction')));
      assert.ok(await page.$('[aria-label="Project introduction"] a[href="/profile/fixture-designer"]'),'Named designer in prose links to their profile');
      assert.ok(await page.$('[aria-label="Project introduction"] a[href="/org/fixture-architect"]'),'Credited collaborator links to their firm');
      await page.screenshot({path:path.join(out,'introduction-desktop-'+theme+'.png')});
      await Promise.all([page.waitForNavigation(),page.click('[data-publication-text] a[href="/org/fixture-studio"]')]);
      assert.equal(new URL(page.url()).pathname,'/org/fixture-studio','Desktop byline opens its profile');
    }
    await page.setViewport({width:390,height:844});await page.goto(origin+'/p/fixture/feature',{waitUntil:'networkidle0'});
    assert.ok(await page.$('[aria-label="Begin Channel fixture"]'),'Mobile retains its cover');
    await page.setViewport({width:1440,height:1000});await page.waitForSelector('[aria-label="Project introduction"]');
    assert.equal(await page.$('[aria-label="Begin Channel fixture"]'),null,'Widening to desktop removes the gate');
    await page.setViewport({width:390,height:844});await page.goto(origin+'/p/fixture/feature',{waitUntil:'networkidle0'});
    await page.click('[aria-label="Begin Channel fixture"]');await page.waitForSelector('[data-publication-phase="ready"]');
    await Promise.all([page.waitForNavigation(),page.click('[data-publication-view] a[href="/org/fixture-studio"]')]);
    assert.equal(new URL(page.url()).pathname,'/org/fixture-studio','Mobile byline stays clickable above the expansion target');
    for(const post of publicPosts){
      for(const [width,height] of [[1440,1000],[1024,1024],[390,844]]){
        await page.setViewport({width,height});await page.goto(origin+'/p/'+post.slug+'/feature',{waitUntil:'networkidle0'});
        if(width<=800)await page.click('[aria-label="Begin '+post.project.title+'"]');
        await page.waitForSelector('[data-publication-phase="ready"]');
        if(width>800){await page.waitForSelector('[aria-label="Project introduction"]');await settle();await page.screenshot({path:path.join(out,'public-intro-'+post.slug+'-'+width+'.png')});}
        const room=await page.$eval('[aria-label="Go to room"]',e=>e.options[1].value);await page.select('[aria-label="Go to room"]',room);
        const read=await page.$('[aria-label^="Read "]');if(read)await read.click();
        await settle();await page.screenshot({path:path.join(out,'public-'+post.slug+'-'+width+'.png'),fullPage:width<=800});
      }
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
    console.log('PASS 48 viewport/photo-shape/theme combinations, immediate desktop reading, photo-aware proportions, saved theme before render, real theme switch/reload, themed controls, text contrast, no blur/overflow, mobile entry, long reading, collapse/restore, exact photos, galleries, saved accents and route exit.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1});

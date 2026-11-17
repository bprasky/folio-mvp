// Actual form components, Folio fonts and masthead; all writes stay in this fixture.
// --serve keeps the same fixture available for hands-on review with shared Chrome.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild'), postcss = require('postcss'), tailwind = require('tailwindcss');
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/workflow-forms');
const source = `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import CreateProjectPage from './src/app/projects/new/page';
import {EditorialMasthead} from './src/components/navigation/EditorialMasthead';
import {CreditsEditor} from './src/components/posting/CreditsEditor';
import {ProductEditModal} from './src/components/project/ProductEditModal';
import {WebsiteImportModal} from './src/components/import/WebsiteImportModal';
import {PresentationImportModal} from './src/components/import/PresentationImportModal';
import {PdfSpecImportModal} from './src/components/import/PdfSpecImportModal';
import DocumentImportModal from './src/app/project/[id]/DocumentImportModal';
import {PortfolioPhotoReview} from './src/components/projects/PortfolioPhotoReview';
import {WorkspaceImportClient} from './src/app/onboarding/workspace/WorkspaceImportClient';
import styles from './src/components/ui/WorkflowForms.module.css';
const mode=new URLSearchParams(location.search).get('screen')||'intake';
function App(){const [open,setOpen]=useState(false),[credits,setCredits]=useState([{role:'Designer',name:'Preview Studio'}]);
return <><EditorialMasthead/><p className="px-5 py-2 folio-meta text-folio-text-secondary">Development preview · Synthetic project · No live saves</p>
{mode==='intake'?<CreateProjectPage/>:mode==='workspace'?<WorkspaceImportClient access={{id:'firm',name:'Preview Studio',website:null,canEditProfile:true,canImportProjects:true,canContribute:true}} memberships={[{id:'firm',name:'Preview Studio'}]} available returnTo="/projects" history={[]}/>:<div className={styles.page}>
{mode!=='publishing'&&<header className={styles.header}><p className={styles.eyebrow}>Project workspace</p><h1 className={styles.title}>A home by the water</h1><p className={styles.lede}>Photographs, people and the story behind the work.</p></header>}
{mode==='credits'?<CreditsEditor credits={credits} onChange={setCredits}/>:mode==='publishing'?<PortfolioPhotoReview projectId="project" title="A home by the water" version={'a'.repeat(64)} coverImageId="photo-1" isPublic={false} profileHref="/org/firm" featureHref="/project/project?view=story" featureAction="Create my feature" rooms={[]} nextProject={null} photos={[0,1,2,3,4,5].map(i=>({id:'photo-'+i,url:'/photo.svg?i='+i,name:'Project photograph '+(i+1),inclusion:'INCLUDED',roomName:null}))}/>:<><button className={styles.primary} onClick={()=>setOpen(true)}>Open {mode}</button>
{mode==='product'&&open&&<ProductEditModal productId="product" onClose={()=>setOpen(false)} onSaved={()=>{}}/>}
{mode==='website'&&<WebsiteImportModal open={open} onOpenChange={setOpen} projectId="project" onComplete={()=>{}}/>}
{mode==='document'&&<DocumentImportModal open={open} onClose={()=>setOpen(false)} onSelect={file=>{window.chosenDocument=file.name;setOpen(false)}}/>}
{mode==='presentation'&&<PresentationImportModal open={open} onOpenChange={setOpen} projectId="project" projectTitle="A home by the water" onComplete={()=>{}}/>}
{mode==='pdf'&&<PdfSpecImportModal open={open} onOpenChange={setOpen} projectId="project" projectTitle="A home by the water" rooms={[]} onComplete={()=>{}}/>}
</>}
</div>}</>};createRoot(document.getElementById('root')).render(<App/>);`;
async function build() {
  fs.mkdirSync(out, { recursive: true });
  await esbuild.build({ stdin: { contents: source, resolveDir: root, loader: 'tsx' }, outfile: path.join(out, 'bundle.js'), bundle: true, platform: 'browser', jsx: 'automatic', alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' }, plugins: [{ name: 'framework-boundaries', setup(b) {
    b.onResolve({ filter: /^(next\/(navigation|link|image)|next-auth\/react|@\/app\/actions\/portfolio)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root, contents: args.path === 'next-auth/react'
      ? `const data={user:{id:'actor',name:'Preview Designer',operatingAsOrgId:'firm',operatingAsOrg:{name:'Preview Studio'}}};export const useSession=()=>({status:'authenticated',data,update:async()=>data});export const signOut=async()=>{};`
      : args.path === 'next/navigation' ? `const router={push:u=>{window.navigation=u},replace:u=>{window.navigation=u},refresh(){}};export const useRouter=()=>router;export const useSearchParams=()=>new URLSearchParams(location.search);export const usePathname=()=>'/projects/new';`
      : args.path === 'next/link' ? `import React from 'react';export default ({href,children,prefetch,scroll,...p})=><a href={href} {...p}>{children}</a>;`
      : args.path === 'next/image' ? `import React from 'react';export default React.forwardRef(({fill,priority,unoptimized,quality,loader,style,...p},ref)=><img ref={ref} {...p} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',...style}:style}/>);`
      : `export async function publishPortfolioAction(input){window.published=input;return {projectId:input.projectId}};export async function unpublishPortfolioAction(){}` }));
  } }] });
  const globals = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  const config = require(path.join(root, 'tailwind.config.js'));
  config.content = [path.join(root, 'src/**/*.{tsx,ts}'), { raw: source, extension: 'tsx' }];
  let css = (await postcss([tailwind(config)]).process(globals, { from: path.join(root, 'src/app/globals.css') })).css;
  css += '@font-face{font-family:FixtureHeadline;src:url(/fonts/CormorantGaramond.ttf);font-weight:400 600}@font-face{font-family:FixtureBody;src:url(/fonts/InstrumentSans.ttf);font-weight:400 600}:root{--font-headline:FixtureHeadline;--font-body:FixtureBody}body{font-family:var(--font-body)}';
  fs.writeFileSync(path.join(out, 'globals.css'), css);
}
let failPhoto = true;
function handler(req, res) {
  const url = new URL(req.url, 'http://fixture');
  const json = (value, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
  if (url.pathname === '/api/user/workspace-context') return json({ operatingAsOrgId: 'firm', organizations: [{ id: 'firm', name: 'Preview Studio', userRole: 'OWNER' }] });
  if (url.pathname === '/api/products/product') return json(req.method === 'PUT' ? {id:'product'} : { id:'product', name:'Oak lounge chair',brand:'Preview furniture',price:1200,category:'Seating',description:'Solid oak with a linen seat.',imageUrl:'/photo.svg',url:'https://example.com/chair' });
  if (url.pathname === '/api/import/website') { failPhoto = true; return json({ sessionId: 'import' }); }
  if (url.pathname === '/api/import/import') return json({status:'READY_FOR_REVIEW',processingMeta:{candidates:[{url:'/photo.svg?i=1',alt:'Living room'},{url:'/photo.svg?i=2',alt:'Kitchen'}]}});
  if (url.pathname === '/api/projects/project/images') {
    let body='';req.on('data',part=>body+=part);req.on('end',()=>{const data=JSON.parse(body);if(data.url?.endsWith('i=2')&&failPhoto){failPhoto=false;return json({error:'Synthetic upload failure'},503)}return json({image:{id:data.url,url:data.url}})});return;
  }
  if (url.pathname === '/api/projects') return json({id:'project'});
  if (url.pathname.startsWith('/api/')) return json({ items:[],users:[],unreadCount:0 });
  if (url.pathname.startsWith('/fonts/')) {res.setHeader('Content-Type','font/ttf');res.end(fs.readFileSync(path.join(root,'public/fonts/publication',path.basename(url.pathname))));return;}
  if (url.pathname === '/photo.svg') {res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#c5b59f"/><rect x="420" y="40" width="320" height="400" fill="#edf0e6"/><path d="M0 450L800 390V600H0Z" fill="#817a6a"/><rect x="60" y="330" width="420" height="170" rx="10" fill="#ece5da"/></svg>');return;}
  if (['/bundle.js','/bundle.css','/globals.css'].includes(url.pathname)) {res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(out,path.basename(url.pathname))));return;}
  const theme=url.searchParams.get('theme')==='dark'?'dark':'light';
  res.end('<!doctype html><html data-theme="'+theme+'" class="'+(theme==='dark'?'dark':'')+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Folio form review</title><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/bundle.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
}
(async()=>{
  await build();if(process.argv.includes('--build-only')){console.log('PASS actual workflow components bundle with production styles and fonts.');return;}const server=http.createServer(handler);await new Promise(resolve=>server.listen(process.argv.includes('--serve')?3107:0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  if(process.argv.includes('--serve')){console.log('Review fixture: '+base);return;}
  const browser=await require('puppeteer-core').launch({executablePath:process.env.GUIDED_TEST_BROWSER||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith(base)||r.url().startsWith('data:')?r.continue():r.abort());
  const click=async name=>{await page.waitForFunction(name=>[...document.querySelectorAll('button')].some(e=>e.textContent.trim()===name&&!e.disabled),{},name);for(const el of await page.$$('button'))if((await el.evaluate(e=>e.textContent.trim()))===name){await el.click();return el}throw Error(name)};
  const visit=async(screen,theme='light')=>page.goto(base+'?screen='+screen+'&theme='+theme,{waitUntil:'networkidle0'});
  const geometry=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
  try {
    for(const width of [1440,390,320])for(const theme of ['light','dark']){
      await page.setViewport({width,height:900});
      for(const screen of ['intake','workspace','credits','product','website','document','presentation','pdf','publishing']){
        console.log('Checking',screen,width,theme);
        await visit(screen,theme);
        let opener;
        if(screen==='credits')opener=await click('Add Credit');
        else if(!['intake','workspace','publishing'].includes(screen))opener=await click('Open '+screen);
        await geometry();
        if(!['intake','workspace','publishing'].includes(screen)){
          await page.waitForSelector('[role="dialog"]');
          const d=await page.$eval('[role="dialog"]',e=>({width:e.getBoundingClientRect().width,color:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor}));
          assert.ok(d.width<=width+1);assert.notEqual(d.color,d.bg,'readable sheet');
          await page.screenshot({path:path.join(out,screen+'-'+width+'-'+theme+'.png'),fullPage:true});
          await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
          // Radix restores focus in a deferred unmount callback; wait for the
          // exact opener instead of racing that callback immediately after removal.
          await page.waitForFunction(button=>document.activeElement===button,{},opener);
        }
        if(['intake','workspace','publishing'].includes(screen))await page.screenshot({path:path.join(out,screen+'-'+width+'-'+theme+'.png'),fullPage:true});
      }
      await visit('intake',theme);await click('Add project details first');await page.waitForSelector('input[name="title"]');await geometry();
      assert.equal(await page.$eval('textarea[name="description"]',e=>e.closest('details')?.open),false,'optional writing is collapsed');
      assert.equal(await page.$eval('textarea[name="description"]',e=>e.checkVisibility()),false,'description is not rendered while collapsed');
      await page.click('details > summary');
      assert.equal(await page.$eval('textarea[name="description"]',e=>e.checkVisibility()),true,'description is available after expanding details');
    }
    await page.setViewport({width:1280,height:900});await visit('credits');await click('Add Credit');
    await page.select('[role="dialog"] select','Architect');await page.type('[role="dialog"] input[type="text"]','Preview Architect');await click('Save credit');
    await page.waitForFunction(()=>document.body.innerText.includes('Preview Architect')&&!document.querySelector('[role="dialog"]'));
    await page.click('[aria-label="Edit credit for Preview Architect"]');await page.type('[role="dialog"] input[type="text"]',' changed');await click('Cancel');
    assert.equal(await page.evaluate(()=>document.body.innerText.includes('Preview Architect changed')),false);
    await visit('website');await click('Open website');await page.type('input[type="url"]','https://example.com/project');await click('Find photos');
    await page.waitForSelector('input[type="checkbox"]');await click('Add selected photos');
    await page.waitForSelector('[role="alert"]');assert.equal(await page.$$eval('input[type="checkbox"]',els=>els.length),1,'partial failure keeps only the retry selection');
    await click('Add selected photos');await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
    await visit('product');await click('Open product');await page.waitForFunction(()=>[...document.querySelectorAll('input')].some(e=>e.value==='Oak lounge chair'));await click('Save');await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
    assert.deepEqual(errors,[]);console.log('PASS workflow forms: 54 responsive/theme views, optional description, sheet dismissal/focus, credit save/cancel, product save, partial photo import retry. Synthetic services only.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});

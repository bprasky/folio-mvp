// Real marketing/auth UI with synthetic sessions, provider callbacks and API responses.
// Uses committed Folio fonts. No accounts, firms or uploads are created.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const puppeteer = require('puppeteer-core');
const dependencies = path.resolve(__dirname, '..');
const assets = process.env.MARKETING_TEST_ASSETS || path.dirname(fs.realpathSync(path.join(dependencies, 'node_modules')));
const root = dependencies.replace(/\\/g, '/');
const out = path.join(root, '.tmp/about-first-project');
fs.mkdirSync(out, {recursive:true});


const access = {id:'fixture-firm',name:'Fixture Studio',type:'DESIGN_FIRM',canEditProfile:true,canImportProjects:true,canContribute:true};
const importedReview = {
  id:'fixture-run',access,canReview:true,
  run:{kind:'workspace-import-v1',orgId:access.id,orgName:access.name,personName:'Fixture Designer',website:'https://studio.test',sections:['business','bio','projects'],returnTo:'/projects',phase:'complete',
    profile:{description:'A practice creating thoughtful homes.',location:'Brooklyn',bio:'The designer focuses on homes shaped by everyday life.'},
    notices:[],pages:[{url:'https://studio.test',kind:'home',status:'saved',attempts:1}],projects:[],notification:{status:'accepted',attempts:1}},
  profile:{org:{...access,logo:null,description:null,tagline:null,location:null,foundedYear:null,specialties:[],serviceRegions:[],projectTypes:[],teamSizeRange:null},
    appearance:{version:1,backgroundColor:null,introduction:null,cover:{kind:'auto'},coverPosition:{x:50,y:50},identity:{mode:'logo',url:null},facts:null},cover:null,projectCount:0},
  projects:[],bioText:'',bioVersion:null,summary:{projects:0,photos:0,interviews:0,needsAttention:false},
  business:{description:null,location:null,logo:null,updatedAt:'2026-11-05T12:00:00.000Z'},
};
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {WelcomeModal} from './src/components/marketing/WelcomeModal';
import {EditorialMasthead} from './src/components/navigation/EditorialMasthead';
import {AboutPageContent} from './src/app/about/content';
import Signup from './src/app/auth/signup/page';
import VerifyEmail from './src/app/auth/verify-email/page';
import {SigninForm} from './src/app/auth/signin/SigninForm';
import {ScenarioA} from './src/app/auth/org-setup/_ScenarioA';
import {WorkspaceImportClient} from './src/app/onboarding/workspace/WorkspaceImportClient';
import Projects from './src/app/projects/ProjectsPageClient';
const params = new URLSearchParams(location.search);
const user = JSON.parse(sessionStorage.getItem('fixture-user') || 'null');
const access = {id:'fixture-firm', name:'Fixture Studio', type:'DESIGN_FIRM', canEditProfile:true, canImportProjects:true, canContribute:true};
const firms = sessionStorage.getItem('fixture-membership') === '1' ? [{...access, membershipRole:'OWNER', location:null}] : [];
const pathname = location.pathname;
const view = pathname === '/auth/signup' ? <Signup/> :
  pathname === '/auth/verify-email' ? <VerifyEmail/> :
  pathname === '/auth/signin' ? <SigninForm showGoogle showApple/> :
  pathname === '/auth/org-setup' ? <main style={{maxWidth:480,margin:'auto',padding:24}}><ScenarioA initialIntent={params.get('type')} callbackUrl={params.get('callbackUrl') || '/settings'} account={user} memberships={firms} existingOnly={firms.length > 0}/></main> :
  pathname === '/onboarding/workspace' ? <WorkspaceImportClient access={access} memberships={[access]} history={[]} initialId={params.get('import') || (params.get('new') === '1' ? undefined : sessionStorage.getItem('fixture-import-id') || undefined)} available returnTo={params.get('returnTo') || sessionStorage.getItem('fixture-import-return-to') || '/projects/new'}/> :
  pathname === '/projects' ? <main className="px-6"><Projects projectsRaw={[]} operatingAsOrgId={user?.operatingAsOrgId}/></main> :
  pathname === '/projects/new' ? <h1>Project upload boundary</h1> :
  pathname === '/onboarding/diagnostic' ? <h1>Browsing onboarding</h1> :
  <><EditorialMasthead/>{pathname === '/about' ? <AboutPageContent/> : <WelcomeModal/>}</>;
createRoot(document.getElementById('root')).render(view);
`;

async function main() {
  await esbuild.build({
    stdin: {contents:entry, resolveDir:dependencies, loader:'tsx'},
    outfile: path.join(out, 'bundle.js'), bundle: true, platform: 'browser', jsx: 'automatic',
    nodePaths: [path.join(dependencies, 'node_modules')], alias: { '@': path.join(root, 'src') },
    define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' },
    plugins: [{ name: 'session-and-image-fixture', setup(build) {
      build.onResolve({ filter: /^(next-auth\/react|next\/image|next\/navigation)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onResolve({filter:/^(.*\/)?(SupportModal|FolioBadgeModal|CreateCollaborationModal)$/},args=>({path:args.path,namespace:'empty-modal'}));build.onLoad({filter:/.*/,namespace:'empty-modal'},()=>({contents:'export const CreateCollaborationModal=()=>null;export default ()=>null;'}));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: dependencies, contents: args.path === 'next-auth/react'
        ? "import {useSyncExternalStore,useMemo} from 'react';const read=()=>sessionStorage.getItem('fixture-user');const subscribe=fn=>{window.addEventListener('authchange',fn);return()=>window.removeEventListener('authchange',fn)};export const useSession=()=>{const raw=useSyncExternalStore(subscribe,read,read);const user=useMemo(()=>JSON.parse(raw||'null'),[raw]);return {status:sessionStorage.getItem('fixture-loading')==='1'?'loading':user?'authenticated':'unauthenticated',data:user?{user}:null,update:async()=>({user:JSON.parse(read()||'null')})}};export const signOut=async()=>sessionStorage.removeItem('fixture-user');export const getProviders=async()=>({google:{id:'google'},apple:{id:'apple'}});export const signIn=async(provider,options)=>{window.lastSignIn={provider,options};if(sessionStorage.getItem('fixture-signin-error')==='1')return {error:'Invalid credentials'};sessionStorage.setItem('fixture-user',JSON.stringify({id:'fixture-person',name:'Fixture Designer',email:'designer@example.test',role:'INDIVIDUAL'}));if(provider==='email-verification'&&options.code!=='123456'){sessionStorage.removeItem('fixture-user');return {ok:false,error:'INVALID'};}if(provider!=='credentials'&&provider!=='email-verification'){location.assign(options.callbackUrl)}return {ok:true};};" : args.path === 'next/navigation' ? `export const usePathname=()=>location.pathname;export const useRouter=()=>({push:url=>location.assign(url),replace:url=>location.replace(url),refresh:()=>{}});export const useSearchParams=()=>new URLSearchParams(location.search);`
        : `import React from 'react';import Image from '${dependencies.replace(/\\/g, '/')}/node_modules/next/image.js';export default function FixtureImage(props){return <Image {...props} unoptimized/>;}` }));
    } }],
  });
  const globals = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  const config = require(path.join(root, 'tailwind.config.js'));
  config.content = [path.join(root, 'src/components/marketing/WelcomeModal.tsx'),path.join(root, 'src/components/navigation/**/*.tsx'),path.join(root,'src/app/about/**/*.tsx'),path.join(root,'src/app/auth/**/*.tsx'),path.join(root,'src/app/projects/**/*.tsx'),path.join(root,'src/app/onboarding/**/*.tsx'),path.join(root,'src/components/projects/**/*.tsx'),path.join(root,'src/components/onboarding/**/*.tsx'),path.join(root,'src/components/org-profile/**/*.tsx'),path.join(root,'src/components/feed/**/*.tsx')];
  let css = (await postcss([tailwind(config)]).process(globals, { from: path.join(root, 'src/app/globals.css') })).css;
  css += `
    @font-face{font-family:FolioFixtureHeadline;src:url(/CormorantGaramond.ttf) format('truetype');font-style:normal;font-weight:300 700;font-display:swap}
    @font-face{font-family:FolioFixtureBody;src:url(/InstrumentSans.ttf) format('truetype');font-style:normal;font-weight:400 700;font-display:swap}
    :root{--font-headline:FolioFixtureHeadline;--font-body:FolioFixtureBody}
  `;
  fs.writeFileSync(path.join(out, 'globals.css'), css);
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/bundle.css"><title>Folio welcome copy review</title></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/auth/logout') {res.setHeader('Content-Type','application/json');return res.end('{}');}
    if (!pathname.includes('.') && !pathname.startsWith('/_next/')) { res.setHeader('Content-Type', 'text/html'); return res.end(html); }
    const file = pathname.endsWith('.ttf') ? path.join(root, 'public/fonts/publication', path.basename(pathname)) : pathname.startsWith('/_next/static/media/') || pathname.startsWith('/static/media/') || pathname.startsWith('/media/')
      ? path.join(assets, '.next/static/media', path.basename(pathname)) : path.join(out, path.basename(pathname));
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.woff2') ? 'font/woff2' : file.endsWith('.ttf') ? 'font/ttf' : 'application/javascript');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const executablePath=process.env.MARKETING_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium'].find(file=>fs.existsSync(file));
  assert.ok(executablePath,'Set MARKETING_TEST_BROWSER to an installed Chromium browser.');
  const browser = await puppeteer.launch({executablePath,headless:true});
  const page=await browser.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(15000);
  const url=`http://127.0.0.1:${server.address().port}`;
  const errors=[], results=[];let signupFails=false, pendingSignup=null, verificationRefreshGate=null;
  if(process.env.MARKETING_TEST_DEBUG)page.on('framenavigated',frame=>{if(frame===page.mainFrame())console.log('Navigated:',frame.url());});
  page.on('pageerror',e=>errors.push(e.message));
  // Navigation now reads memberships on mount. Keep that read in its own page
  // context so a simultaneous route change cannot destroy a Node-side evaluate.
  await page.evaluateOnNewDocument(() => {
    const realFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const target = new URL(input instanceof Request ? input.url : String(input), location.href);
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (target.origin === location.origin && target.pathname === '/api/user/workspace-context' && method === 'GET') {
        const user = JSON.parse(sessionStorage.getItem('fixture-user') || 'null');
        const org = { id: 'fixture-firm', name: 'Fixture Studio', type: 'DESIGN_FIRM', logo: null, userRole: 'OWNER' };
        const organizations = sessionStorage.getItem('fixture-membership') === '1' || user?.operatingAsOrgId === 'fixture-firm' ? [org] : [];
        const operatingAsOrg = organizations.find(org => org.id === user?.operatingAsOrgId) || null;
        const body = user ? { user, organizations, operatingAsOrg, operatingAsOrgId: operatingAsOrg?.id || null } : { error: 'Unauthorized' };
        return Promise.resolve(new Response(JSON.stringify(body), { status: user ? 200 : 401, headers: { 'Content-Type': 'application/json' } }));
      }
      return realFetch(input, init);
    };
  });
  await page.setRequestInterception(true);
  page.on('request',async request=>{
    const u=new URL(request.url());
    if(u.hostname==='images.unsplash.com'&&u.pathname==='/photo-1600210492486-724fe5c67fb0')return request.continue();
    if(u.origin!==url)return request.abort();
    const json=data=>request.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
    if(u.pathname==='/api/auth/signup') {
      if(signupFails)return request.respond({status:409,contentType:'application/json',body:'{"error":"Account already exists"}'});
      const body=JSON.parse(request.postData());
      pendingSignup={email:body.email,returnTo:body.returnTo,expiresAt:new Date(Date.now()+600000).toISOString(),resendAt:new Date().toISOString(),attemptsRemaining:5,canResend:true,deliveryAccepted:true};
      return request.respond({status:202,contentType:'application/json',body:JSON.stringify({verificationRequired:true})});
    }
    if(u.pathname==='/api/auth/email-verification'){
      if(verificationRefreshGate){verificationRefreshGate.release=()=>json(pendingSignup);return;}
      return json(pendingSignup);
    }
    if(u.pathname==='/api/auth/email-verification/resend')return json({deliveryAccepted:true});
    if(u.pathname==='/api/onboarding/workspace'){
      const body=JSON.parse(request.postData());
      assert.equal(body.orgId,access.id);assert.equal(body.website,'https://studio.test');assert.equal(body.consent,true);
      assert.deepEqual(body.sections,['business','bio','projects']);
      importedReview.run.returnTo=body.returnTo;
      await page.evaluate(returnTo=>{sessionStorage.setItem('fixture-import-id','fixture-run');sessionStorage.setItem('fixture-import-return-to',returnTo);},body.returnTo);
      return json({id:'fixture-run'});
    }
    if(u.pathname==='/api/onboarding/workspace/fixture-run')return json(importedReview);
    if(u.pathname==='/api/onboarding/firm/search')return json({results:u.searchParams.get('q')?.startsWith('Existing')?[{id:'existing',name:'Existing Studio',type:'DESIGN_FIRM',location:null}]:[]});
    if(u.pathname==='/api/orgs/existing/join')return json({notifications:{inApp:true,email:'sent'}});
    if(u.pathname==='/api/auth/org-setup'){
      const body=JSON.parse(request.postData());
      if(body.organizationId)return json({notifications:{inApp:true,email:'sent'}});
      await page.evaluate(()=>{const user=JSON.parse(sessionStorage.getItem('fixture-user'));sessionStorage.setItem('fixture-user',JSON.stringify({...user,operatingAsOrgId:'fixture-firm'}));});
      return json({org:{id:'fixture-firm',type:'DESIGN_FIRM'}});
    }
    if(u.pathname==='/api/user/workspace-context' && request.method()==='POST'){
      await page.evaluate(()=>{const user=JSON.parse(sessionStorage.getItem('fixture-user'));sessionStorage.setItem('fixture-user',JSON.stringify({...user,operatingAsOrgId:'fixture-firm'}));});
      return json({user:{operatingAsOrgId:'fixture-firm',operatingAsOrg:{id:'fixture-firm',type:'DESIGN_FIRM'}}});
    }
    if(u.pathname.startsWith('/api/'))return json({notifications:[],unreadCount:0});
    return request.continue();
  });
  const go=path=>page.goto(url+path,{waitUntil:'networkidle0'});
  const reset=async(user=null,member=false)=>{await go('/about');await page.evaluate((u,m)=>{sessionStorage.clear();if(u)sessionStorage.setItem('fixture-user',JSON.stringify(u));if(m)sessionStorage.setItem('fixture-membership','1');},user,member);};
  const person={id:'fixture-person',name:'Fixture Designer',email:'designer@example.test',role:'DESIGNER'};
  const clickText=async(text,tag='a')=>{const clicked=await page.evaluate((label,tag)=>{const element=[...document.querySelectorAll(tag)].find(e=>e.textContent.trim()===label);if(!element)return false;element.click();return true;},text,tag);assert.ok(clicked,'Find '+text);};
  const clickNavigate=async(text,tag='a')=>Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),clickText(text,tag)]);
  const setupCallback=(workspace=false)=>{
    const u=new URL(page.url()); assert.equal(u.pathname,'/auth/org-setup');
    if(workspace){const next=new URL(u.searchParams.get('callbackUrl'),url);assert.equal(next.pathname,'/onboarding/workspace');assert.equal(next.searchParams.get('returnTo'),'/projects/new');}
    else assert.equal(u.searchParams.get('callbackUrl'),'/projects/new');
  };
  const verifySignup=async()=>{
    assert.equal(new URL(page.url()).pathname,'/auth/verify-email');
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('fixture-user')),null,'Signup does not sign in before verification');
    const refreshRequested=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/auth/email-verification');
    verificationRefreshGate={release:null};
    await page.type('#verification-code','000000'); await page.click('form button[type=submit]');
    await page.waitForSelector('[role=alert]');assert.equal(new URL(page.url()).pathname,'/auth/verify-email');
    await refreshRequested;
    assert.equal(await page.$eval('#verification-code',e=>e.disabled),true,'The error appears while the pending-signup refresh still owns the form');
    assert.equal(typeof verificationRefreshGate.release,'function','The rejected-code refresh is held for this check');
    await verificationRefreshGate.release();verificationRefreshGate=null;
    // Error visibility precedes refresh completion; typing before readiness is dropped.
    await page.waitForSelector('#verification-code:not(:disabled)');
    await page.$eval('#verification-code',e=>{e.focus();e.select();}); await page.type('#verification-code','123456');
    assert.equal(await page.$eval('#verification-code',e=>e.value),'123456','The replacement verification code must reach the controlled input');
    await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('form button[type=submit]')]);
    setupCallback(true);
  };
  const signup=async()=>{for(const [id,value] of Object.entries({firstName:'Fixture',lastName:'Designer',email:'designer@example.test',password:'FixturePassword123!'}))await page.type('#'+id,value);await page.click('#acceptedTerms');};
  const signin=async()=>{await page.type('#email','designer@example.test');await page.type('#password','FixturePassword123!');};
  try{
    await reset({...person,operatingAsOrgId:'fixture-firm'},true);
    const importHref=await (async()=>{await go('/projects');return page.evaluate(()=>[...document.querySelectorAll('header a')].find(a=>a.textContent.trim()==='Import')?.getAttribute('href'));})();
    assert.ok(importHref,'Import is an actionable link');
    const importUrl=new URL(importHref,url);assert.equal(importUrl.pathname,'/onboarding/workspace');assert.equal(importUrl.searchParams.get('orgId'),'fixture-firm');assert.equal(importUrl.searchParams.get('returnTo'),'/projects');assert.equal(importUrl.searchParams.has('new'),false,'Import resumes existing work');
    for(const width of [320,390,768,1440]){
      await page.setViewport({width,height:844});await go('/projects');
      const geometry=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,controls:[...document.querySelectorAll('header a,header button,[role=tab],input[type=search]')].map(e=>({text:e.getAttribute('aria-label')||e.textContent.trim(),x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right}))}));
      assert.equal(geometry.scrollWidth,width,'Projects should fit '+width+'px');
      for(const control of geometry.controls){assert.ok(control.x>=0&&control.right<=width,JSON.stringify(control));}
      await page.screenshot({path:path.join(out,'projects-'+width+'.png')});results.push({projectsLayout:width,passed:true});
    }
    await clickNavigate('Import');await page.waitForSelector('input[placeholder="yourstudio.com"]');
    await page.type('input[placeholder="yourstudio.com"]','https://studio.test');await page.click('form input[required][type=checkbox]');
    await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('form button.auth-submit')]);
    await page.waitForSelector('[aria-label="Your private profile preview"]');
    assert.equal(await page.$eval('h1',e=>e.textContent),'Your work, already taking shape.');
    await go('/projects');await clickNavigate('Import');await page.waitForSelector('[aria-label="Your private profile preview"]');
    await clickNavigate('Continue to Folio','button');assert.equal(new URL(page.url()).pathname,'/projects');
    await clickNavigate('Import');await page.waitForSelector('[aria-label="Your private profile preview"]');
    await clickNavigate('Bring over more work from a website');await page.waitForSelector('input[placeholder="yourstudio.com"]');
    assert.equal(new URL(page.url()).searchParams.get('returnTo'),'/projects');
    results.push({journey:'Projects → Import → private preview → leave → resume → projects → import more',passed:true});
    await reset(person);await go('/projects');
    const personalImport=await page.evaluate(()=>[...document.querySelectorAll('header a')].find(a=>a.textContent.trim()==='Import').href);
    assert.equal(new URL(personalImport).searchParams.has('orgId'),false,'Personal context does not guess a firm');
    results.push({journey:'Import retains active firm or leaves selection to enrollment',passed:true});
    if(process.env.MARKETING_PROJECTS_ONLY==='1'){console.log(JSON.stringify({results,errors},null,2));return;}
    await reset();
    for (const width of [320, 390, 1440]) {
      await page.setViewport({width, height: 844});
      await go('/');
      const dialog = await page.waitForSelector('[role=dialog]');
      assert.deepEqual(await dialog.$$eval('a, button', elements => elements.map(element =>
        element.getAttribute('aria-label') || element.textContent.trim()
      )), ['Sign up', 'About Folio', 'Close welcome']);
      const [signupTop, aboutTop] = await dialog.$$eval('a', links => links.map(link => link.getBoundingClientRect().top));
      assert.equal(signupTop, aboutTop, 'Keep welcome actions on one row at ' + width + 'px');
      await page.click('[role=dialog] button[aria-label="Close welcome"]');
      await page.waitForSelector('[role=dialog]', {hidden: true});
      await Promise.all([page.waitForNavigation(), page.click('header a[href="/auth/signin"]')]);
      assert.equal(new URL(page.url()).pathname, '/auth/signin');
      await reset();
    }
    results.push({journey:'close welcome → header login on mobile and desktop',passed:true});
    await go('/');
    await page.waitForSelector('[role=dialog]');
    await clickNavigate('Sign up', '[role=dialog] a');
    assert.equal(new URL(page.url()).pathname, '/auth/signup');
    await clickNavigate('Sign in');
    assert.equal(new URL(page.url()).pathname, '/auth/signin');
    results.push({journey:'welcome → signup → sign in',passed:true});
    await reset();
    for(const [width,height] of [[1440,1000],[1024,768],[768,1024],[390,844],[320,568]]){
      await page.setViewport({width,height});await go('/about');await page.evaluate(()=>document.fonts.ready);
      const fits=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,article:document.querySelector('article').scrollWidth,heading:document.querySelector('#about-title').textContent}));
      assert.ok(fits.document<=width,JSON.stringify(fits));
      assert.equal(await page.$$eval('article h1',a=>a.length),1);
      await page.screenshot({path:path.join(out,`about-${width}.png`),fullPage:true});results.push({layout:width,passed:true});
    }
    await page.setViewport({width:390,height:844});await go('/');await page.waitForSelector('[role=dialog]');
    assert.equal(await page.$eval('[role=dialog] a',a=>document.activeElement===a),true);
    await page.screenshot({path:path.join(out,'welcome-390.png')});
    await clickNavigate('About Folio');assert.equal(new URL(page.url()).pathname,'/about');
    await clickNavigate('Start your first project');
    assert.equal(await page.$eval('input[name=intent]:checked',e=>e.value),'designer');
    const signinHref=await page.$eval('.auth-form-foot a',a=>a.href);
    const callback=new URL(new URL(signinHref).searchParams.get('callbackUrl'),url);assert.equal(callback.pathname,'/auth/org-setup');const workspaceCallback=new URL(callback.searchParams.get('callbackUrl'),url);assert.equal(workspaceCallback.pathname,'/onboarding/workspace');assert.equal(workspaceCallback.searchParams.get('returnTo'),'/projects/new');
    await signup();await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('form button[type=submit]')]);await verifySignup();
    await page.type('#firm-name','Fixture Studio');await page.waitForSelector('form input[type=checkbox]');await page.click('form input[type=checkbox]');
    await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('form button[type=submit]')]);assert.equal(new URL(page.url()).pathname,'/onboarding/workspace');await page.waitForSelector('input[placeholder="yourstudio.com"]');await clickNavigate('Set up manually for now','button');assert.equal(new URL(page.url()).pathname,'/projects/new');results.push({journey:'welcome → about → signup → verify email → create firm → workspace → manual project upload',passed:true});

    await reset(null,true);await go('/about');await clickNavigate('Already have an account? Sign in');await signin();await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('form button[type=submit]')]);setupCallback();
    await clickNavigate('Fixture Studio','button');assert.equal(new URL(page.url()).pathname,'/projects/new');results.push({journey:'about → signin → existing firm → project upload',passed:true});

    for(const active of [false,true]){await reset(active?{...person,operatingAsOrgId:'fixture-firm'}:person,true);await go('/about');await clickNavigate('Start your first project');if(active)assert.equal(new URL(page.url()).pathname,'/projects/new');else setupCallback();results.push({signedIn:active?'active firm':'firm selection',passed:true});}
    await reset();await page.evaluate(()=>sessionStorage.setItem('fixture-loading','1'));await go('/about');await clickText('Start your first project');assert.equal(new URL(page.url()).pathname,'/about');
    await page.evaluate(p=>{sessionStorage.removeItem('fixture-loading');sessionStorage.setItem('fixture-user',JSON.stringify({...p,operatingAsOrgId:'fixture-firm'}));window.dispatchEvent(new Event('authchange'));},person);await page.waitForFunction(()=>[...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='Start your first project').getAttribute('href')==='/projects/new');results.push({auth:'loading waits, then uses resolved session',passed:true});

    await reset();await go('/auth/signup?type=designer&next=project');await clickNavigate('Sign in');await clickNavigate('Sign up');await signup();await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('form button[type=submit]')]);await verifySignup();results.push({journey:'signup ↔ signin preserves first project',passed:true});
    for(const provider of ['Google','Apple']){await reset();await go('/auth/signup?type=designer&next=project');await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('[aria-label="Continue with '+provider+'"]')]);setupCallback(true);results.push({oauth:provider,passed:true});}
    await reset();await go('/auth/signup?type=designer');const generic=await page.$eval('.auth-form-foot a',a=>a.href);const genericSetup=new URL(new URL(generic).searchParams.get('callbackUrl'),url);assert.equal(genericSetup.pathname,'/auth/org-setup');const genericWorkspace=new URL(genericSetup.searchParams.get('callbackUrl'),url);assert.equal(genericWorkspace.pathname,'/onboarding/workspace');assert.equal(genericWorkspace.searchParams.get('returnTo'),'/projects');
    for(const intent of ['architect','builder']){
      await go('/auth/signup?type='+intent);const href=await page.$eval('.auth-form-foot a',a=>a.href);const setup=new URL(new URL(href).searchParams.get('callbackUrl'),url);assert.equal(setup.searchParams.get('type'),intent);assert.equal(new URL(setup.searchParams.get('callbackUrl'),url).searchParams.get('returnTo'),'/projects');
    }
    await go('/auth/signup?type=designer&callbackUrl=%2Fsettings');const explicit=await page.$eval('.auth-form-foot a',a=>a.href);const explicitSetup=new URL(new URL(explicit).searchParams.get('callbackUrl'),url);assert.equal(new URL(explicitSetup.searchParams.get('callbackUrl'),url).searchParams.get('returnTo'),'/settings');
    await go('/auth/signup?type=designer&next=project');await page.click('input[value=browsing]');const browse=await page.$eval('.auth-form-foot a',a=>a.href);assert.equal(new URL(browse).searchParams.get('callbackUrl'),'/onboarding/diagnostic');
    await page.click('input[value=vendor]');const vendor=new URL(new URL(await page.$eval('.auth-form-foot a',a=>a.href)).searchParams.get('callbackUrl'),url);assert.equal(vendor.searchParams.get('type'),'vendor');assert.equal(new URL(vendor.searchParams.get('callbackUrl'),url).searchParams.get('returnTo'),'/projects/new');
    await go('/auth/signup?type=designer&next=project&callbackUrl=%2Fauth%2Fclaim%3Ftoken%3Dfixture');assert.equal(new URL(await page.$eval('.auth-form-foot a',a=>a.href)).searchParams.get('callbackUrl'),'/auth/claim?token=fixture');results.push({auth:'generic browsing, changed role and explicit callback preserved',passed:true});

    await reset();await go('/auth/signup?type=designer&next=project');await signup();signupFails=true;await page.click('form button[type=submit]');await page.waitForSelector('[role=alert]');assert.equal(new URL(page.url()).pathname,'/auth/signup');signupFails=false;await clickNavigate('Sign in');
    await page.evaluate(()=>sessionStorage.setItem('fixture-signin-error','1'));await signin();await page.click('form button[type=submit]');await page.waitForSelector('[role=alert]');assert.equal(new URL(page.url()).pathname,'/auth/signin');await page.evaluate(()=>sessionStorage.removeItem('fixture-signin-error'));await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('form button[type=submit]')]);setupCallback(true);results.push({auth:'signup/signin errors preserve destination for retry',passed:true});
    await page.type('#firm-name','Existing Studio');await page.waitForFunction(()=>document.querySelector('form button[type=submit]')?.textContent.trim()==='Request access to join firm');await page.click('form button[type=submit]');await page.waitForFunction(()=>document.querySelector('h1')?.textContent==='Request sent');assert.equal(new URL(page.url()).pathname,'/auth/org-setup');results.push({permissions:'pending firm request cannot enter upload',passed:true});
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({fixture:'Actual welcome, About, masthead, signup, email verification, sign-in, firm setup, Projects and workspace import components. Synthetic sessions/provider callbacks/API responses, including server-selected import resume props. Upload destination is a route boundary, not a real upload. Separate signup/import route suites cover persistence and authorization. External requests blocked except the existing Folio interior photograph.',results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));
  }catch(error){console.error('Failed at:',page.url());throw error;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

// Real marketing/auth UI with synthetic sessions, provider callbacks and API responses.
// Run after a Next build has cached the Folio fonts. No accounts, firms or uploads are created.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const puppeteer = require('puppeteer-core');
const dependencies = path.resolve(__dirname, '..');
const root = dependencies.replace(/\\/g, '/');
const out = path.join(root, '.tmp/about-first-project');
fs.mkdirSync(out, {recursive:true});

async function main() {
  await esbuild.build({
    stdin: {contents:"import React from 'react';import {createRoot} from 'react-dom/client';import {WelcomeModal} from './src/components/marketing/WelcomeModal';import {EditorialMasthead} from './src/components/navigation/EditorialMasthead';import {AboutPageContent} from './src/app/about/content';import Signup from './src/app/auth/signup/page';import {SigninForm} from './src/app/auth/signin/SigninForm';import {ScenarioA} from './src/app/auth/org-setup/_ScenarioA';const params=new URLSearchParams(location.search);const user=JSON.parse(sessionStorage.getItem('fixture-user')||'null');const firms=sessionStorage.getItem('fixture-membership')==='1'?[{id:'fixture-firm',name:'Fixture Studio',type:'DESIGN_FIRM',membershipRole:'OWNER',location:null}]:[];const path=location.pathname;createRoot(document.getElementById('root')).render(path==='/auth/signup'?<Signup/>:path==='/auth/signin'?<SigninForm showGoogle showApple/>:path==='/auth/org-setup'?<main style={{maxWidth:480,margin:'auto',padding:24}}><ScenarioA initialIntent={params.get('type')} callbackUrl={params.get('callbackUrl')||'/settings'} account={user} memberships={firms} existingOnly={firms.length>0}/></main>:path==='/projects/new'?<h1>Project upload boundary</h1>:path==='/onboarding/diagnostic'?<h1>Browsing onboarding</h1>:<><EditorialMasthead/>{path==='/about'?<AboutPageContent/>:<WelcomeModal/>}</>);", resolveDir:dependencies, loader:'tsx'},
    outfile: path.join(out, 'bundle.js'), bundle: true, platform: 'browser', jsx: 'automatic',
    nodePaths: [path.join(dependencies, 'node_modules')], alias: { '@': path.join(root, 'src') },
    define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' },
    plugins: [{ name: 'session-and-image-fixture', setup(build) {
      build.onResolve({ filter: /^(next-auth\/react|next\/image|next\/navigation)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onResolve({filter:/^(.*\/)?(SupportModal|FolioBadgeModal|CreateCollaborationModal)$/},args=>({path:args.path,namespace:'empty-modal'}));build.onLoad({filter:/.*/,namespace:'empty-modal'},()=>({contents:'export const CreateCollaborationModal=()=>null;export default ()=>null;'}));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: dependencies, contents: args.path === 'next-auth/react'
        ? "import {useSyncExternalStore,useMemo} from 'react';const read=()=>sessionStorage.getItem('fixture-user');const subscribe=fn=>{window.addEventListener('authchange',fn);return()=>window.removeEventListener('authchange',fn)};export const useSession=()=>{const raw=useSyncExternalStore(subscribe,read,read);const user=useMemo(()=>JSON.parse(raw||'null'),[raw]);return {status:sessionStorage.getItem('fixture-loading')==='1'?'loading':user?'authenticated':'unauthenticated',data:user?{user}:null,update:async()=>({user:JSON.parse(read()||'null')})}};export const signOut=async()=>sessionStorage.removeItem('fixture-user');export const signIn=async(provider,options)=>{window.lastSignIn={provider,options};if(sessionStorage.getItem('fixture-signin-error')==='1')return {error:'Invalid credentials'};sessionStorage.setItem('fixture-user',JSON.stringify({id:'fixture-person',name:'Fixture Designer',email:'designer@example.test',role:'INDIVIDUAL'}));if(provider!=='credentials'){location.assign(options.callbackUrl)}return {ok:true};};" : args.path === 'next/navigation' ? `export const usePathname=()=>location.pathname;export const useRouter=()=>({push:url=>location.assign(url),replace:url=>location.replace(url),refresh:()=>{}});export const useSearchParams=()=>new URLSearchParams(location.search);`
        : `import React from 'react';import Image from '${dependencies.replace(/\\/g, '/')}/node_modules/next/image.js';export default function FixtureImage(props){return <Image {...props} unoptimized/>;}` }));
    } }],
  });
  const globals = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  const config = require(path.join(root, 'tailwind.config.js'));
  config.content = [path.join(root, 'src/components/marketing/WelcomeModal.tsx'),path.join(root, 'src/components/navigation/**/*.tsx'),path.join(root,'src/app/about/**/*.tsx'),path.join(root,'src/app/auth/**/*.tsx')];
  let css = (await postcss([tailwind(config)]).process(globals, { from: path.join(root, 'src/app/globals.css') })).css;
  let fonts = '', heading, body;
  for (const file of fs.readdirSync(path.join(dependencies, '.next/static/css')).filter(file => file.endsWith('.css'))) {
    for (const face of fs.readFileSync(path.join(dependencies, '.next/static/css', file), 'utf8').match(/@font-face\{[^}]+\}/g) || []) {
      if (/Cormorant_Garamond|Instrument_Sans/.test(face)) {
        fonts += face;
        const family = face.match(/font-family:([^;]+)/)[1];
        if (/Cormorant_Garamond/.test(face) && !/Fallback/.test(family)) heading = family;
        if (/Instrument_Sans/.test(face) && !/Fallback/.test(family)) body = family;
      }
    }
  }
  assert.ok(heading && body, 'Use actual Folio font faces');
  css += fonts + `\n:root{--font-headline:${heading};--font-body:${body}}`;
  fs.writeFileSync(path.join(out, 'globals.css'), css);
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/bundle.css"><title>Folio welcome copy review</title></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/auth/logout') {res.setHeader('Content-Type','application/json');return res.end('{}');}
    if (!pathname.includes('.') && !pathname.startsWith('/_next/')) { res.setHeader('Content-Type', 'text/html'); return res.end(html); }
    const file = pathname.startsWith('/_next/static/media/') || pathname.startsWith('/static/media/') || pathname.startsWith('/media/')
      ? path.join(dependencies, '.next/static/media', path.basename(pathname)) : path.join(out, path.basename(pathname));
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.woff2') ? 'font/woff2' : 'application/javascript');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const executablePath=process.env.MARKETING_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium'].find(file=>fs.existsSync(file));
  assert.ok(executablePath,'Set MARKETING_TEST_BROWSER to an installed Chromium browser.');
  const browser = await puppeteer.launch({executablePath,headless:true});
  const page=await browser.newPage();page.setDefaultTimeout(15000);
  const url=`http://127.0.0.1:${server.address().port}`;
  const errors=[], results=[];let signupFails=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',async request=>{
    const u=new URL(request.url());
    if(u.hostname==='images.unsplash.com'&&u.pathname==='/photo-1600210492486-724fe5c67fb0')return request.continue();
    if(u.origin!==url)return request.abort();
    const json=data=>request.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
    if(u.pathname==='/api/auth/signup')return signupFails?request.respond({status:409,contentType:'application/json',body:'{"error":"Account already exists"}'}):json({success:true});
    if(u.pathname==='/api/onboarding/firm/search')return json({results:u.searchParams.get('q')?.startsWith('Existing')?[{id:'existing',name:'Existing Studio',type:'DESIGN_FIRM',location:null}]:[]});
    if(u.pathname==='/api/orgs/existing/join')return json({notifications:{inApp:true,email:'sent'}});
    if(u.pathname==='/api/auth/org-setup'){
      const body=JSON.parse(request.postData());
      if(body.organizationId)return json({notifications:{inApp:true,email:'sent'}});
      await page.evaluate(()=>{const user=JSON.parse(sessionStorage.getItem('fixture-user'));sessionStorage.setItem('fixture-user',JSON.stringify({...user,operatingAsOrgId:'fixture-firm'}));});
      return json({org:{id:'fixture-firm',type:'DESIGN_FIRM'}});
    }
    if(u.pathname==='/api/user/workspace-context'){
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
  const setupCallback=()=>{const u=new URL(page.url());assert.equal(u.pathname,'/auth/org-setup');assert.equal(u.searchParams.get('callbackUrl'),'/projects/new');};
  const signup=async()=>{for(const [id,value] of Object.entries({firstName:'Fixture',lastName:'Designer',email:'designer@example.test',password:'FixturePassword123!'}))await page.type('#'+id,value);await page.click('#acceptedTerms');};
  const signin=async()=>{await page.type('#email','designer@example.test');await page.type('#password','FixturePassword123!');};
  try{
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
    const callback=new URL(new URL(signinHref).searchParams.get('callbackUrl'),url);assert.equal(callback.pathname,'/auth/org-setup');assert.equal(callback.searchParams.get('callbackUrl'),'/projects/new');
    await signup();await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('form button[type=submit]')]);setupCallback();
    await page.type('#firm-name','Fixture Studio');await page.waitForSelector('form input[type=checkbox]');await page.click('form input[type=checkbox]');
    await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('form button[type=submit]')]);assert.equal(new URL(page.url()).pathname,'/projects/new');results.push({journey:'welcome → about → signup → create firm → project upload',passed:true});

    await reset(null,true);await go('/about');await clickNavigate('Already have an account? Sign in');await signin();await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('form button[type=submit]')]);setupCallback();
    await clickNavigate('Fixture Studio','button');assert.equal(new URL(page.url()).pathname,'/projects/new');results.push({journey:'about → signin → existing firm → project upload',passed:true});

    for(const active of [false,true]){await reset(active?{...person,operatingAsOrgId:'fixture-firm'}:person,true);await go('/about');await clickNavigate('Start your first project');if(active)assert.equal(new URL(page.url()).pathname,'/projects/new');else setupCallback();results.push({signedIn:active?'active firm':'firm selection',passed:true});}
    await reset();await page.evaluate(()=>sessionStorage.setItem('fixture-loading','1'));await go('/about');await clickText('Start your first project');assert.equal(new URL(page.url()).pathname,'/about');
    await page.evaluate(p=>{sessionStorage.removeItem('fixture-loading');sessionStorage.setItem('fixture-user',JSON.stringify({...p,operatingAsOrgId:'fixture-firm'}));window.dispatchEvent(new Event('authchange'));},person);await page.waitForFunction(()=>[...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='Start your first project').getAttribute('href')==='/projects/new');results.push({auth:'loading waits, then uses resolved session',passed:true});

    await reset();await go('/auth/signup?type=designer&next=project');await clickNavigate('Sign in');await clickNavigate('Sign up');await signup();await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('form button[type=submit]')]);setupCallback();results.push({journey:'signup ↔ signin preserves first project',passed:true});
    for(const provider of ['Google','Apple']){await reset();await go('/auth/signup?type=designer&next=project');await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('[aria-label="Continue with '+provider+'"]')]);setupCallback();results.push({oauth:provider,passed:true});}
    await reset();await go('/auth/signup?type=designer');const generic=await page.$eval('.auth-form-foot a',a=>a.href);assert.equal(new URL(generic).searchParams.get('callbackUrl'),'/auth/org-setup?type=designer');
    await go('/auth/signup?type=designer&next=project');await page.click('input[value=browsing]');const browse=await page.$eval('.auth-form-foot a',a=>a.href);assert.equal(new URL(browse).searchParams.get('callbackUrl'),'/onboarding/diagnostic');
    await page.click('input[value=vendor]');const vendor=new URL(new URL(await page.$eval('.auth-form-foot a',a=>a.href)).searchParams.get('callbackUrl'),url);assert.equal(vendor.searchParams.get('type'),'vendor');assert.equal(vendor.searchParams.get('callbackUrl'),'/projects/new');
    await go('/auth/signup?type=designer&next=project&callbackUrl=%2Fauth%2Fclaim%3Ftoken%3Dfixture');assert.equal(new URL(await page.$eval('.auth-form-foot a',a=>a.href)).searchParams.get('callbackUrl'),'/auth/claim?token=fixture');results.push({auth:'generic browsing, changed role and explicit callback preserved',passed:true});

    await reset();await go('/auth/signup?type=designer&next=project');await signup();signupFails=true;await page.click('form button[type=submit]');await page.waitForSelector('[role=alert]');assert.equal(new URL(page.url()).pathname,'/auth/signup');signupFails=false;await clickNavigate('Sign in');
    await page.evaluate(()=>sessionStorage.setItem('fixture-signin-error','1'));await signin();await page.click('form button[type=submit]');await page.waitForSelector('[role=alert]');assert.equal(new URL(page.url()).pathname,'/auth/signin');await page.evaluate(()=>sessionStorage.removeItem('fixture-signin-error'));await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('form button[type=submit]')]);setupCallback();results.push({auth:'signup/signin errors preserve destination for retry',passed:true});
    await page.type('#firm-name','Existing Studio');await page.waitForFunction(()=>document.querySelector('form button[type=submit]')?.textContent.trim()==='Request access to join firm');await page.click('form button[type=submit]');await page.waitForFunction(()=>document.querySelector('h1')?.textContent==='Request sent');assert.equal(new URL(page.url()).pathname,'/auth/org-setup');results.push({permissions:'pending firm request cannot enter upload',passed:true});
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({fixture:'Actual welcome, About, masthead, signup, sign-in and firm setup components. Synthetic auth/providers/API responses. Final upload destination is a route boundary, not a real upload. External requests blocked except the existing Folio interior photograph.',results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

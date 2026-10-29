// Local browser fixture mounts the real signup, enrollment and import components.
// All accounts, pages, API responses and email statuses are synthetic.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs/reviews/workspace-import/fixture');
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import Signup from '@/app/auth/signup/page';
import VerifyEmail from '@/app/auth/verify-email/page';
import {ScenarioA} from '@/app/auth/org-setup/_ScenarioA';
import {WorkspaceImportClient} from '@/app/onboarding/workspace/WorkspaceImportClient';
import {SetupProgress} from '@/components/onboarding/SetupProgress';
import {ProfessionalSetupFrame} from '@/components/onboarding/ProfessionalSetupFrame';
import {WorkspaceImportReadyNotice} from '@/components/onboarding/WorkspaceImportReadyNotice';
import {EditorialMasthead} from '@/components/navigation/EditorialMasthead';
import {defaultOrgAppearance} from '@/lib/org-profile-appearance';
const params=new URLSearchParams(location.search);
window.fixtureAccount=JSON.stringify({id:'fixture-user',name:'Jane Designer',role:'DESIGNER',operatingAsOrgId:'firm'});
window.fixtureNotified=params.get('waiting')!=='1';
window.fixtureFailRead=false;
document.documentElement.dataset.theme=params.get('theme')==='dark'?'dark':'light';
const pendingKey='fixture-pending-signup';
window.fixtureVerify=async(code)=>{
 const pending=JSON.parse(sessionStorage.getItem(pendingKey)||'null');
 if(!pending)return {ok:false,error:'MISSING'};
 if(code!=='123456'){pending.attemptsRemaining--;sessionStorage.setItem(pendingKey,JSON.stringify(pending));return {ok:false,error:'INVALID'};}
 sessionStorage.removeItem(pendingKey);return {ok:true};
};
const access={id:'firm',name:'North Studio',website:null,canEditProfile:true,canImportProjects:true,canContribute:true};
const profilePreview={org:{id:'firm',name:'North Studio',type:'DESIGN_FIRM',logo:null,description:null,tagline:null,location:null,foundedYear:2016,specialties:[],serviceRegions:[],projectTypes:[],teamSizeRange:null},appearance:defaultOrgAppearance(),cover:null,projectCount:0};
const profile={website:'https://studio.test',description:'North Studio designs thoughtful homes shaped by light, natural materials, and everyday life.',location:'Brooklyn, NY',bio:'Jane established North Studio after a decade working on thoughtful homes and shared places.',sourceUrl:'https://studio.test/about'};
const previewPhoto='https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1800&q=80';
const previewProjects=[{id:'harbor',title:'Harbor House',description:'A bright home on the coast.',isPublic:false,photos:[{url:previewPhoto,alt:'A light-filled living room',width:1800,height:1200}]},{id:'court',title:'Court House',description:'A quiet city retreat.',isPublic:false,photos:[{url:previewPhoto,alt:'A living room with natural materials',width:1200,height:1800}]}];
if(params.get('progress')==='1')previewProjects[0].hasSavedProgress=true;
const run={kind:'workspace-import-v1',orgId:'firm',orgName:'North Studio',personName:'Jane Designer',website:'https://studio.test',sections:['business','bio','projects'],returnTo:'/projects/new',phase:'complete',consentAt:new Date().toISOString(),consentVersion:1,profile,notices:[],profileAttempts:1,profileReady:true,notification:{status:'accepted',attempts:1},pages:[{url:'https://studio.test',kind:'home',status:'saved',attempts:1}],projects:[{url:'https://studio.test/work/harbor',title:'Harbor House',description:'A bright home on the coast.',projectId:'harbor',status:'ready',attempts:0,photos:Array.from({length:8},(_,i)=>({url:'photo-'+i,status:'saved',attempts:1}))}]};
const result=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>structuredClone(data)});
window.fetch=async(input,options={})=>{
 const url=new URL(String(input),location.origin),body=options.body?JSON.parse(options.body):{};
 await new Promise(resolve=>setTimeout(resolve,150));
 if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
 if(url.pathname==='/api/notifications'){
  if(options.method==='PATCH'){if(window.fixtureFailRead)return result({},503);sessionStorage.setItem('fixture-notice-read','1');return result({success:true});}
  const read=sessionStorage.getItem('fixture-notice-read')==='1';
  const visible=window.fixtureNotified&&JSON.parse(window.fixtureAccount)?.id==='fixture-user';
  return result({items:visible?[{id:'ready',type:'WORKSPACE_IMPORT_READY',title:'North Studio is ready to explore',body:'Your private profile preview is ready. Add a finish schedule or tag products to build your sourcebook before the interview.',actionUrl:'/onboarding/workspace?import=fixture-run&ready=1',read}]:[],unreadCount:visible&&!read?1:0});
 }
 if(url.pathname==='/api/auth/signup'){
  sessionStorage.setItem(pendingKey,JSON.stringify({email:body.email,returnTo:body.returnTo,expiresAt:new Date(Date.now()+600000).toISOString(),resendAt:new Date(Date.now()+5000).toISOString(),attemptsRemaining:5,canResend:true,deliveryAccepted:true}));
  return result({verificationRequired:true},202);
 }
 if(url.pathname==='/api/auth/email-verification'){
  const pending=JSON.parse(sessionStorage.getItem(pendingKey)||'null');
  if(!pending)return result({error:'This signup has expired or was already completed. Sign in or start again.'},404);
  if(params.get('scenario')==='expired')pending.expiresAt=new Date(Date.now()-1000).toISOString();
  if(params.get('scenario')==='failed')pending.deliveryAccepted=false;
  if(params.get('scenario')==='locked'){pending.attemptsRemaining=0;pending.canResend=false;}
  return result(pending);
 }
 if(url.pathname==='/api/auth/email-verification/resend'){
  const pending=JSON.parse(sessionStorage.getItem(pendingKey)||'null');pending.resendAt=new Date(Date.now()+5000).toISOString();pending.deliveryAccepted=true;
  sessionStorage.setItem(pendingKey,JSON.stringify(pending));return result({deliveryAccepted:true});
 }
 if(url.pathname==='/api/onboarding/firm/search')return result({results:url.searchParams.get('q').toLowerCase().includes('existing')?[{id:'existing',name:'Existing Studio',type:'DESIGN_FIRM',location:'Boston'}]:[]});
 if(url.pathname==='/api/auth/org-setup')return result({org:{...access,type:'DESIGN_FIRM'}},201);
 if(url.pathname.endsWith('/join'))return result({pending:true,notifications:{inApp:true,email:'accepted'}},201);
 if(url.pathname==='/api/onboarding/workspace'){
  if(!body.consent||!body.sections?.length||body.bioUrl||body.projectUrls)throw Error('Expected a consented, website-only import');
  sessionStorage.setItem('fixture-import-phase','0');return result({id:'fixture-run'},202);
 }
 if(url.pathname==='/api/onboarding/workspace/fixture-run'){
  let phase=Number(sessionStorage.getItem('fixture-import-phase')||0);
  if(body.action==='business')profile.businessApplied=true;
  if(body.action==='bio')profile.bioApplied=true;
  if(body.action==='retry'){sessionStorage.setItem('fixture-import-phase','0');phase=0;}
  const complete=params.get('ready')==='1'||phase>=3;
  if(!complete)sessionStorage.setItem('fixture-import-phase',String(phase+1));
  const current=structuredClone(run);current.phase=complete?'complete':['discover','profiles','projects'][phase];
  if(!complete){current.projects=[];current.notification.status='pending';}
  return result({id:'fixture-run',run:current,access,profile:profilePreview,canReview:complete,projects:complete?previewProjects:[],bioText:profile.bio,summary:{projects:complete?2:0,photos:complete?2:0,interviews:0,needsAttention:false},business:{description:profile.businessApplied?body.description:null,location:profile.businessApplied?body.location:null,logo:null,updatedAt:'2026-10-29T12:00:00.000Z'},bioVersion:profile.bioApplied?'2026-10-29T13:00:00.000Z':null});
 }
 if(url.pathname==='/api/user/workspace-context')return result({success:true,user:JSON.parse(window.fixtureAccount),operatingAsOrgId:'firm',operatingAsOrg:{...access,type:'DESIGN_FIRM'},organizations:[{...access,type:'DESIGN_FIRM',userRole:'OWNER'}]});
 if(url.pathname==='/api/me/verified-claim')return result({});
 if(url.pathname==='/api/messages/unread-count')return result({count:0});
 throw Error('Synthetic preview blocked unexpected API: '+url.pathname);
};
window.fixtureNavigate=url=>{if(url==='/designer/profile'){location.href='/onboarding/workspace?import=fixture-run&ready=1';return;}if(url.startsWith('/auth/org-setup')||url.startsWith('/auth/verify-email')||url.startsWith('/auth/signup')||url.startsWith('/onboarding/workspace')){location.href=url;return;}document.querySelector('#destination').textContent='Synthetic navigation: '+url;};
document.addEventListener('click',event=>{const a=event.target.closest('a');if(a&&a.getAttribute('href')?.startsWith('/')){event.preventDefault();window.fixtureNavigate(a.getAttribute('href'));}});
const view=location.pathname==='/notifications-preview'?<><ProfessionalSetupFrame stage="business"><h1 className="folio-h2">Back on Folio</h1><p className="folio-body">Synthetic completion notice preview.</p></ProfessionalSetupFrame><WorkspaceImportReadyNotice/></>:location.pathname.includes('org-setup')?<ProfessionalSetupFrame stage="business"><ScenarioA initialIntent="designer" callbackUrl={params.get('callbackUrl')||'/onboarding/workspace?returnTo=%2Fprojects%2Fnew'} account={{name:'Jane Designer',email:'jane@studio.test',operatingAsOrgId:null}}/></ProfessionalSetupFrame>:location.pathname.includes('/workspace')?<WorkspaceImportClient access={access} memberships={[access]} history={[]} initialId={params.get('import')||undefined} available returnTo="/projects/new"/>:<Signup/>;
createRoot(document.getElementById('root')).render(<>{!location.pathname.startsWith('/auth/')&&<EditorialMasthead/>}{location.pathname.includes('verify-email')?<VerifyEmail/>:view}<footer style={{padding:24,display:'flex',gap:20}}>
 <button onClick={()=>{window.fixtureNotified=true;sessionStorage.removeItem('fixture-notice-read');window.dispatchEvent(new Event('focus'));}}>Simulate import finished</button>
 <button onClick={()=>{window.fixtureAccount=JSON.stringify({id:'second-user',name:'Second Person',role:'INDIVIDUAL'});window.dispatchEvent(new Event('fixture-auth'));}}>Switch account</button>
 <button onClick={()=>{window.fixtureAccount='null';window.dispatchEvent(new Event('fixture-auth'));}}>Sign out fixture</button>
 <button onClick={()=>{window.fixtureFailRead=true;}}>Fail read update</button>
 </footer></>);
`;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  await esbuild.build({ stdin: { contents: entry, resolveDir: root, sourcefile: 'workspace-preview.tsx', loader: 'tsx' }, bundle: true,
    outfile: path.join(out, 'app.js'), platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' }, alias: { '@': path.join(root, 'src') },
    plugins: [{ name: 'fixture-next', setup(build) {
      build.onResolve({filter: /(?:SupportModal|CreateCollaborationModal)$/}, args=>({path:args.path,namespace:'fixture-modal'}));
      build.onLoad({filter:/.*/,namespace:'fixture-modal'},()=>({contents:'export default ()=>null;export const CreateCollaborationModal=()=>null;'}));
      build.onResolve({ filter: /^(next\/navigation|next\/link|next\/image|next-auth\/react)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root, contents:
        args.path === 'next/navigation' ? 'export const useRouter=()=>({replace:url=>window.fixtureNavigate(url),push:url=>window.fixtureNavigate(url),refresh:()=>{}});export const useSearchParams=()=>new URLSearchParams(location.search);export const usePathname=()=>location.pathname;' :
        args.path === 'next/image' ? 'import React from "react";export default React.forwardRef(function Image({fill,priority,unoptimized,style,...props},ref){return <img ref={ref} {...props} style={{...(fill?{position:"absolute",inset:0,width:"100%",height:"100%"}:{}),...style}}/>});' :
        args.path === 'next-auth/react' ? 'import {useSyncExternalStore} from "react";const subscribe=fn=>{window.addEventListener("fixture-auth",fn);return()=>window.removeEventListener("fixture-auth",fn)};export const getProviders=async()=>({});export const signIn=async(provider,options)=>provider==="email-verification"?window.fixtureVerify(options.code):({ok:true});export const signOut=async()=>({});export const useSession=()=>{const raw=useSyncExternalStore(subscribe,()=>window.fixtureAccount);const user=JSON.parse(raw);return {data:user?{user}:null,status:user?"authenticated":"unauthenticated",update:async()=>({})}};' :
        'import React from "react";export default function Link({children,...props}){return <a {...props}>{children}</a>}' }));
    } }],
  });
  const bundledCss = fs.readFileSync(path.join(out, 'app.css'), 'utf8');
  const globals = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  const config = require(path.join(root, 'tailwind.config.js'));
  config.content = [{ raw: entry, extension: 'tsx' }, path.join(root, 'src/app/auth/**/*.tsx'), path.join(root, 'src/app/onboarding/workspace/*.tsx'), path.join(root, 'src/components/onboarding/*.tsx'), path.join(root, 'src/components/navigation/**/*.tsx'), path.join(root, 'src/components/org-profile/**/*.tsx'), path.join(root, 'src/components/feed/FlowMosaic.tsx')];
  let css = (await postcss([tailwind(config)]).process(globals, { from: path.join(root, 'src/app/globals.css') })).css + bundledCss;
  const cssDir = path.join(root, '.next/static/css');
  let heading = 'Georgia', body = 'Arial';
  if (fs.existsSync(cssDir)) for (const file of fs.readdirSync(cssDir).filter(file => file.endsWith('.css'))) {
    for (const face of fs.readFileSync(path.join(cssDir, file), 'utf8').match(/@font-face\{[^}]+\}/g) || []) {
      if (/Cormorant_Garamond|Instrument_Sans/.test(face)) {
        css += face.replaceAll('../media/', '/_next/static/media/');
        const family = face.match(/font-family:([^;]+)/)?.[1];
        if (family && /Cormorant_Garamond/.test(face) && !family.includes('Fallback')) heading = family;
        if (family && /Instrument_Sans/.test(face) && !family.includes('Fallback')) body = family;
      }
    }
  }
  css += '\n:root{--font-headline:'+heading+';--font-body:'+body+'}';
  fs.writeFileSync(path.join(out, 'app.css'), css);
  fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Folio signup and import — synthetic preview</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><output id="destination" aria-live="polite"></output><script src="/app.js"></script></body></html>');
  fs.writeFileSync(path.join(out, 'mobile.html'), '<!doctype html><html><head><title>Mobile setup preview</title></head><body style="margin:0;background:#ddd"><iframe title="Setup at 390 pixels" width="390" height="844" style="border:0" src="/onboarding/workspace"></iframe></body></html>');
  console.log('Built synthetic signup/import preview');
  if (!process.argv.includes('--serve')) return;
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (/^\/_next\/static\/media\/[a-zA-Z0-9._-]+\.woff2$/.test(pathname)) {
      const file = path.join(root, '.next', pathname.slice('/_next/'.length));
      if (!fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
      response.writeHead(200, { 'Content-Type': 'font/woff2' }); fs.createReadStream(file).pipe(response); return;
    }
    const name = ['/app.js', '/app.css', '/mobile.html'].includes(pathname) ? pathname.slice(1) : 'index.html';
    response.writeHead(200, { 'Content-Type': name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html', 'Cache-Control': 'no-store' });
    fs.createReadStream(path.join(out, name)).pipe(response);
  });
  server.listen(3188, '127.0.0.1', () => console.log('Synthetic preview: http://127.0.0.1:3188/auth/signup?type=designer'));
})().catch(error => { console.error(error); process.exitCode = 1; });

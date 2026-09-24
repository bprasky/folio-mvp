// Synthetic, localhost-only browser fixture. No production APIs, sessions or DB.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs/reviews/smart-firm-enrollment/fixture');
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ScenarioA} from './src/app/auth/org-setup/_ScenarioA';
const firm={id:'north',name:'North Studio',type:'DESIGN_FIRM',location:'New York, NY'};
const side={id:'side',name:'Side Practice',type:'ARCHITECTURE_FIRM',location:'Brooklyn, NY'};
const mode=new URLSearchParams(location.search).get('mode');
const add=new URLSearchParams(location.search).get('add')==='1';
const hasFirm=['account','multiple','personal','stale','viewer','memberships'].includes(mode)||add;
const memberships=hasFirm?[{...firm,membershipRole:mode==='viewer'?'VIEWER':'MEMBER'},...(['multiple','memberships'].includes(mode)?[{...side,membershipRole:'OWNER'}]:[])]:[];
const account={name:'Example Designer',email:'example@example.test',operatingAsOrgId:mode==='personal'||!hasFirm?null:mode==='stale'?'revoked':mode==='multiple'?'side':'north'};
const accountOverview=hasFirm&&mode!=='memberships'&&!add;
const callbackUrl=new URLSearchParams(location.search).get('callbackUrl')||(mode==='memberships'?'/projects/new':'/settings');
window.fixtureCalls=[];
window.fetch=async(input,options={})=>{
 const url=new URL(String(input),location.origin); const body=options.body?JSON.parse(options.body):{};
 window.fixtureCalls.push({url:url.pathname+url.search,method:options.method||'GET',body});
 const result=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
 await new Promise(resolve=>setTimeout(resolve,180));
 if(options.signal?.aborted) throw new DOMException('Aborted','AbortError');
 if(url.pathname==='/api/onboarding/firm/search'){
   const q=(url.searchParams.get('q')||'').toLowerCase();
   if(q.includes('error'))return result({error:'Could not search firms. Please try again.'},503);
   return result({results: q.includes('north')||q==='no'?[firm]:q.includes('side')?[side]:[]});
 }
 if(url.pathname.endsWith('/join'))return result({pending:true,message:'Your request is awaiting firm approval',notifications:{inApp:true,email:'accepted'}},201);
 if(url.pathname==='/api/auth/org-setup'){
   if(body.name.toLowerCase().includes('duplicate'))return result({code:'FIRM_EXISTS',organization:firm},409);
   return result({ok:true,org:{id:'new',name:body.name,type:body.type==='vendor'?'VENDOR':body.type==='architect'?'ARCHITECTURE_FIRM':body.type==='builder'?'CONTRACTOR':'DESIGN_FIRM'}},201);
 }
 if(url.pathname==='/api/user/workspace-context')return result({success:true,user:{operatingAsOrg:memberships.find(org=>org.id===body.operatingAsOrgId)}});
 throw Error('Fixture blocked unexpected network request: '+url.pathname);
};
window.fixtureNavigate=(url)=>{
 if(url.startsWith('/auth/org-setup')){location.href=url;return;}
 document.querySelector('#destination').textContent='Synthetic navigation: '+url;
 document.querySelector('#destination').hidden=false;
};
document.addEventListener('click',event=>{const anchor=event.target.closest('a');if(anchor&&anchor.getAttribute('href')?.startsWith('/')){event.preventDefault();window.fixtureNavigate(anchor.getAttribute('href'));}});
createRoot(document.getElementById('root')).render(<div className="auth-shell">
 <header className="px-6 py-6 border-b border-folio-border-subtle"><a href="/" className="folio-logo-text" aria-label="Folio home">Folio</a></header>
 <main className="w-full max-w-lg mx-auto px-6 py-8 sm:py-12 space-y-6"><ScenarioA initialIntent={null} callbackUrl={callbackUrl} memberships={memberships} account={account} accountOverview={accountOverview} existingOnly={mode==='memberships'&&!add}/></main>
</div>);
`;
async function main() {
  fs.mkdirSync(out, { recursive: true });
  await esbuild.build({ stdin: { contents: entry, resolveDir: root, sourcefile: 'fixture.tsx', loader: 'tsx' },
    bundle: true, outfile: path.join(out, 'app.js'), platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    alias: { '@': path.join(root, 'src') },
    plugins: [{ name: 'fixture-next', setup(build) {
      build.onResolve({ filter: /^(next\/navigation|next\/link|next-auth\/react)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root, contents:
        args.path === 'next/navigation' ? 'export const useRouter=()=>({replace:url=>window.fixtureNavigate(url),push:url=>window.fixtureNavigate(url),refresh:()=>{}});' :
        args.path === 'next-auth/react' ? 'export const useSession=()=>({data:{user:{id:"fixture",name:"Example Designer"}},status:"authenticated",update:async()=>({})});' :
        'import React from "react";export default function Link({children,...props}){return <a {...props}>{children}</a>}'
      }));
    } }],
  });
  const globals = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  const config = require(path.join(root, 'tailwind.config.js'));
  config.content = [{ raw: entry, extension: 'tsx' }, path.join(root, 'src/app/auth/org-setup/*.tsx')];
  let css = (await postcss([tailwind(config)]).process(globals, { from: path.join(root, 'src/app/globals.css') })).css;
  css += fs.readFileSync(path.join(root, 'src/app/auth/_components/auth.css'), 'utf8');
  const cssDir = path.join(root, '.next/static/css');
  let fonts = ''; let heading = 'Georgia'; let body = 'Arial';
  if (fs.existsSync(cssDir)) for (const file of fs.readdirSync(cssDir).filter(file => file.endsWith('.css'))) {
    const source = fs.readFileSync(path.join(cssDir, file), 'utf8');
    for (const face of source.match(/@font-face\{[^}]+\}/g) || []) {
      if (/Cormorant_Garamond|Instrument_Sans/.test(face) && /src:url\(/.test(face)) {
        fonts += face;
        const family = face.match(/font-family:([^;]+)/)?.[1];
        if (family && /Cormorant_Garamond/.test(face)) heading = family;
        if (family && /Instrument_Sans/.test(face)) body = family;
      }
    }
  }
  css += fonts + '\n:root{--font-headline:'+heading+';--font-body:'+body+'}';
  fs.writeFileSync(path.join(out, 'app.css'), css);
  fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Folio firm enrollment — synthetic fixture</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><output id="destination" hidden style="position:fixed;bottom:0;left:0;right:0;padding:16px;background:#fff;border-top:1px solid #ddd;z-index:999"></output><script src="/app.js"></script></body></html>');
  console.log('Built '+out);
  if (!process.argv.includes('--serve')) return;
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    let file = path.join(out, pathname === '/app.js' ? 'app.js' : pathname === '/app.css' ? 'app.css' : 'index.html');
    if (/^\/_next\/static\/media\/[a-zA-Z0-9._-]+\.woff2$/.test(pathname)) file = path.join(root, '.next', pathname.slice('/_next/'.length));
    if (!fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
    const ext = path.extname(file);
    response.writeHead(200, { 'Content-Type': ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : ext === '.woff2' ? 'font/woff2' : 'text/html', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  });
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port 3187 is already occupied; no existing server was changed.' : error); process.exitCode = 1; });
  server.listen(3187, '127.0.0.1', () => console.log('Synthetic preview: http://127.0.0.1:3187'));
}
main().catch(error => { console.error(error); process.exitCode = 1; });

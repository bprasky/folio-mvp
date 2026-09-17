// Local visual QA of the actual components. Transport and identity are fixtures;
// this is not a production/authentication/database integration test.
const fs = require('node:fs');
const http = require('node:http');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const config = require('../tailwind.config');
const data = {
  workspace: { id: null, name: 'Example design practice' },
  projects: [{ id: 'p1', title: 'La Gorce', thumbnail: null, published: true, canCreate: true }, { id: 'p2', title: 'Lake House', thumbnail: null, published: true, canCreate: true }],
  ideas: [
    { id: 'i1', title: 'Natural stone, two different moods', format: 'MATERIAL_STUDY', status: 'recommended', createdAt: '2026-09-17', projectIds: ['p1', 'p2'], reason: 'Both projects use natural stone in the kitchen. Explore the difference in scale and atmosphere.', prompts: [{ id: 'q1', prompt: 'What guided the different treatment of stone in these two kitchens?' }] },
    { id: 'i2', title: 'The questions behind your rooms', format: 'QA', status: 'in_progress', createdAt: '2026-09-16', projectIds: [], reason: 'An introduction to your approach, in your own words.', prompts: [{ id: 'q2', prompt: 'What do you want to understand before you begin a room?' }] },
  ],
  posts: [{ id: 'e1', projectId: 'p1', title: 'A quieter kind of home', caption: 'A home shaped by warm stone and quiet light.', status: 'generated', updatedAt: '2026-09-17', kind: 'carousel' }, { id: 'cp1', projectId: 'p2', title: 'Inside Lake House', caption: 'A kitchen opening to the lake.', status: 'generated', updatedAt: '2026-09-16', kind: 'campaign_post', campaignId: 'c1' }],
  editorials: [{ id: 'article1', projectId: 'p1', title: 'La Gorce', slug: 'la-gorce', status: 'published', format: 'PROJECT_FEATURE', updatedAt: '2026-09-17' }],
  campaigns: [{ id: 'c1', projectId: 'p2', title: 'Lake House campaign', preset: 'compact', createdAt: '2026-09-16', totalPosts: 1, postCount: 1, posts: [{ id: 'cp1', title: 'Inside Lake House', caption: 'A kitchen opening to the lake.', sequenceNum: 1 }] }], truncated: false,
};
async function main() {
  const bundle = await esbuild.build({
    stdin: { sourcefile: 'studio-preview.tsx', resolveDir: process.cwd(), loader: 'tsx', contents: `
      import React from 'react'; import { createRoot } from 'react-dom/client';
      import {PublishingStudio} from './src/components/publishing-studio/PublishingStudio';
      import {ProjectSocialPanel} from './src/components/publishing-studio/ProjectSocialPanel';
      import {InstagramExportEditor} from './src/components/instagram-export/InstagramExportEditor';
      const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#c9b9a5"/><rect x="70" y="130" width="460" height="500" fill="#e6ddd0"/><path d="M0 700L600 500V800H0" fill="#9b8a73"/></svg>');
      const props={project:{id:'p1',title:'La Gorce'},post:{slug:'fixture'},designer:{name:'Example Designer'},images:[{id:'1',url:image,room:'r1'}],rooms:[{id:'r1',name:'Kitchen'},{id:'r2',name:'Living room'}],initialExport:{id:'e1',config:{selectedImageUrls:[image],aspectRatio:'4:5'},headline:'A quieter kind of home',bioText:'Design shaped by the way we live.',caption:'A home shaped by warm stone and quiet light.'}};
      const path=location.pathname;
      createRoot(document.getElementById('root')).render(path.includes('/instagram')?<InstagramExportEditor {...props}/>:path.includes('/project/')?<div style={{maxWidth:1100,margin:'40px auto',padding:16}}><ProjectSocialPanel projectId="p1"/></div>:<PublishingStudio/>);
    ` }, bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'next-fixture', setup(build) {
      build.onResolve({ filter: /^next\/(link|navigation|dynamic)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents:
        args.path === 'next/link' ? `import React from 'react'; export default function Link({children,...props}){return <a {...props}>{children}</a>}` :
        args.path === 'next/dynamic' ? `import React,{lazy,Suspense} from 'react'; export default function dynamic(load){const Component=lazy(()=>load().then(defaultExport=>({default:defaultExport})));return props=><Suspense fallback={<p>Loading…</p>}><Component {...props}/></Suspense>}` :
        `import {useSyncExternalStore} from 'react'; const subscribe=fn=>{window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn)};export function useSearchParams(){return new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search))}export function useRouter(){return{replace(url){history.replaceState({},'',url);window.dispatchEvent(new PopStateEvent('popstate'))}}}`,
      }));
    } }],
  });
  const rawCss = fs.readFileSync('src/app/globals.css', 'utf8').replace(/^@import .*;\s*$/gm, '');
  const css = (await postcss([tailwind(config)]).process(rawCss, { from: 'src/app/globals.css' })).css;
  http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1:4182');
    if (url.pathname === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle.outputFiles[0].text); }
    if (url.pathname === '/fixture.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css + ':root{--font-headline:Georgia;--font-body:Arial}'); }
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json');
      if (url.pathname.includes('/ideas/')) {
        let body=''; for await(const chunk of req) body+=chunk;
        const idea=data.ideas.find(i=>i.id===url.pathname.split('/').pop()); if(idea)idea.status=JSON.parse(body).status;
        return res.end(JSON.stringify({ok:true}));
      }
      if(url.pathname.endsWith('/recommendations'))return res.end(JSON.stringify({status:'no_signals',createdPieces:0}));
      if(url.pathname.endsWith('/preview'))return res.end(JSON.stringify({projectTitle:'La Gorce',designerName:'Example Designer',totalPosts:2,imagesById:{},launch:{heroImageId:''},rooms:[],products:[],quotes:[],details:[],closer:{imageId:''}}));
      const project=url.searchParams.get('projectId');
      return res.end(JSON.stringify(project?{...data,projects:data.projects.filter(p=>p.id===project),posts:data.posts.filter(p=>p.projectId===project),campaigns:data.campaigns.filter(c=>c.projectId===project),ideas:data.ideas.filter(i=>i.projectIds.includes(project))}:data));
    }
    res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
  }).listen(4182,'127.0.0.1',()=>console.log('Studio component fixture: http://127.0.0.1:4182/designer/studio'));
}
main().catch(error=>{console.error(error);process.exitCode=1;});

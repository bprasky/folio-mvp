// Local-only synthetic prototype. Memory persistence is deliberately labeled; never serves production.
const fs = require('node:fs');
const http = require('node:http');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const config = require('../tailwind.config');
async function main() {
  const bundle = await esbuild.build({ stdin: { sourcefile: 'activity-preview.tsx', resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React,{useState} from 'react';import{createRoot}from'react-dom/client';
    import{StoryActivity}from'./src/components/publishing-studio/StoryActivity';
    import{createActivity}from'./src/lib/publishing-studio/activities';
    const context={designerName:'Alex Morgan',firmName:'Example Studio',profile:{hasBio:false,hasPointOfView:false},projects:[{id:'p1',title:'Garden House',rooms:[{id:'r1',name:'Living room'},{id:'r2',name:'Kitchen'}]}]};
    let saved;
    const persistence={async create(brief){saved={id:'demo-activity',revision:1,definition:createActivity(brief,context),answers:[],reviewed:false,draft:null};return structuredClone(saved)},async save(next){if(next.revision!==saved.revision)throw Error('The activity changed. Reopen the saved version.');saved={...structuredClone(next),revision:next.revision+1};return structuredClone(saved)}};
    function App(){const[open,setOpen]=useState(true);return <><div role="note" className="border-b border-folio-border-subtle p-3 folio-meta">Prototype · Synthetic examples · Saved only in this tab until refresh · No publishing</div>{open?<StoryActivity context={context} persistence={persistence} initial={saved} onClose={()=>setOpen(false)}/>:<main className="mx-auto max-w-4xl p-6"><h1 className="folio-h2">Publishing Studio</h1><p className="folio-body my-4">{saved?.definition.title || 'Create your next story.'}</p><button className="folio-ui underline" onClick={()=>setOpen(true)}>{saved?'Resume interview':'Build a story'}</button></main>}</>};createRoot(document.getElementById('root')).render(<App/>);
  ` }, bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' } });
  const rawCss = fs.readFileSync('src/app/globals.css', 'utf8').replace(/^@import .*;\s*$/gm, '');
  const css = (await postcss([tailwind(config)]).process(rawCss, { from: 'src/app/globals.css' })).css;
  http.createServer((req, res) => {
    if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle.outputFiles[0].text); }
    if (req.url === '/fixture.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css + ':root{--font-headline:Georgia;--font-body:Arial}'); }
    res.setHeader('Content-Type', 'text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
  }).listen(4183,'127.0.0.1',()=>console.log('Activity prototype: http://127.0.0.1:4183'));
}
main().catch(error=>{console.error(error);process.exitCode=1;});

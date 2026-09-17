// Local-only synthetic prototype. Memory persistence is deliberately labeled; never serves production.
const fs = require('node:fs');
const http = require('node:http');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const config = require('../tailwind.config');
require('dotenv').config({path:'.env.local',quiet:true});require('dotenv').config({path:'.env',quiet:true});
const context=require('./fixtures/story-activity-context.json');
const {generateActivity}=require('./lib/load-story-activity.cjs').load('src/lib/publishing-studio/generate-activity.ts');
async function main() {
  const bundle = await esbuild.build({ stdin: { sourcefile: 'activity-preview.tsx', resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React,{useState} from 'react';import{createRoot}from'react-dom/client';
    import{StoryActivity}from'./src/components/publishing-studio/StoryActivity';
    import{createActivity}from'./src/lib/publishing-studio/activities';
    const context=${JSON.stringify(context)};
    let saved;
    const persistence={async create(brief){saved={id:'demo-activity',revision:1,definition:await (async()=>{const response=await fetch('/activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(brief)});const data=await response.json();if(!response.ok)throw Error(data.error);return data})(),answers:[],reviewed:false,draft:null};return structuredClone(saved)},async save(next){if(next.revision!==saved.revision)throw Error('The activity changed. Reopen the saved version.');saved={...structuredClone(next),revision:next.revision+1};return structuredClone(saved)}};
    function App(){const[open,setOpen]=useState(true);return <><div role="note" className="border-b border-folio-border-subtle p-3 folio-meta">Prototype · Synthetic profile · AI prepares questions when you start · Saved only in this tab · No publishing</div>{open?<StoryActivity context={context} persistence={persistence} initial={saved} onClose={()=>setOpen(false)}/>:<main className="mx-auto max-w-4xl p-6"><h1 className="folio-h2">Publishing Studio</h1><p className="folio-body my-4">{saved?.definition.title || 'Create your next story.'}</p><button className="folio-ui underline" onClick={()=>setOpen(true)}>{saved?'Resume interview':'Build a story'}</button></main>}</>};createRoot(document.getElementById('root')).render(<App/>);
  ` }, bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' } });
  const rawCss = fs.readFileSync('src/app/globals.css', 'utf8').replace(/^@import .*;\s*$/gm, '');
  const css = (await postcss([tailwind(config)]).process(rawCss, { from: 'src/app/globals.css' })).css;
  http.createServer(async (req, res) => {
    if(req.url==='/activity' && req.method==='POST') {
      res.setHeader('Content-Type','application/json');
      if(req.headers.origin && req.headers.origin!=='http://127.0.0.1:4183'){res.statusCode=403;return res.end(JSON.stringify({error:'Local preview requests only.'}));}
      try {let body='';for await(const chunk of req){body+=chunk;if(body.length>10000)throw Error('Invalid activity request.');}
        return res.end(JSON.stringify(await generateActivity(JSON.parse(body),context)));
      }catch(error){res.statusCode=400;return res.end(JSON.stringify({error:error.message||'Could not prepare the interview.'}));}
    }
    if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle.outputFiles[0].text); }
    if (req.url === '/fixture.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css + ':root{--font-headline:Georgia;--font-body:Arial}'); }
    res.setHeader('Content-Type', 'text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
  }).listen(4183,'127.0.0.1',()=>console.log('Activity prototype: http://127.0.0.1:4183'));
}
main().catch(error=>{console.error(error);process.exitCode=1;});

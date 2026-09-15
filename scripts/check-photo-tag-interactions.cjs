/** Real photo/tag components with fixture products; no database or remote writes. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');
const { JSDOM } = require('jsdom');

async function main() {
  const serve = process.argv.includes('--serve');
  const mocks = {
    'next/image': `import React from 'react'; export default function Image({fill,priority,sizes,...props}) { return <img {...props}/>; }`,
    '@/components/projects/useSaveToProjectFolder': `export const useSaveToProjectFolder = () => ({openSaveDialog(){},modalProps:{}});`,
    '@/components/projects/SaveToFolderModal': `export default function Modal(){return null;}`,
    '@/lib/intelligence/tag-signals': `export function recordTagSignal(){}`,
    './HologramExpansion': `export function HologramExpansion(){return null;}`,
    './PartialProductPrompt': `export function PartialProductPrompt(){return null;}`,
    'framer-motion': `
      import React from 'react';
      export const AnimatePresence = ({children}) => children;
      export const motion = new Proxy({}, {get: (_,tag) => components[tag] ||= React.forwardRef(function Motion({initial,animate,exit,transition,whileHover,layout,style,...props},ref){
        const {y,...domStyle} = style || {};
        return React.createElement(tag,{...props,style:domStyle,ref});
      })});
      const components = {};
      export const useScroll = () => ({scrollYProgress:0});
      export const useTransform = () => 0;
    `,
  };
  if (serve) delete mocks['framer-motion'];
  const bundle = await esbuild.build({
    stdin: {
      contents: `
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {PhotoTile} from './src/components/story/PhotoTile';
        import {MobileTapOverlay} from './src/components/project/interaction/MobileTapOverlay';
        import {normalizeTags} from './src/components/project/interaction/types';
        const image = {id:'room-photo',url:'/fixture-room.png',width:900,height:600,tags:[
          {id:'tag-chair',x:0.4,y:0.5,product:{id:'chair',name:'Fixture chair',category:'lighting',imageUrl:'/chair.png',vendor:{name:'Fixture maker'}}},
          {id:'tag-lamp',x:0.7,y:0.3,product:{id:'lamp',name:'Fixture lamp',category:'lighting',imageUrl:'/lamp.png',vendor:{name:'Fixture maker'}}}
        ]};
        window.fixture = {expansions:0,activations:[],image};
        const root = createRoot(document.getElementById('root'));
        window.renderFixture = (mode='photo',expanded=false) => root.render(
          mode === 'mobile' ? <MobileTapOverlay tags={normalizeTags(image)} onTagTap={tag=>window.fixture.activations.push(tag.productId)}/>
          : <PhotoTile image={image} imageUrl={image.url} alt="Fixture room" isExpanded={expanded} reducedMotion onClick={()=>window.fixture.expansions++}/>
        );
        window.renderFixture();
      `,
      sourcefile: 'photo-tags-fixture.tsx', resolveDir: process.cwd(), loader: 'tsx',
    },
    bundle: true, write: false, platform: 'browser', jsx: 'automatic',
    define: {'process.env.NODE_ENV':'"development"'},
    plugins: [{name:'fixture-boundaries',setup(build){
      build.onResolve({filter:/.*/},args=>{
        if (Object.hasOwn(mocks,args.path)) return {path:args.path,namespace:'fixture'};
        // Framer catches this optional peer's absence at runtime.
        if (args.path === '@emotion/is-prop-valid') return {path:args.path,external:true};
        const specifier = args.path.startsWith('@/') ? path.join(process.cwd(),'src',args.path.slice(2))
          : args.path.startsWith('.') ? path.resolve(args.resolveDir || process.cwd(),args.path) : args.path;
        const local = path.isAbsolute(specifier) && ['', '.tsx', '.ts', '.js'].map(extension=>specifier+extension).find(file=>fs.existsSync(file)&&fs.statSync(file).isFile());
        return {path:local || require.resolve(specifier,{paths:[args.resolveDir || process.cwd()]}),namespace:'resolved'};
      });
      build.onLoad({filter:/.*/,namespace:'resolved'},args=>({contents:fs.readFileSync(args.path,'utf8'),loader:args.path.endsWith('.tsx')?'tsx':args.path.endsWith('.ts')?'ts':'js',resolveDir:path.dirname(args.path)}));
      build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'tsx',resolveDir:process.cwd()}));
    } }],
  });
  if (serve) {
    const http = require('node:http');
    const server = http.createServer((request,response)=>{
      if (request.url === '/fixture.js') {
        response.setHeader('Content-Type','text/javascript');
        response.end(bundle.outputFiles[0].text);
      } else if (request.url.endsWith('.png')) {
        response.setHeader('Content-Type','image/svg+xml');
        response.end('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#ded5c8"/><rect x="290" y="250" width="140" height="160" rx="15" fill="#79624d"/><rect x="625" y="100" width="10" height="190" fill="#564c40"/><path d="M580 140L680 140L660 75L600 75Z" fill="#9a8869"/></svg>');
      } else {
        response.setHeader('Content-Type','text/html');
        response.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
          body{margin:0;padding:32px;font:16px Arial;color:#302a24;background:#faf8f4}#root{max-width:900px;margin:24px auto}
          *{box-sizing:border-box}.relative{position:relative}.absolute{position:absolute}.inset-0{inset:0}.w-full{width:100%}.h-auto{height:auto}
          .overflow-hidden{overflow:hidden}.pointer-events-none{pointer-events:none}.pointer-events-auto{pointer-events:auto}.hidden{display:none}
          img{display:block;max-width:100%}.rounded-full{border-radius:50%}.bg-surface-ground{background:#ece6dd}.rounded-2xl{border-radius:16px}
          .px-3{padding-left:12px;padding-right:12px}.py-2\\.5{padding-top:10px;padding-bottom:10px}.z-10{z-index:10}
          [class*="z-[2]"]{z-index:2}[class*="z-[4]"]{z-index:4}[class*="z-[20]"]{z-index:20}
          :root{--tag-dot-color:white;--tag-dot-border:1px solid #444;--tag-dot-shadow:0 0 0 8px #ffffff20;--tag-expand-bg:#fff;--tag-expand-blur:0px;--tag-expand-shadow:0 2px 12px #0003}
          @media(min-width:768px){.md\\:hidden{display:none}.md\\:block{display:block}}
        </style></head><body><h1>Photo tag interaction check</h1><div id="root"></div><script src="/fixture.js"></script></body></html>`);
      }
    });
    server.listen(4178,'127.0.0.1',()=>console.log('Photo tag fixture: http://127.0.0.1:4178'));
    return;
  }
  const cases = [
    ['a short touch reveals visible photo tags', async ({window,document,tick,touch,visible}) => {
      const overlay = document.querySelector('.md\\:hidden');
      await touch(overlay,'touchstart'); await touch(overlay,'touchend');
      const dot = overlay.querySelector('button');
      assert.ok(dot,'short touch creates a tag button');
      assert.ok(visible(dot),'revealed tag must not be hidden by an ancestor');
    }],
    ['touching a revealed dot opens that product', async ({window,document,tick,touch}) => {
      window.renderFixture('mobile'); await tick();
      const overlay = document.querySelector('.md\\:hidden');
      await touch(overlay,'touchstart'); await touch(overlay,'touchend');
      const dot = overlay.querySelector('button[aria-label="View Fixture lamp"]');
      await touch(dot,'touchstart'); await touch(dot,'touchend');
      assert.ok(dot.isConnected,'touchend must retain the dot until its click is delivered');
      dot.click(); await tick();
      assert.deepEqual([...window.fixture.activations],['lamp']);
    }],
    ['keyboard product activation does not toggle the room', async ({window,document,tick}) => {
      window.renderFixture('photo',true); await tick();
      const dot = document.querySelector('button[aria-label="View Fixture chair"]');
      assert.ok(dot);
      dot.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
      dot.click(); await tick();
      assert.equal(window.fixture.expansions,0,'Enter on a tag belongs to the tag');
      assert.ok(document.querySelector('button[aria-label="Product actions"]'),'real product card opens');
      assert.ok(document.body.textContent.includes('Fixture chair'));
      const photo = document.querySelector('[role="button"]');
      photo.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
      photo.dispatchEvent(new window.KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true}));
      assert.equal(window.fixture.expansions,2,'the photo itself still responds to Enter and Space');
    }],
    ['a cancelled touch cannot reveal tags later', async ({window,document,tick,touch}) => {
      window.renderFixture('mobile'); await tick();
      const overlay = document.querySelector('.md\\:hidden');
      await touch(overlay,'touchstart'); await touch(overlay,'touchcancel');
      await new Promise(resolve=>setTimeout(resolve,330));
      assert.ok(!overlay.querySelector('button'),'cancelled touches must clear the long-press timer');
    }],
    ['desktop hover opens the selected product and Escape dismisses it', async ({window,document,tick,visible}) => {
      const overlay = document.querySelector('.z-\\[2\\]');
      overlay.dispatchEvent(new window.MouseEvent('mouseover',{bubbles:true})); await tick();
      const dot = document.querySelector('button[aria-label="View Fixture lamp"]');
      assert.ok(dot && visible(dot));
      dot.click(); await tick();
      assert.ok(document.body.textContent.includes('Fixture lamp'));
      assert.ok(document.body.textContent.includes('Fixture maker'));
      overlay.dispatchEvent(new window.MouseEvent('mouseout',{bubbles:true,relatedTarget:document.body})); await tick();
      const actions = document.querySelector('button[aria-label="Product actions"]');
      assert.ok(actions && visible(actions),'the parent cannot hide an active product card');
      window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape'})); await tick();
      assert.ok(!document.querySelector('button[aria-label="Product actions"]'));
    }],
  ];
  let failures = 0;
  for (const [name,check] of cases) {
    const dom = new JSDOM('<div id="root"></div>',{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost'});
    const {window}=dom;
    window.HTMLElement.prototype.getBoundingClientRect = () => ({x:0,y:0,left:0,top:0,right:900,bottom:600,width:900,height:600});
    const tick = () => new Promise(resolve=>setTimeout(resolve,20));
    const touch = async (element,type) => {element.dispatchEvent(new window.Event(type,{bubbles:true,cancelable:true})); await tick();};
    const visible = element => {for(let el=element;el;el=el.parentElement) if(el.style.opacity==='0'||el.hidden) return false; return true;};
    try {
      window.eval(bundle.outputFiles[0].text); await tick();
      await check({window,document:window.document,tick,touch,visible});
      console.log(`PASS ${name}`);
    } catch(error) {failures++; console.error(`FAIL ${name}: ${error.message}`);}
    finally {window.close();}
  }
  assert.equal(failures,0,`${failures} photo/tag interaction regressions`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});

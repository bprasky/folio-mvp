// Local, isolated browser fixture using the actual publication components.
// Optional PUBLICATION_FIXTURE_DIR reads the approved local reference assets.
// No application credentials, database calls, or production writes.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.tmp/publication-preview');
fs.mkdirSync(out, { recursive: true });
const assets = path.dirname(fs.realpathSync(path.join(root, 'node_modules')));
const reference = process.env.PUBLICATION_FIXTURE_DIR;
const content = reference ? JSON.parse(fs.readFileSync(path.join(reference, 'immersive-room-content.json'))) : null;
const photos = reference ? JSON.parse(fs.readFileSync(path.join(reference, 'editorial-photo-data.json'))) : Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => ['room-' + i, { label: 'Room ' + (i + 1), src: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="${i % 2 ? '#9a8370' : '#686b65'}"/><rect x="100" y="140" width="400" height="550" fill="#ddd2ba"/><text x="600" y="500" fill="white" font-size="70">Room ${i + 1}</text></svg>`) }]),
);
const imageEntries = Object.entries(photos);
const post = { id: 'fixture-post', projectId: 'fixture-project', slug: 'fixture', status: 'PUBLISHED',
  project: { id: 'fixture-project', title: content?.project || 'A house in balance', city: content?.location || 'New York',
    designer: { name: content?.designer || 'Alex Designer', studio: content?.studio || 'Example Studio' },
    images: imageEntries.map(([key, photo]) => ({ id: key, url: photo.src, roomId: key, room: photo.label, name: photo.label, inclusion: 'INCLUDED', tags: [] })),
  },
  expandedBlocks: { lead: { title: content?.title || 'A house shaped by light', deck: content?.intro || 'The details behind the project.' },
    introduction: content?.projectParagraphs || ['A considered home, shaped around the family who lives here.'],
    galleryChapters: imageEntries.map(([key, photo], i) => {
      const room = content?.rooms.find(room => room.key === key);
      return { roomId: key, title: photo.label, imageIds: [key],
        body: room?.paragraphs || (content ? [] : i < 7 ? Array.from({ length: i === 1 ? 40 : 3 }, () => 'the room brings together daylight, quiet materials and space to gather. Every detail has a purpose within the home.') : []),
        pullQuote: room?.quote || (content ? null : i < 7 ? 'We wanted each room to feel like it belonged to the people who use it.' : null) };
    }),
  },
};
let presentation = { version: 1, accent: null, roomOrder: [] };

async function main() {
  fs.writeFileSync(path.join(out, 'post.json'), JSON.stringify(post));
  await esbuild.build({ stdin: { contents: `
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {StoryRenderer} from './src/components/story/StoryRenderer';
import {ImmersiveRooms} from './src/components/story/ImmersiveRooms';
import {StoryEditProvider} from './src/components/story/StoryEditContext';
import {buildStoryData} from './src/lib/story/buildRoomTiles';
import {PublicationPhotoPreview} from './src/components/instagram-export/PublicationPhotoPreview';
import {publicationPhotos} from './src/lib/instagram-export/publication-photo';
function App(){const [post,setPost]=useState(null);const [aspect,setAspect]=useState('9:16');const [photoIndex,setPhotoIndex]=useState(0);useEffect(()=>{fetch('/post.json').then(r=>r.json()).then(setPost)},[]);if(!post)return <p>Loading fixture…</p>;
const params=new URLSearchParams(location.search), edit=params.has('edit'), full=params.has('full');
const viewer=full?<StoryRenderer post={post}/>:<ImmersiveRooms story={buildStoryData(post)} projectName={post.project.title} presentation={post.expandedBlocks.presentation} autoExpandRoom={params.get('room')} onProductClick={()=>{}}/>;
const photo=post.project.images[photoIndex], photoModels=publicationPhotos(post.project,post,post.project.images,post.project.designer);
return <><nav><a href="/">Rooms</a> · <a href="/?full">Full article</a> · <a href="/?edit">Editor</a> · <a href="/?long">Long names & story</a> · <a href="/?social">Instagram</a></nav>{params.has('social')?<section style={{maxWidth:390,margin:'20px auto'}}><label>Instagram format <select value={aspect} onChange={event=>setAspect(event.target.value)}>{['9:16','4:5','1:1'].map(value=><option key={value}>{value}</option>)}</select></label><label> Photo <select value={photoIndex} onChange={event=>setPhotoIndex(Number(event.target.value))}>{post.project.images.map((image,index)=><option key={image.id} value={index}>{image.room}</option>)}</select></label><div style={{width:'100%',aspectRatio:aspect.replace(':',' / '),marginTop:16}}><PublicationPhotoPreview imageUrl={photo.url} photo={photoModels[photo.url]} aspectRatio={aspect}/></div></section>:edit?<StoryEditProvider projectId="fixture-project" initialOverrides={[]} chapters={[]}>{viewer}</StoryEditProvider>:viewer}</>};
createRoot(document.getElementById('root')).render(<App/>);`, resolveDir: root, loader: 'tsx' },
    outfile: path.join(out, 'bundle.js'), bundle: true, platform: 'browser', jsx: 'automatic', alias: { '@': path.join(root, 'src') },
    define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' },
    plugins: [{ name: 'fixture-boundaries', setup(b) {
      b.onResolve({ filter: /^next\/(navigation|image|link)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root, contents: args.path === 'next/navigation'
        ? `export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({refresh:()=>location.reload(),push:url=>location.assign(url)});export const usePathname=()=>location.pathname;`
        : args.path === 'next/link' ? `import React from 'react';export default ({children,...props})=><a {...props}>{children}</a>;`
        : `import React,{forwardRef} from 'react';export default forwardRef(function Image({fill,unoptimized,priority,quality,loader,sizes,...props},ref){return <img {...props} ref={ref} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>});` }));
    } }],
  });
  const globals = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  const config = require(path.join(root, 'tailwind.config.js'));
  config.content = [path.join(root, 'src/components/story/**/*.tsx'), path.join(root, 'src/components/posting/**/*.tsx')];
  let css = (await postcss([tailwind(config)]).process(globals, { from: path.join(root, 'src/app/globals.css') })).css;
  let faces = '', heading, body;
  for (const file of fs.readdirSync(path.join(assets, '.next/static/css')).filter(file => file.endsWith('.css'))) {
    for (const face of fs.readFileSync(path.join(assets, '.next/static/css', file), 'utf8').match(/@font-face\{[^}]+\}/g) || []) {
      if (!/Cormorant_Garamond|Instrument_Sans/.test(face)) continue;
      faces += face; const family = face.match(/font-family:([^;]+)/)[1];
      if (/Cormorant_Garamond/.test(face) && !/Fallback/.test(family)) heading = family;
      if (/Instrument_Sans/.test(face) && !/Fallback/.test(family)) body = family;
    }
  }
  css += faces + `\n:root{--font-headline:${heading || 'serif'};--font-body:${body || 'sans-serif'}}body{margin:0}nav{padding:10px 20px;font:12px sans-serif;background:#eee;color:#222}nav a{text-decoration:underline}`;
  fs.writeFileSync(path.join(out, 'globals.css'), css);
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/bundle.css"><title>Folio publication implementation</title></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://fixture');
    if (url.pathname === '/api/posting/project/fixture-project/presentation') {
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'PATCH') { let data = ''; req.on('data', chunk => data += chunk); req.on('end', () => { presentation = { ...presentation, ...JSON.parse(data) }; res.end(JSON.stringify({ ok: true, presentation })); }); return; }
      return res.end(JSON.stringify({ presentation, colors: ['#8B7962', '#52624F', '#B6A08E', '#C8C2B3'] }));
    }
    if (url.pathname === '/post.json') {
      const data = structuredClone(post); data.expandedBlocks.presentation = presentation;
      if (req.headers.referer?.includes('?long')) {
        data.project.title = 'The family residence overlooking the courtyard and the gardens';
        data.project.designer.studio = 'A long studio name with collaborators and associates';
        data.expandedBlocks.galleryChapters[0].title = 'The library and music room overlooking the walled courtyard with quiet spaces for reading and family gatherings';
        data.expandedBlocks.galleryChapters[0].pullQuote = 'We wanted this room to be a place where every member of the family could feel at home, with space to read, to listen to music, and to gather with friends. The natural light, the warm materials and the carefully considered details all work together to make that possible, every day of the year.';
        data.expandedBlocks.galleryChapters[0].body = Array(50).fill(data.expandedBlocks.galleryChapters[0].body[0]);
      }
      res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(data));
    }
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); return res.end(html); }
    const file = url.pathname.startsWith('/fonts/publication/') ? path.join(root, 'public/fonts/publication', path.basename(url.pathname))
      : /\/(?:static\/)?media\//.test(url.pathname) ? path.join(assets, '.next/static/media', path.basename(url.pathname)) : path.join(out, path.basename(url.pathname));
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  server.listen(Number(process.env.PORT || 4318), '127.0.0.1', () => console.log('Publication fixture ready at http://127.0.0.1:' + server.address().port));
}
main().catch(error => { console.error(error); process.exitCode = 1; });

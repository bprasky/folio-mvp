// Actual room workspace, board entry and media upload components; synthetic action/HTTP boundaries.
// Retired route modules are executed with only next/server mocked. No provider or database calls.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http'), vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const esbuild = require('esbuild'), puppeteer = require('puppeteer-core'), ts = require('typescript');
const postcss = require('postcss'), tailwind = require('tailwindcss');
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/manual-rooms-browser');
const review = path.resolve(process.env.MANUAL_ROOMS_REVIEW_DIR || path.join(out, 'review'));
const results = [], actions = [], requests = [];
let rooms, images, assignmentFailure = false, saveFailure = false;
const savedNames = new Map();
function reset() {
  actions.length = 0; requests.length = 0;
  rooms = [{ id: 'kitchen', name: 'Kitchen' }, { id: 'living', name: 'Living room' }];
  images = [
    { id: 'unassigned', name: 'Window detail', roomId: null, aiSpaces: ['kitchen'] },
    { id: 'saved', name: 'Existing photo', room: 'Living room', roomId: 'living', aiSpaces: ['kitchen'] },
    { id: 'garden', name: 'Garden', roomId: null, aiSpaces: ['kitchen'] },
    { id: 'discard', name: 'Discard shot', roomId: null, aiSpaces: [] },
  ].map(image => ({ ...image, url: '/photo.svg', inclusion: 'INCLUDED', tags: [] }));
}
const navigation = `
import React,{useSyncExternalStore}from'react';
const subscribe=fn=>{window.addEventListener('nav',fn);return()=>window.removeEventListener('nav',fn)};
window.refreshes=Number(sessionStorage.getItem('fixture-refreshes')||0);window.navigate=url=>{history.pushState({},'',url);window.dispatchEvent(new Event('nav'))};
const router={push:window.navigate,replace:window.navigate,refresh:()=>{window.refreshes++;sessionStorage.setItem('fixture-refreshes',String(window.refreshes));window.dispatchEvent(new Event('refresh'))}};
export const useRouter=()=>router;export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search));
export default function Link({href,children,prefetch,...props}){return <a {...props} href={href} onClick={event=>{event.preventDefault();window.navigate(href)}}>{children}</a>}
`;
const actionBoundary = `
const action=(name,args)=>fetch('/api/fixture/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})}).then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.error || 'Request failed');return body;});
export const assignImageToRoom=args=>action('assign',args);
export const excludeImage=args=>action('exclude',args);
export const includeImage=args=>action('include',args);
export const unassignImage=args=>action('unassign',args);
export const createRoom=args=>action('create',args);
export const renameRoom=args=>action('rename',args);
export const setImageNoProducts=args=>action('no-products',args);
`;
const entry = `
import React,{useEffect,useState}from'react';import{createRoot}from'react-dom/client';import{useSearchParams}from'next/navigation';
import Rooms from './src/app/project/[id]/RoomGroupedMedia';import Board from './src/app/project/[id]/DesignerBoard';import Media from './src/app/project/[id]/MediaSection';
function App(){const search=useSearchParams();const[data,setData]=useState(null);const[revision,setRevision]=useState(0);useEffect(()=>{fetch('/api/fixture/state').then(r=>r.json()).then(setData)},[revision]);useEffect(()=>{const fn=()=>setRevision(n=>n+1);window.addEventListener('refresh',fn);return()=>window.removeEventListener('refresh',fn)},[]);if(!data)return <p>Loading fixture</p>;const project={id:'project',title:'Manual room archive',projectType:'RESIDENTIAL',clientType:'RESIDENTIAL',rooms:data.rooms};if(search.get('surface')==='board')return <Board projectId="project" project={{...project,rooms:[]}} imageCount={data.images.length} images={data.images}/>;if(search.get('surface')==='media')return <Media project={project} images={data.images} isOwner/>;return <main className="mx-auto max-w-5xl p-4"><Rooms projectId="project" isOwner images={data.images} rooms={data.rooms} selectedHeroImageId={null} onSetCover={()=>{}} onDelete={()=>{}} onChanged={()=>setRevision(n=>n+1)}/></main>}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
`;
async function build() {
  fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(review, { recursive: true });
  await esbuild.build({
    stdin: { contents: entry, loader: 'tsx', resolveDir: root }, bundle: true, platform: 'browser', jsx: 'automatic',
    outfile: path.join(out, 'app.js'), alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' },
    plugins: [{ name: 'fixture', setup(build) {
      if (process.env.MANUAL_ROOMS_SOURCE_REF) build.onLoad({ filter: /(RoomGroupedMedia|DesignerBoard|MediaSection|ProjectCreationModal)\.tsx$/ }, args => ({
        contents: execFileSync('git', ['show', process.env.MANUAL_ROOMS_SOURCE_REF + ':' + path.relative(root, args.path).replaceAll('\\', '/')], { cwd: root, encoding: 'utf8' }), loader: 'tsx', resolveDir: path.dirname(args.path),
      }));
      build.onResolve({ filter: /^(next\/(navigation|link|image)|next-auth\/react|@\/app\/actions\/projectImages|@\/components\/interviews\/ProjectConversationHost)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onResolve({ filter: /(DesignerBoardRoom|GenerateDialog|GeneratedGrid|ExportSpecModal|PresentationImportModal|PdfSpecImportModal|TaggingSection|MaterialsStep|DocumentImportModal|TagReviewPanel|ProjectCreditsCard|ProfessionalUpgradeModal)$|^@\/components\/designer\/project$/ }, args => ({ path: 'off-surface', namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root, contents:
        args.path === '@/app/actions/projectImages' ? actionBoundary :
        args.path === '@/components/interviews/ProjectConversationHost' ? 'export const useProjectConversation=()=>null;' :
        args.path === 'off-surface' ? 'export default function OffSurface(){return null}export const PresentationImportModal=()=>null;export const PdfSpecImportModal=()=>null;export const BoardsEmptyState=()=>null;export const ProfessionalUpgradeModal=()=>null;' :
        args.path === 'next-auth/react' ? "export const useSession=()=>({data:{user:{id:new URLSearchParams(location.search).get('account')||'designer',role:'DESIGNER',operatingAsOrgId:'firm'}},status:'authenticated'});" :
        args.path === 'next/image' ? "import React from'react';export default function Image({fill,priority,unoptimized,loader,...props}){return <img {...props} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',...props.style}:props.style}/>}" : navigation,
      }));
    } }],
  });
  const bundledCss = fs.readFileSync(path.join(out, 'app.css'), 'utf8');
  const content = ['src/app/project/[id]/RoomGroupedMedia.tsx', 'src/components/rooms/RoomNameInput.tsx', 'src/components/ui/dialog.tsx', 'src/app/project/[id]/DesignerBoard.tsx', 'src/app/project/[id]/MediaSection.tsx', 'src/components/ProjectCreationModal.tsx'].map(file => ({ raw: fs.readFileSync(path.join(root, file), 'utf8'), extension: 'tsx' }));
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  fs.writeFileSync(path.join(out, 'app.css'), (await postcss([tailwind({ ...require(path.join(root, 'tailwind.config.js')), content })]).process(css, { from: path.join(root, 'src/app/globals.css') })).css + '\n' + bundledCss + '\n:root{--font-headline:Georgia;--font-body:Arial}');
  fs.writeFileSync(path.join(out, 'photo.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0hUAAAAASUVORK5CYII=', 'base64'));
}
function handler(req, res) {
  const route = new URL(req.url, 'http://local').pathname;
  const json = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  if (route === '/app.js' || route === '/app.css') { res.setHeader('Content-Type', route.endsWith('.js') ? 'text/javascript' : 'text/css'); return fs.createReadStream(path.join(out, route.slice(1))).pipe(res); }
  if (route === '/photo.svg') { res.setHeader('Content-Type', 'image/svg+xml'); return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#c9c1ad"/><rect x="150" y="80" width="500" height="300" fill="#91a49a"/><text x="70" y="500" font-size="30">Synthetic project photograph</text></svg>'); }
  if (!route.startsWith('/api/')) { res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>'); }
  requests.push({ route, method: req.method });
  if (req.method === 'GET') {
    if (route === '/api/me/room-names') { const account = new URL(req.headers.referer || 'http://local').searchParams.get('account') || 'designer'; return json({ names: savedNames.get(account) || [] }); }
    if (route === '/api/fixture/state') return json({ images, rooms });
    if (route === '/api/projects/project') return json({ id: 'project', rooms });
    if (route === '/api/projects/project/pricing') return json({ entries: [] });
    if (route === '/api/posting/project/project') return json({ post: null });
    if (route === '/api/products') return json([]);
    return json({});
  }
  let body = ''; req.on('data', part => { body += part; }); req.on('end', () => {
    const data = JSON.parse(body || '{}');
    if (route === '/api/me/room-names') {
      if(saveFailure) return json({error:'Saved names unavailable. Try again.'},503);
      const account = new URL(req.headers.referer || 'http://local').searchParams.get('account') || 'designer';
      const names=savedNames.get(account)||[];
      savedNames.set(account,req.method==='DELETE'?names.filter(name=>name!==data.name):[...new Set([...names,data.name])]);
      return json({name:data.name});
    }
    if (route === '/api/projects/project/rooms') {
      assert.match(data.requestId, /^[a-zA-Z0-9-]{16,80}$/);
      let room = data.reuseExisting && rooms.find(room=>room.name.toLowerCase()===data.name.trim().toLowerCase()); if(!room) { room = { id: 'room-' + rooms.length, name: data.name }; rooms.push(room); }
      actions.push({ name: 'create', args: data }); return json(room);
    }
    if (route === '/api/fixture/actions') {
      const { name, args } = data; actions.push(data);
      const image = images.find(image => image.id === args.imageId);
      if (name === 'create') { const room = { id: 'room-' + rooms.length, name: args.name }; rooms.push(room); return json({ room }); }
      if (name === 'assign' && assignmentFailure) { assignmentFailure=false; return json({error:'Assignment interrupted. Try again.'},503); }
      if (name === 'assign') { image.roomId = args.roomId; image.room = rooms.find(room => room.id === args.roomId).name; }
      if (name === 'exclude') image.inclusion = 'EXCLUDED';
      if (name === 'include') image.inclusion = 'INCLUDED';
      if (name === 'unassign') { image.roomId = null; image.room = null; }
      if (name === 'rename') rooms.find(room => room.id === args.roomId).name = args.name;
      return json({ ok: true });
    }
    if (route === '/api/projects') return json({ id: 'project', title: 'Manual room archive' });
    if (route === '/api/projects/project/images') return json({ image: { id: 'uploaded-photo', url: '/photo.svg', name: data.name } }, 201);
    return json({ ok: true });
  });
}
async function check(id, name, work) {
  if (process.env.MANUAL_ROOMS_CHECK && process.env.MANUAL_ROOMS_CHECK !== id) return;
  await work(); results.push({ id, name }); console.log('PASS ' + name);
}
async function retiredRoutes() {
  for (const route of ['analyze-images', 'detect-rooms']) await check(route, route + ' returns 410 without importing auth, AI, or database services', async () => {
    const file = path.join(root, 'src/app/api/projects/[id]', route, 'route.ts');
    const source = fs.readFileSync(file, 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const compiledModule = { exports: {} };
    vm.runInNewContext('(function(require,module,exports){' + code + '\n})', {})(name => {
      assert.equal(name, 'next/server', 'retired routes cannot import service dependencies');
      return { NextResponse: { json: (data, init) => Response.json(data, init) } };
    }, compiledModule, compiledModule.exports);
    const response = await compiledModule.exports.POST(new Request('https://folio.test/api/projects/project/' + route, { method: 'POST' }), { params: { id: 'project' } });
    assert.equal(response.status, 410); assert.match((await response.json()).error, /removed/i);
  });
}
async function main() {
  await retiredRoutes(); await build(); reset();
  const server = http.createServer(handler); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const executablePath = process.env.GUIDED_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(fs.existsSync);
  const browser = await puppeteer.launch({ executablePath, headless: true, userDataDir: fs.mkdtempSync(path.join(out, 'chrome-')), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage(); page.setDefaultTimeout(7000); await page.setViewport({ width: 1440, height: 1000 });
  const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.dismiss());
  await page.setRequestInterception(true); page.on('request', request => request.url().startsWith(base) || /^(data|blob):/.test(request.url()) ? request.continue() : request.abort());
  const text = value => page.waitForFunction(value => document.body.innerText.includes(value), {}, value);
  const click = async label => { await page.waitForFunction(label => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === label && !button.disabled), {}, label); for (const button of await page.$$('button')) if ((await button.evaluate(node => node.textContent.trim())) === label) { await button.click(); return; } };
  const actionFor = async (photo, label) => page.$eval('input[aria-label="Room for ' + photo + '"]', (input, label) => [...input.closest('.space-y-1').querySelectorAll('button')].find(button => button.textContent.trim() === label).click(), label);
  const typeRoom = async (photo, value) => { const selector='input[aria-label="Room for '+photo+'"]'; await page.waitForSelector(selector); await page.click(selector); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.type(selector,value); };
  const assigned = photo => page.waitForFunction(photo=>!document.querySelector('#uncategorized-group input[aria-label="Room for '+photo+'"]'),{},photo);
  const noDetection = () => assert.deepEqual(requests.filter(request => /analyze-images|detect-rooms/.test(request.route)), []);
  try {
    await check('resolver', 'historical AI suggestions never preselect rooms and saved assignments remain intact', async () => {
      reset(); await page.goto(base + '/?surface=rooms'); await page.waitForSelector('#uncategorized-group input[role="combobox"]');
      assert.deepEqual(await page.$$eval('#uncategorized-group input[role="combobox"]', selects => selects.map(select => select.value)), ['', '', '']);
      assert(await page.$$eval('#uncategorized-group button', buttons => buttons.filter(button => button.textContent.trim() === 'Assign').every(button => button.disabled)));
      assert.equal(await page.$eval('img[alt="Existing photo"]', image => image.closest('section').textContent.includes('Living room')), true);
      assert.equal(images.find(image => image.id === 'saved').roomId, 'living'); assert.deepEqual(actions, []); noDetection();
      await page.screenshot({ path: path.join(review, 'manual-rooms-desktop.png'), fullPage: true });
      await page.setViewport({ width: 390, height: 844 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: path.join(review, 'manual-rooms-mobile.png'), fullPage: true }); await page.setViewport({ width: 1440, height: 1000 });
    });
    await check('manual', 'designers can assign, create and name rooms, rename them, exclude photos and restore them', async () => {
      reset(); await page.goto(base + '/?surface=rooms'); await page.waitForSelector('input[aria-label="Room for Window detail"]');
      await typeRoom('Window detail','kit'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => !document.querySelector('#uncategorized-group input[role="combobox"][aria-label="Room for Window detail"]')); assert.equal(images.find(image => image.id === 'unassigned').roomId, 'kitchen');
      await typeRoom('Garden','Courtyard'); await page.keyboard.press('Enter'); await assigned('Garden'); await text('Courtyard');
      const created = rooms.find(room => room.name === 'Courtyard'); assert(created); assert.equal(images.find(image => image.id === 'garden').roomId, created.id);
      await click('Courtyard'); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
      await page.keyboard.type('Inner courtyard'); await page.keyboard.press('Enter'); await text('Inner courtyard'); assert.equal(rooms.find(room => room.id === created.id).name, 'Inner courtyard');
      await actionFor('Discard shot', 'Leave out'); await text('Left out of this project (1)'); assert.equal(images.find(image => image.id === 'discard').inclusion, 'EXCLUDED');
      await click('Left out of this project (1)'); await click('Bring back'); await page.waitForSelector('input[aria-label="Room for Discard shot"]'); assert.equal(images.find(image => image.id === 'discard').inclusion, 'INCLUDED');
      assert.equal(images.find(image => image.id === 'saved').roomId, 'living'); assert(actions.some(action => action.name === 'create')); assert(actions.some(action => action.name === 'rename')); noDetection();
    });
    await check('autocomplete', 'standard suggestions create once, reuse project rooms and support keyboard completion', async () => {
      reset(); rooms=[]; await page.goto(base+'/?surface=rooms');
      await typeRoom('Window detail','LIV'); await text('Living Room');
      assert.equal(actions.length,0); await page.keyboard.press('Tab');
      assert.equal(await page.$eval('input[aria-label="Room for Window detail"]',input=>input.value),'Living Room');
      await page.keyboard.press('Enter'); await assigned('Window detail');
      await typeRoom('Garden','liv'); await text('In this project'); await page.keyboard.press('Enter'); await assigned('Garden');
      assert.equal(rooms.length,1); assert.equal(images[0].roomId,images[2].roomId);
      assert.equal(actions.filter(action=>action.name==='create').length,1);
      await typeRoom('Discard shot','lving room'); await text('Did you mean'); await page.keyboard.press('Enter');
      assert.equal(images.find(image=>image.id==='discard').roomId,null);
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await assigned('Discard shot');
      assert.equal(rooms.length,1); noDetection();
    });
    await check('custom', 'custom names remain intact; suspected typos can be kept deliberately', async () => {
      reset(); await page.goto(base+'/?surface=rooms');
      await typeRoom('Garden',"Luca's bedroom"); await page.keyboard.press('Enter'); await assigned('Garden');
      assert(rooms.some(room=>room.name==="Luca's bedroom"));
      await typeRoom('Window detail','Bedroom 2'); await page.keyboard.press('Enter'); await assigned('Window detail');
      assert(rooms.some(room=>room.name==='Bedroom 2'));
      await typeRoom('Discard shot','Lving room'); await text('Did you mean');
      await click('Keep “Lving room”'); await page.keyboard.press('Enter'); await assigned('Discard shot');
      assert(rooms.some(room=>room.name==='Lving room'));
      assert.equal(requests.filter(request=>request.route==='/api/me/room-names'&&request.method==='POST').length,0);
    });
    await check('saved', 'explicit private names survive reload; saving can fail and retry; another account never sees them', async () => {
      reset(); savedNames.clear(); await page.goto(base+'/?surface=rooms'); await typeRoom('Garden','Flower Studio');
      const save='button[aria-label="Save room name for my future projects"]';
      await page.waitForFunction(selector=>document.querySelector(selector)&&!document.querySelector(selector).disabled,{},save);
      saveFailure=true; await page.click(save); await text('Saved names unavailable. Try again.');
      saveFailure=false; await page.click(save); await text('Saved for your future projects. Only you can see it.');
      assert.equal(actions.length,0,'Saving a suggestion does not create or assign a room');
      await page.reload(); await typeRoom('Garden','Flower'); await text('Flower Studio · Saved by you');
      await page.goto(base+'/?surface=rooms&account=second'); await typeRoom('Garden','Flower');
      assert.equal(await page.$('[role=option]'),null);
      await page.goto(base+'/?surface=rooms'); await typeRoom('Garden','Flower Studio');
      await page.waitForSelector('button[aria-label="Remove from my saved rooms"]');
      await page.click('button[aria-label="Remove from my saved rooms"]'); await text('Removed from your saved rooms.');
      assert.deepEqual(savedNames.get('designer'),[]);
    });
    await check('retry', 'retry after room creation and failed photo assignment reuses the saved room', async () => {
      reset(); await page.goto(base+'/?surface=rooms'); assignmentFailure=true;
      await typeRoom('Garden','Conservatory'); await page.keyboard.press('Enter'); await text('Assignment interrupted. Try again.');
      const id=rooms.find(room=>room.name==='Conservatory').id;
      await actionFor('Garden','Assign'); await assigned('Garden');
      assert.equal(rooms.filter(room=>room.name==='Conservatory').length,1);
      assert.equal(images.find(image=>image.id==='garden').roomId,id);
    });
    await check('layout', 'inline results fit narrow mobile and desktop in both themes', async () => {
      reset(); await page.goto(base+'/?surface=rooms'); await typeRoom('Garden','prim'); await text('Primary');
      for(const theme of ['light','dark']) for(const width of [360,390,768,1440]) {
        await page.setViewport({width,height:900}); await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        assert.equal(await page.$('select[aria-label^="Room for"]'),null);
        await page.screenshot({path:path.join(review,'autocomplete-'+theme+'-'+width+'.png'),fullPage:true});
      }
    });
    await check('board', 'photos without rooms open manual organization immediately without a detection request or waiting screen', async () => {
      reset(); await page.goto(base + '/?surface=board'); await text('Organize your photos by room');
      const href = await page.$eval('a[href*="action=sort-rooms"]', link => link.getAttribute('href'));
      assert.equal(href, '/project/project?view=media&step=rooms&action=sort-rooms');
      assert.equal(await page.evaluate(() => /analyzing|detecting|setting up your rooms/i.test(document.body.innerText)), false); noDetection();
      await page.screenshot({ path: path.join(review, 'board-manual-entry.png'), fullPage: true });
      await page.click('a[href*="action=sort-rooms"]'); await page.waitForFunction(() => new URLSearchParams(location.search).get('step') === 'rooms'); noDetection();
    });
    await check('upload', 'media image upload and its completion callback refresh without launching room detection', async () => {
      reset(); await page.goto(base + '/?surface=media&action=upload'); await page.evaluate(() => { window.refreshes = 0; sessionStorage.setItem('fixture-refreshes', '0'); }); await click('Next: Add Images');
      await (await page.$('input[type=file]')).uploadFile(path.join(out, 'photo.png')); await click('Next: Tag Products'); await click('Update Project');
      await page.waitForFunction(() => window.refreshes > 0); assert(requests.some(request => request.route.endsWith('/images') && request.method === 'POST')); noDetection();
    });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(review, process.env.MANUAL_ROOMS_CHECK ? 'filtered-results.json' : 'browser-results.json'), JSON.stringify({ boundary: 'Actual room, board and upload components; synthetic actions/HTTP. Real retired route modules.', results }, null, 2));
    console.log('PASS ' + results.length + ' manual room checks.');
  } catch (error) {
    console.error({ detectionRequests: requests.filter(request => /analyze-images|detect-rooms/.test(request.route)) });
    console.error(await page.evaluate(() => ({ url: location.href, body: document.body.innerText.slice(0,2200) })).catch(() => ({ url: page.url(), body: 'Page navigated during failure diagnostics.' })));
    await page.screenshot({ path: path.join(review, 'failure.png'), fullPage: true }).catch(() => {}); throw error;
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

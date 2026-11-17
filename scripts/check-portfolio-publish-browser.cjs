// Actual review component in Chromium; service/auth/privacy tests run separately.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/portfolio-browser');
const source = `import React from 'react';import {createRoot} from 'react-dom/client';import {Toaster} from 'react-hot-toast';import {PortfolioPhotoReview} from './src/components/projects/PortfolioPhotoReview';import {PortfolioPublishPanel} from './src/components/projects/PortfolioPublishPanel';import {StudioProjectInvitations} from './src/components/publishing-studio/StudioProjectInvitations';
const root=createRoot(document.getElementById('root'));const next=location.pathname.includes('/next');window.props={projectId:next?'next':'project',title:next?'Next home':'Imported home',version:'a'.repeat(64),coverImageId:null,isPublic:false,canPublish:true,canUnpublish:true,featureStatus:'DRAFT',profileHref:'/org/firm',featureHref:'/project/project?view=story',featureAction:'Create my feature',rooms:[],nextProject:next?null:{id:'next',title:'Next home'},photos:[0,1,2].map(i=>({id:'photo-'+i,url:'/photo.svg?i='+i,name:'Photograph '+(i+1),inclusion:i===2?'EXCLUDED':'INCLUDED',roomName:null}))};
window.invitations=['Interview needed','Interview in progress','Feature draft ready','Feature in review'].map((status,i)=>({id:'p'+i,title:'Home '+i,thumbnail:'/photo.svg',photosOnProfile:true,status,action:['Start interview','Continue interview','Review & publish feature','View feature review'][i],href:'/project/p'+i+'?view='+ (i<2?'story':'publish')}));
window.draw=()=>root.render(<><Toaster/>{window.mode==='studio'?<StudioProjectInvitations projects={window.invitations} subject={window.subject}/>:window.mode==='summary'?<PortfolioPublishPanel {...window.props}/>:<PortfolioPhotoReview key={window.props.projectId} {...window.props}/>}</>);window.draw();`;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  await esbuild.build({ stdin: { contents: source, resolveDir: root, loader: 'tsx' }, bundle: true, outfile: path.join(out, 'bundle.js'), format: 'iife', jsx: 'automatic', plugins: [{ name: 'boundaries', setup(build) {
    build.onResolve({ filter: /^(next\/navigation|next\/link|@\/app\/actions\/portfolio)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root, contents: args.path === 'next/navigation'
      ? 'export const useRouter=()=>({refresh:()=>window.draw()});'
      : args.path === 'next/link' ? `import React from 'react';export default ({children,...props})=><a {...props}>{children}</a>;`
        : `export async function publishPortfolioAction(input){window.calls=(window.calls||0)+1;window.saved=input;if(window.fail)throw Error('This project changed. Reload and review the latest photographs before publishing.');window.props={...window.props,isPublic:true,title:input.title,coverImageId:input.coverImageId,version:'b'.repeat(64),photos:window.props.photos.map(p=>({...p,inclusion:input.includedImageIds.includes(p.id)?'INCLUDED':'EXCLUDED'}))};return {projectId:input.projectId};}export async function unpublishPortfolioAction(){window.props={...window.props,isPublic:false,version:'c'.repeat(64)};}` }));
  } }] });
  const globals = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  const config = require(path.join(root, 'tailwind.config.js')); config.content = [path.join(root, 'src/components/projects/PortfolioPhotoReview.tsx'), path.join(root, 'src/components/projects/PortfolioPublishPanel.tsx'), path.join(root, 'src/components/publishing-studio/StudioProjectInvitations.tsx')];
  fs.writeFileSync(path.join(out, 'globals.css'), (await postcss([tailwind(config)]).process(globals, { from: path.join(root, 'src/app/globals.css') })).css);
  let fontCss = '', headline, body;
  for (const file of fs.readdirSync(path.join(root, '.next/static/css')).filter(file => file.endsWith('.css'))) {
    for (const face of fs.readFileSync(path.join(root, '.next/static/css', file), 'utf8').match(/@font-face\{[^}]+\}/g) || []) {
      if (!/Cormorant_Garamond|Instrument_Sans|__cormorant_|__instrumentSans_/.test(face)) continue;
      fontCss += face; const family = face.match(/font-family:([^;]+)/)[1];
      if (/Cormorant_Garamond|__cormorant_/.test(face) && !/Fallback/.test(family)) headline = family;
      if (/Instrument_Sans|__instrumentSans_/.test(face) && !/Fallback/.test(family)) body = family;
    }
  }
  assert.ok(headline && body, 'Build first for actual Folio fonts');
  fs.appendFileSync(path.join(out, 'globals.css'), fontCss + `:root{--font-headline:${headline};--font-body:${body}}body{font-family:var(--font-body)}`);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://fixture');
    if (url.pathname.startsWith('/_next/static/media/')) { res.end(fs.readFileSync(path.join(root, '.next/static/media', path.basename(url.pathname)))); return; }
    if (url.pathname === '/photo.svg') { res.setHeader('Content-Type', 'image/svg+xml'); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#b9b3a6"/><rect x="450" y="60" width="200" height="360" fill="#f6efe5"/></svg>'); return; }
    if (['/bundle.js', '/bundle.css', '/globals.css'].includes(url.pathname)) { res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(fs.readFileSync(path.join(out, url.pathname.slice(1)))); return; }
    res.end('<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/bundle.css"></head><body><main id="root"></main><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const executablePath = process.env.GUIDED_TEST_BROWSER || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome');
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    const clickText = async text => { const handle = await page.evaluateHandle(value => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === value), text); await handle.asElement().click(); await handle.dispose(); };
    for (const theme of ['light', 'dark']) for (const width of [320, 390, 1440]) {
      await page.setViewport({ width, height: 900 }); await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle0' });
      await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
      await page.waitForSelector('input[type="checkbox"]');
      assert.equal(await page.$('[role="dialog"]'), null, 'Approval is its own page');
      assert.equal(await page.$('input[list]'), null, 'Room sorting is optional and collapsed');
      assert.equal(await page.$$eval('input[type="checkbox"]:checked', nodes => nodes.length), 2);
      await page.click('input[type="radio"]:nth-of-type(1)');
      await page.$$eval('input[type="checkbox"]', nodes => nodes[0].click());
      assert.equal(await page.$eval('input[type="radio"]:checked', node => node.closest('div').querySelector('img').alt), 'Photograph 2', 'Excluding a cover chooses an included replacement');
      if (width !== 320) { await page.click('summary'); await page.waitForSelector('input[list]'); await page.type('input[list]:not(:disabled)', 'Living room'); }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.equal(await page.$eval('html', node => node.dataset.theme), theme);
      await page.screenshot({ path: path.join(out, `review-${theme}-${width}.png`), fullPage: true });
      await page.evaluate(() => { window.fail = true; window.props = { ...window.props, version: 'd'.repeat(64) }; window.draw(); });
      // The typed room name leaves Chrome's native datalist popup open; a real tap dismisses it, the harness must blur first.
      await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
      await clickText('Approve & add to profile'); await page.waitForSelector('[role="alert"]');
      assert.equal(await page.evaluate(() => window.saved.version), 'a'.repeat(64), 'Background refresh cannot replace the reviewed version');
      await page.waitForFunction(() => document.activeElement.getAttribute('role') === 'alert');
      await page.evaluate(() => { window.fail = false; }); await clickText('Approve & add to profile');
      await page.waitForFunction(() => document.body.innerText.includes('Your photographs are live.'));
      assert.match(await page.$eval('[role="status"]', node => node.textContent), /now visible on your Folio profile/);
      await page.waitForFunction(() => document.activeElement.tagName === 'H1');
      assert.deepEqual(await page.evaluate(() => window.saved.includedImageIds), ['photo-1']);
      assert.equal(await page.evaluate(() => window.saved.coverImageId), 'photo-1');
      assert.deepEqual(await page.evaluate(() => window.saved.roomAssignments || []), width === 320 ? [] : [{ imageId: 'photo-1', roomName: 'Living room' }]);
      assert.ok(await page.$('a[href="/project/project?view=story"]'));
      assert.ok(await page.$('a[href="/project/next?publish=photos"]'));
      assert.equal(await page.$eval('nav a:last-child', node => node.getAttribute('href')), '/org/firm');
      await page.screenshot({ path: path.join(out, `live-${theme}-${width}.png`), fullPage: true });
      await page.evaluate(() => { window.mode = 'summary'; window.draw(); });
      assert.ok(await page.$('a[href="/project/project?publish=photos"]'));
      await clickText('Unpublish project'); await page.waitForSelector('[role="dialog"]');
      await page.$eval('[role="dialog"]', dialog => [...dialog.querySelectorAll('button')].find(button => button.textContent.trim() === 'Unpublish project').click());
      await page.waitForFunction(() => document.body.innerText.includes('Add photographs to your profile'));
      await page.evaluate(() => { window.mode = 'studio'; window.draw(); });
      await page.waitForSelector('[aria-label="Unlock publishing for your projects"]');
      assert.equal(await page.$eval('details', node => node.open), false);
      await page.click('summary'); assert.ok(await page.$('a[href="/project/p3?view=publish"]'));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.screenshot({ path: path.join(out, `studio-${theme}-${width}.png`), fullPage: true });
      await page.evaluate(() => { window.subject = 'p1'; window.draw(); });
      await page.waitForFunction(() => document.querySelectorAll('li').length === 1);
      assert.ok(await page.$('a[href="/project/p1?view=story"]'));
      await page.evaluate(() => { window.subject = 'about-me'; window.draw(); });
      await page.waitForSelector('[aria-label="Unlock publishing for your projects"]', { hidden: true });
      console.log(`PASS ${theme} ${width}px: focused approval, optional rooms, failure recovery, toast, three next steps, withdrawal and Studio invitations`);
    }
    await page.goto(`http://127.0.0.1:${server.address().port}/project/next?publish=photos`, { waitUntil: 'networkidle0' });
    await clickText('Approve & add to profile');
    await page.waitForFunction(() => document.body.innerText.includes('Your photographs are live.'));
    assert.match(await page.$eval('main', node => node.textContent), /Next home/);
    assert.equal(await page.$('a[href="/project/next?publish=photos"]'), null, 'The last project has no next-project action');
    assert.equal(await page.$$eval('nav a', nodes => nodes.length), 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

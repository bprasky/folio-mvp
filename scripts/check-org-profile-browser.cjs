// Real profile/settings components with isolated API fixtures. Never writes an application account.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const puppeteer = require('puppeteer-core');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.tmp/org-profile-browser');
fs.mkdirSync(out, { recursive: true });
const org = { id: 'firm', name: 'Fixture Design Studio', type: 'DESIGN_FIRM', logo: null, description: 'Interiors shaped by light, material and the people who live in them.',
  tagline: null, location: 'Miami', foundedYear: 2010, specialties: [], projectTypes: [], serviceRegions: [], teamSizeRange: null };
const initial = { version: 1, backgroundColor: null, introduction: null, cover: { kind: 'auto' }, coverPosition: { x: 50, y: 50 }, identity: { mode: 'logo', url: null }, facts: null };
const projects = Array.from({ length: 4 }, (_, i) => ({ id: `project-${i}`, title: `Published project ${i + 1}`, images: [{ id: `00000000-0000-4000-8000-00000000000${i}`, url: '/photo.png' }] }));
let saved = structuredClone(initial), role = 'ADMIN', failSave = false, saveCount = 0;
const source = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import Settings from './src/app/org/[orgId]/settings/page';
import Hero from './src/components/org-profile/OrgProfileHero';
import Tabs from './src/components/org-profile/OrgProfileTabs';
import Feed from './src/components/org-profile/OrgProfileFeed';
import {profilePageStyle,resolveProfileCover} from './src/lib/org-profile-appearance';
import styles from './src/components/org-profile/OrgProfileAppearance.module.css';
const d=window.fixture;
function App(){return location.pathname.endsWith('/settings') ? <Settings/> : <div className={styles.page} style={profilePageStyle(d.appearance.backgroundColor)}>
<Hero org={d.org} appearance={d.appearance} cover={resolveProfileCover(d.appearance,d.projects)} projectCount={d.projectCount} year={2026} isAdmin={d.role==='ADMIN'||d.role==='OWNER'}/>
<div id="profile-content"><Tabs orgId="firm" activeTab="feed"/><div style={{padding:20}}><Feed orgId="firm" initialFilter={new URLSearchParams(location.search).get('filter')||'all'} initialSort="featured" projectCount={4}/></div></div></div>}
createRoot(document.getElementById('root')).render(<App/>);`;

async function build() {
  await esbuild.build({ stdin: { contents: source, resolveDir: root, loader: 'tsx' }, outfile: path.join(out, 'bundle.js'),
    bundle: true, platform: 'browser', jsx: 'automatic', alias: { '@': path.join(root, 'src') },
    define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' },
    plugins: [{ name: 'framework-fixture', setup(b) {
      b.onResolve({ filter: /^(next-auth\/react|next\/navigation|next\/link|next\/image)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root, contents:
        args.path === 'next-auth/react' ? `const data=window.fixture.role?{user:{id:'admin'}}:null;export const useSession=()=>({data,status:data?'authenticated':'unauthenticated'});` :
        args.path === 'next/navigation' ? `const router={push:u=>location.assign(u),refresh:()=>{}};export const useParams=()=>({orgId:'firm'});export const useRouter=()=>router;export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);` :
        args.path === 'next/link' ? `import React from 'react';export default ({href,children,prefetch,scroll,...props})=><a href={href} {...props}>{children}</a>;` :
        `import React from 'react';export default React.forwardRef(({fill,priority,unoptimized,quality,loader,style,...props},ref)=><img ref={ref} {...props} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',...style}:style}/>);`
      }));
    } }],
  });
  const globals = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  const config = require(path.join(root, 'tailwind.config.js'));
  config.content = [path.join(root, 'src/components/org-profile/**/*.tsx'), path.join(root, 'src/components/feed/**/*.tsx'), path.join(root, 'src/app/org/**/*.tsx')];
  let css = (await postcss([tailwind(config)]).process(globals, { from: path.join(root, 'src/app/globals.css') })).css;
  let headline, body;
  for (const file of fs.readdirSync(path.join(root, '.next/static/css')).filter(file => file.endsWith('.css'))) {
    for (const face of fs.readFileSync(path.join(root, '.next/static/css', file), 'utf8').match(/@font-face\{[^}]+\}/g) || []) {
      if (!/Cormorant_Garamond|Instrument_Sans/.test(face)) continue;
      css += face; const family = face.match(/font-family:([^;]+)/)[1];
      if (/Cormorant_Garamond/.test(face) && !/Fallback/.test(family)) headline = family;
      if (/Instrument_Sans/.test(face) && !/Fallback/.test(family)) body = family;
    }
  }
  assert.ok(headline && body, 'Run typecheck:prepare to build actual Folio fonts first.');
  css += `:root{--font-headline:${headline};--font-body:${body}}body{font-family:var(--font-body)}`;
  fs.writeFileSync(path.join(out, 'globals.css'), css);
  const photo = process.env.ORG_PROFILE_TEST_PHOTO;
  fs.writeFileSync(path.join(out, 'photo.png'), photo ? await sharp(photo).png().toBuffer() : await sharp({ create: { width: 1600, height: 1100, channels: 3, background: '#c7c2b9' } }).png().toBuffer());
}

async function main() {
  await build();
  const json = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://fixture').pathname;
    if (pathname === '/api/orgs/firm/appearance/image') { for await (const chunk of req) {} return json(res, { url: 'https://storage.test/upload.png' }); }
    if (pathname === '/api/orgs/firm/appearance') {
      if (req.method === 'PATCH') {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        if (failSave) return json(res, { error: 'Save failed. Please retry.' }, 503);
        saved = JSON.parse(Buffer.concat(chunks)); saveCount++; return json(res, { appearance: saved });
      }
      return json(res, { org, appearance: saved, projects, projectCount: 4 });
    }
    if (pathname === '/api/orgs/firm') return json(res, { name: org.name, membersCanPublish: true, members: [{ userId: 'admin', role }] });
    if (pathname.startsWith('/api/org/firm/feed')) return json(res, { items: projects.map(project => ({ id: project.id, type: 'project', data: { id: project.id, title: project.title, heroImage: '/photo.png' } })) });
    if (pathname.startsWith('/api/')) return json(res, { members: [], requests: [] });
    if (pathname.endsWith('/settings') || pathname === '/org/firm') {
      res.setHeader('Content-Type', 'text/html'); return res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/bundle.css"></head><body><div id="root"></div><script>window.fixture=${JSON.stringify({ org, appearance: saved, projects, projectCount: 4, role })}</script><script src="/bundle.js"></script></body></html>`);
    }
    const file = /\/media\//.test(pathname) ? path.join(root, '.next/static/media', path.basename(pathname)) : path.join(out, path.basename(pathname));
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.woff2') ? 'font/woff2' : file.endsWith('.png') ? 'image/png' : 'application/javascript');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.ORG_PROFILE_TEST_BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(fs.existsSync) });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.url().startsWith('https://storage.test/')) return request.respond({ contentType: 'image/png', body: fs.readFileSync(path.join(out, 'photo.png')) });
    if (!request.url().startsWith(origin)) return request.abort();
    return request.continue();
  });
  const go = route => page.goto(origin + route, { waitUntil: 'networkidle0' });
  const button = text => page.locator(`::-p-text(${text})`);
  const edit = async (selector, value) => page.$eval(selector, (element, value) => {
    const setter = Object.getOwnPropertyDescriptor(element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set;
    setter.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  try {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewport({ width, height: 1000 }); await go('/org/firm/settings');
      await page.waitForSelector('textarea');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `settings overflow at ${width}`);
      await go('/org/firm'); await page.waitForSelector('a[href="/project/project-0"]');
      assert.equal(await page.$eval('article h3', node => getComputedStyle(node).color), 'rgb(255, 255, 255)', 'mosaic titles stay legible over photographs');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `public overflow at ${width}`);
      assert.deepEqual(await page.$$eval('nav[aria-label="Organization sections"] a', nodes => nodes.map(node => node.textContent)), ['Feed', 'Shop', 'About', 'Contact']);
      await page.screenshot({ path: path.join(out, `profile-${width}.png`), fullPage: true });
    }
    await page.setViewport({ width: 1280, height: 1000 }); await go('/org/firm/settings'); await page.waitForSelector('textarea');
    await edit('input[type=color]', '#112233'); await edit('textarea', 'A considered opening to the studio’s story.');
    await page.select('select', 'project');
    await page.click('button[aria-label="Published project 2, photograph 1"]');
    const selects = await page.$$('select');
    const factSelect = selects[2]; await factSelect.select('completed');
    await edit('input[aria-label="Projects completed value"]', '24');
    assert.equal(await factSelect.evaluate(element => element.disabled), true);
    await page.click('button[aria-label="Move Projects completed earlier"]');
    failSave = true; await button('Save appearance').click(); await page.waitForSelector('[role=alert]');
    assert.equal(saveCount, 0); assert.equal(await page.$eval('textarea', node => node.value), 'A considered opening to the studio’s story.');
    failSave = false; await button('Save appearance').click(); await page.waitForFunction(() => document.body.textContent.includes('Appearance saved.'));
    assert.equal(saved.backgroundColor, '#112233'); assert.equal(saved.cover.imageId, projects[1].images[0].id); assert.equal(saved.facts[2].key, 'completed');
    await go('/org/firm/settings'); assert.equal(await page.$eval('textarea', node => node.value), saved.introduction);
    await page.screenshot({ path: path.join(out, 'settings-desktop.png'), fullPage: true });
    await go('/org/firm'); assert.ok(await page.$eval('h1', node => node.textContent.includes('Fixture Design Studio')));
    assert.equal(await page.$eval('#root > div', node => getComputedStyle(node).backgroundColor), 'rgb(17, 34, 51)');
    await page.screenshot({ path: path.join(out, 'profile-custom.png'), fullPage: true });
    await go('/org/firm/settings'); await page.waitForSelector('textarea');
    const upload = (await page.$$('input[type=file]'))[1]; await upload.uploadFile(path.join(out, 'photo.png'));
    await page.waitForFunction(() => document.body.textContent.includes('Image ready.'));
    await button('Save appearance').click(); await page.waitForFunction(() => document.body.textContent.includes('Appearance saved.'));
    assert.equal(saved.identity.url, 'https://storage.test/upload.png');
    await button('Use site default').click();
    while (await page.$('button[aria-label^="Remove "]')) await page.click('button[aria-label^="Remove "]');
    await page.select('select', 'none'); await button('Save appearance').click(); await page.waitForFunction(() => document.body.textContent.includes('Appearance saved.'));
    assert.equal(saved.backgroundColor, null); assert.deepEqual(saved.facts, []); assert.equal(saved.cover.kind, 'none');
    await go('/org/firm'); assert.equal(await page.$('dl'), null);
    for (const denied of ['MEMBER', 'MANAGER', 'VIEWER', null]) { role = denied; await go('/org/firm/settings'); await page.waitForFunction(() => document.body.textContent.includes('Access Denied')); assert.equal(await page.$('textarea'), null); }
    assert.deepEqual(errors, []);
    console.log('PASS: actual settings/public components at 1440/768/390/320; save/reload, failure retry, crop/photo selection, color contrast/reset, upload, facts/order/empty, actual tabs/mosaic, and lower-role/guest settings denial.');
    console.log(`Screenshots: ${out}`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

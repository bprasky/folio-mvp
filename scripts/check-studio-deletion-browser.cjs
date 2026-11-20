// Actual studio settings/dialog with isolated HTTP fixtures; no real accounts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/studio-deletion-browser');
fs.mkdirSync(out, { recursive: true });
const org = { id: 'firm', name: 'Fixture Design Studio', type: 'DESIGN_FIRM', logo: null, description: null,
  tagline: null, location: 'Miami', foundedYear: null, specialties: [], projectTypes: [], serviceRegions: [], teamSizeRange: null };
const review = { ...org, version: 'a'.repeat(64), counts: { projects: 3, publishedProjects: 2, members: 4, profileItems: 5 }, blockers: [] };
let role = 'ADMIN', reviewError = false, blockers = [], mode = 'error', deletes = [], release, received;
let workspaceError = false, vendorError = false, vendorSaveError = false, noStudios = false, multipleStudios = false;
let vendorEnabled = false, vendorWrites = [], reviewReads = [];
async function build() {
  await esbuild.build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Settings from './src/app/org/[orgId]/settings/page'; import Privacy from './src/app/settings/privacy/page'; import Hub from './src/app/settings/page'; createRoot(document.getElementById('root')).render(location.pathname === '/settings/privacy' ? <Privacy/> : location.pathname === '/settings' ? <Hub/> : <Settings/>);`, resolveDir: root, loader: 'tsx' },
    outfile: path.join(out, 'bundle.js'), bundle: true, platform: 'browser', jsx: 'automatic', alias: { '@': path.join(root, 'src') },
    define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' },
    plugins: [{ name: 'framework-fixture', setup(b) {
      b.onResolve({ filter: /^(next-auth\/react|next\/navigation|next\/link|next\/image)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root, contents:
        args.path === 'next-auth/react' ? `export const useSession=()=>({data:{user:{id:'admin'}},status:'authenticated',update:async()=>{window.updated=(window.updated||0)+1}});` :
        args.path === 'next/navigation' ? `const router={push:u=>{window.destination=u},replace:u=>{window.destination=u},refresh:()=>{}};export const useParams=()=>({orgId:'firm'});export const useRouter=()=>router;export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);` :
        args.path === 'next/link' ? `import React from 'react';export default ({href,children,prefetch,scroll,...props})=><a href={href} {...props}>{children}</a>;` :
        `import React from 'react';export default React.forwardRef(({fill,priority,unoptimized,quality,loader,...props},ref)=><img ref={ref} {...props}/>);`
      }));
    } }],
  });
  const globals = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  const config = { ...require(path.join(root, 'tailwind.config.js')), content: [path.join(root, 'src/components/org-profile/**/*.tsx'), path.join(root, 'src/app/org/**/*.tsx'), path.join(root, 'src/app/settings/**/*.tsx'), path.join(root, 'src/components/ThemeToggle.tsx'), path.join(root, 'src/components/ui/dialog.tsx')] };
  const css = (await postcss([tailwind(config)]).process(globals, { from: path.join(root, 'src/app/globals.css') })).css;
  fs.writeFileSync(path.join(out, 'globals.css'), css + `@font-face{font-family:FixtureHeadline;src:url('/CormorantGaramond.ttf');font-weight:400 600}@font-face{font-family:FixtureHeadline;src:url('/CormorantGaramond-Italic.ttf');font-weight:400 600;font-style:italic}@font-face{font-family:FixtureBody;src:url('/InstrumentSans.ttf');font-weight:400 600}:root{--font-headline:FixtureHeadline;--font-body:FixtureBody}body{font-family:var(--font-body)}`);
}
async function main() {
  await build();
  const json = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://fixture').pathname;
    if (pathname === '/api/orgs/firm/deletion' || pathname === '/api/orgs/second/deletion') {
      if (req.method === 'GET') { reviewReads.push(pathname); return json(res, reviewError ? { error: 'Only an active studio administrator can delete it.' } : { ...review, ...(pathname.includes('/second/') ? { id: 'second', name: 'Second Studio' } : {}), blockers }, reviewError ? 403 : 200); }
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      deletes.push(JSON.parse(Buffer.concat(chunks))); received?.();
      if (mode === 'error') return json(res, { error: 'The studio changed. Review deletion again.' }, 409);
      // Truncated confirmation after commit, without Chromium silently retrying
      // an idempotent DELETE when a socket closes before response headers.
      if (mode === 'lost') { mode = 'success'; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{'); return; }
      if (mode === 'hold') await new Promise(resolve => { release = resolve; });
      return json(res, { deleted: true, orgId: 'firm', replayed: deletes.length > 1 });
    }
    if (pathname === '/api/orgs/firm') return json(res, { ...org, membersCanPublish: true, members: [{ userId: 'admin', role, isActive: true }] });
    if (pathname === '/api/orgs/firm/appearance/portraits') return json(res, { candidates: [] });
    if (pathname === '/api/orgs/firm/appearance') return json(res, { org, appearance: { version: 1, backgroundColor: null, introduction: null, cover: { kind: 'auto' }, coverPosition: { x: 50, y: 50 }, identity: { mode: 'logo', url: null }, facts: null }, projects: [], projectCount: 0 });
    if (pathname === '/api/user/workspace-context') return json(res, workspaceError ? { error: 'Unavailable' } : { operatingAsOrgId: 'firm', organizations: noStudios ? [] : [{ ...org, userRole: role }, ...(multipleStudios ? [{ ...org, id: 'second', name: 'Second Studio', userRole: 'OWNER' }, { ...org, id: 'vendor', name: 'Vendor', type: 'VENDOR', userRole: 'OWNER' }] : [])] }, workspaceError ? 500 : 200);
    if (pathname === '/api/designer/settings/vendor-visibility') {
      if (req.method === 'PATCH') {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const data = JSON.parse(Buffer.concat(chunks)); vendorWrites.push(data);
        if (vendorSaveError) return json(res, { error: 'Unavailable' }, 500);
        vendorEnabled = data.enabled;
      }
      return json(res, { enabled: vendorEnabled, enabledAt: vendorEnabled ? '2026-11-20T12:00:00Z' : null }, vendorError ? 500 : 200);
    }
    if (pathname.startsWith('/api/')) return json(res, { members: [], requests: [] });
    if (['/org/firm/settings', '/settings', '/settings/privacy'].includes(pathname)) {
      res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/bundle.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
    }
    const file = ['CormorantGaramond.ttf', 'CormorantGaramond-Italic.ttf', 'InstrumentSans.ttf'].includes(path.basename(pathname)) ? path.join(root, 'public/fonts/publication', path.basename(pathname)) : path.join(out, path.basename(pathname));
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.ttf') ? 'font/ttf' : 'application/javascript'); fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser, page;
  const errors = [];
  try {
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.STUDIO_DELETE_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(fs.existsSync), args: ['--no-sandbox'] });
    page = await browser.newPage();
    const origin = `http://127.0.0.1:${server.address().port}`;
    page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
    await page.setRequestInterception(true);
    page.on('request', req => req.url().startsWith(origin) ? req.continue() : req.abort());
    const go = () => page.goto(origin + '/org/firm/settings', { waitUntil: 'networkidle0' });
    const button = text => page.locator(`::-p-aria([name="${text}"][role="button"])`);
    const open = async () => { await button('Review studio deletion').click(); await page.waitForSelector('#studio-delete-name'); };
    const enterName = value => page.$eval('#studio-delete-name', (node, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    const fill = async () => { await enterName(org.name); await page.click('[role=dialog] input[type=checkbox]'); await page.waitForFunction(() => [...document.querySelectorAll('[role=dialog] button')].some(b => b.textContent === 'Permanently delete studio' && !b.disabled)); };
    const close = async () => {
      // Focus can arrive before Radix registers its dismissable layer. Its
      // explicit pointer-events restoration marks the interactive modal layer;
      // wait for both before testing Escape (including the vendor dialog).
      await page.waitForFunction(() => {
        const dialog = document.querySelector('[role=dialog]');
        return dialog?.contains(document.activeElement) && dialog.style.pointerEvents === 'auto';
      });
      await page.keyboard.press('Escape'); await page.waitForSelector('[role=dialog]', { hidden: true });
    };
    for (const denied of ['MANAGER', 'MEMBER', 'VIEWER']) {
      role = denied; await go(); assert.equal(await page.$('#studio-deletion-title'), null, `${denied} must not see deletion controls`);
    }
    role = 'ADMIN';
    for (const width of [1280, 390, 320]) for (const theme of ['light', 'dark']) {
      await page.setViewport({ width, height: 900 }); await go();
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; document.documentElement.classList.toggle('dark', theme === 'dark'); }, theme);
      await open();
      assert.equal(await page.$eval('[role=dialog]', node => getComputedStyle(node).backgroundColor), theme === 'dark' ? 'rgb(27, 27, 25)' : 'rgb(255, 255, 255)');
      assert.deepEqual(await page.$$eval('[role=dialog] dd', nodes => nodes.map(n => n.textContent)), ['3', '2', '4', '5']);
      assert.equal(await page.$eval('[role=dialog]', node => node.scrollWidth <= node.clientWidth + 1), true, `dialog overflow ${width}/${theme}`);
      await enterName('Wrong studio'); await page.click('[role=dialog] input[type=checkbox]');
      assert.equal(await page.$$eval('[role=dialog] button', nodes => nodes.find(n => n.textContent === 'Permanently delete studio').disabled), true);
      await enterName(org.name);
      await page.waitForFunction(() => [...document.querySelectorAll('[role=dialog] button')].some(b => b.textContent === 'Permanently delete studio' && !b.disabled));
      const colors = await page.$$eval('[role=dialog] button', nodes => { const s = getComputedStyle(nodes.find(n => n.textContent === 'Permanently delete studio')); return [s.color, s.backgroundColor]; });
      assert.notEqual(colors[0], colors[1]);
      await page.screenshot({ path: path.join(out, `confirm-${width}-${theme}.png`), fullPage: false });
      await close();
      assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Review studio deletion');
    }
    assert.equal(deletes.length, 0, 'review/cancel never deletes');
    blockers = ['A website or project import is still running.'];
    await button('Review studio deletion').click(); await page.waitForSelector('[role=alert]');
    assert.equal(await page.$('#studio-delete-name'), null); await close(); blockers = [];
    reviewError = true;
    await button('Review studio deletion').click(); await page.waitForSelector('[role=alert]');
    assert.equal(await page.$('#studio-delete-name'), null); await close(); reviewError = false;
    await open(); await fill(); await button('Permanently delete studio').click(); await page.waitForSelector('[role=alert]');
    assert.equal(await page.$eval('#studio-delete-name', node => node.value), org.name);
    assert.equal(await page.evaluate(() => window.destination), undefined);
    await button('Review again').click(); await page.waitForSelector('#studio-delete-name');
    assert.equal(await page.$eval('#studio-delete-name', node => node.value), '');
    assert.equal(await page.$eval('[role=dialog] input[type=checkbox]', node => node.checked), false);
    await close();
    deletes = []; mode = 'hold'; await open(); await fill();
    const arrival = new Promise(resolve => { received = resolve; });
    await button('Permanently delete studio').click(); await arrival;
    await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].forEach(b => b.click()));
    await page.keyboard.press('Escape'); assert.ok(await page.$('[role=dialog]')); assert.equal(deletes.length, 1);
    release(); await page.waitForFunction(() => window.destination === '/settings');
    assert.equal(await page.evaluate(() => window.updated), 1);
    deletes = []; mode = 'lost'; received = null; await go(); await open(); await fill();
    await button('Permanently delete studio').click(); await page.waitForSelector('[role=alert]');
    await button('Retry deletion').click(); await page.waitForFunction(() => window.destination === '/settings');
    assert.equal(deletes.length, 2); assert.deepEqual(deletes[0], deletes[1], 'lost-response retries keep the same reviewed confirmation');
    // Exercise the entry advertised by the Settings hub, including ownership of
    // a different studio than the current operating context. All records are fixtures.
    const privacy = () => page.goto(origin + '/settings/privacy', { waitUntil: 'networkidle0' });
    deletes = []; role = 'OWNER';
    await page.goto(origin + '/settings', { waitUntil: 'networkidle0' });
    assert.match(await page.$eval('a[href="/settings/privacy"]', n => n.textContent), /studio deletion/);
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('a[href="/settings/privacy"]')]);
    await open(); assert.equal(reviewReads.at(-1), '/api/orgs/firm/deletion'); await close();
    for (const width of [1280, 390, 320]) for (const theme of ['light', 'dark']) {
      await page.setViewport({ width, height: 1000 }); await privacy();
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; document.documentElement.classList.toggle('dark', theme === 'dark'); }, theme);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(expected => getComputedStyle(document.querySelector('[role=switch] > span')).backgroundColor === expected, {}, theme === 'dark' ? 'rgb(34, 34, 31)' : 'rgb(250, 248, 245)');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `privacy overflow ${width}/${theme}`);
      assert.equal(await page.$eval('h1', n => getComputedStyle(n).fontFamily), 'FixtureHeadline');
      const toggleColors = await page.$eval('[role=switch] > span', n => [getComputedStyle(n).backgroundColor, getComputedStyle(n.firstChild).backgroundColor]);
      assert.notEqual(toggleColors[0], toggleColors[1], 'off switch must remain visible');
      await page.screenshot({ path: path.join(out, `privacy-${width}-${theme}.png`), fullPage: true });
      await page.click('[role=switch]'); await page.waitForSelector('[role=dialog]');
      assert.equal(await page.$eval('[role=dialog]', n => n.scrollWidth <= n.clientWidth + 1), true);
      assert.equal(await page.$eval('[role=dialog]', n => getComputedStyle(n).backgroundColor), theme === 'dark' ? 'rgb(27, 27, 25)' : 'rgb(255, 255, 255)');
      await close();
      await open(); await close();
    }
    assert.equal(deletes.length, 0); assert.equal(vendorWrites.length, 0, 'reviewing preferences must not opt in');
    for (const denied of ['MANAGER', 'MEMBER', 'VIEWER']) {
      role = denied; await privacy();
      assert.equal(await page.$('#studio-deletion-title'), null);
      assert.match(await page.$eval('[aria-labelledby=studio-account-title]', n => n.textContent), /Only an active Owner or Admin/);
    }
    role = 'ADMIN'; await privacy(); await open(); await close();
    role = 'MANAGER'; multipleStudios = true; await privacy();
    assert.equal(await page.$$eval('#privacy-studio option', ns => ns.length), 2, 'vendor organizations are not studio deletion targets');
    await page.select('#privacy-studio', 'second'); await open();
    assert.equal(reviewReads.at(-1), '/api/orgs/second/deletion');
    assert.match(await page.$eval('[role=dialog]', n => n.textContent), /You are deleting Second Studio/); await close();
    await page.select('#privacy-studio', 'firm'); assert.equal(await page.$('#studio-deletion-title'), null);
    multipleStudios = false; role = 'OWNER'; vendorError = true; await privacy(); await open(); await close(); vendorError = false;
    workspaceError = true; await privacy(); assert.equal(await page.$('#studio-deletion-title'), null);
    assert.ok(await page.$('[role=switch]'), 'studio load failure must not hide vendor preferences');
    workspaceError = false; await button('Try loading studios again').click(); await page.waitForSelector('#studio-deletion-title');
    noStudios = true; await privacy(); assert.match(await page.$eval('[aria-labelledby=studio-account-title]', n => n.textContent), /currently belong/); noStudios = false;
    await privacy(); await page.click('[role=switch]'); await page.waitForSelector('[role=dialog]');
    vendorSaveError = true; await button('Enable visibility').click(); await page.waitForSelector('[role=dialog] [role=alert]');
    assert.equal(vendorEnabled, false); vendorSaveError = false;
    await button('Enable visibility').click(); await page.waitForSelector('[role=dialog]', { hidden: true });
    assert.equal(vendorEnabled, true);
    await page.click('[role=switch]'); await page.waitForFunction(() => document.querySelector('[role=switch]').getAttribute('aria-checked') === 'false');
    assert.equal(vendorEnabled, false);
    assert.deepEqual(vendorWrites, [{ enabled: true }, { enabled: true }, { enabled: false }]);
    assert.equal(deletes.length, 0, 'Privacy navigation, switching studios and preference changes never delete');
    assert.deepEqual(errors, []);
    console.log('PASS Privacy: hub navigation, owner/admin review, denied roles, multi-studio target selection, independent failures/retry, empty membership, vendor opt-in/cancel/save recovery; 1280/390/320 light and dark.');
    console.log('PASS studio deletion: settings role visibility, counts, exact confirmation, cancel/focus, blockers/403, stale review reset, busy/double-click guard, lost-response replay; 1280/390/320 light and dark.');
  } catch (error) {
    console.error('Browser errors:', errors);
    if (page) { console.error((await page.evaluate(() => document.body.innerText)).slice(0, 1800)); await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }); }
    throw error;
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

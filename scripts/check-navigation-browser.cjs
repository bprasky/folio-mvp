// Actual navigation components, Folio CSS/fonts, synthetic accounts and API replies.
// No accounts, firms, or production data are created. No new test runner is required.
// NAVIGATION_TEST_REVISION=HEAD bundles tracked source from that revision for regression proof.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const puppeteer = require('puppeteer-core');

const root = path.resolve(__dirname, '..');
const revision = process.env.NAVIGATION_TEST_REVISION;
const assets = process.env.NAVIGATION_TEST_ASSETS || path.dirname(fs.realpathSync(path.join(root, 'node_modules')));
const out = path.join(root, '.tmp/navigation-browser', revision ? 'baseline' : 'current');
fs.mkdirSync(out, { recursive: true });

const fixtureSource = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {EditorialMasthead} from './src/components/navigation/EditorialMasthead';
import {Topbar} from './src/app/auth/_components/Topbar';
createRoot(document.getElementById('root')).render(<>
  {location.pathname === '/auth/signup'
    ? <div className="auth-shell"><Topbar rightCta={{label:'Sign in',href:'/auth/signin?callbackUrl=%2Fprojects%2Fnew'}}/></div>
    : <EditorialMasthead/>}
  <main style={{padding:24,minHeight:1600}}>Navigation verification fixture</main>
</>);`;

const authSource = `
import {useSyncExternalStore,useMemo} from 'react';
const read=()=>sessionStorage.getItem('fixture-session')||'{}';
const subscribe=fn=>{window.addEventListener('authchange',fn);return()=>window.removeEventListener('authchange',fn)};
export const useSession=()=>{const raw=useSyncExternalStore(subscribe,read,read);const state=useMemo(()=>JSON.parse(raw),[raw]);return {status:state.status||(state.user?'authenticated':'unauthenticated'),data:state.user?{user:state.user}:null,update:async()=>state.user?{user:state.user}:null}};
export const signOut=async()=>{sessionStorage.removeItem('fixture-session');window.dispatchEvent(new Event('authchange'));};`;

async function build() {
  await esbuild.build({
    stdin: { contents: fixtureSource, resolveDir: root, loader: 'tsx' },
    outfile: path.join(out, 'bundle.js'), bundle: true, platform: 'browser', jsx: 'automatic',
    alias: { '@': path.join(root, 'src') },
    define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' },
    plugins: [{ name: 'navigation-fixture', setup(b) {
      b.onResolve({ filter: /^(next-auth\/react|next\/navigation)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root, contents: args.path === 'next-auth/react' ? authSource :
        `export const usePathname=()=>location.pathname;export const useRouter=()=>({push:url=>location.assign(url),replace:url=>location.replace(url),refresh:()=>{}});export const useSearchParams=()=>new URLSearchParams(location.search);` }));
      b.onResolve({ filter: /(^|\/)(SupportModal)$/ }, args => ({ path: args.path, namespace: 'modal' }));
      b.onLoad({ filter: /.*/, namespace: 'modal' }, () => ({ contents: 'export const CreateCollaborationModal=()=>null;export default ()=>null;' }));
      if (revision) b.onLoad({ filter: /\.(tsx?|css)$/ }, args => {
        const relative = path.relative(root, args.path).replace(/\\/g, '/');
        if (!relative.startsWith('src/')) return;
        return { contents: execFileSync('git', ['show', `${revision}:${relative}`], { cwd: root, encoding: 'utf8' }), loader: path.extname(args.path).slice(1) };
      });
    } }],
  });
  const globals = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  const config = require(path.join(root, 'tailwind.config.js'));
  config.content = [path.join(root, 'src/components/navigation/**/*.tsx'), path.join(root, 'src/components/badge/**/*.tsx'), path.join(root, 'src/components/collaboration/**/*.tsx'), path.join(root, 'src/components/ui/**/*.tsx'), path.join(root, 'src/app/auth/**/*.tsx')];
  let css = (await postcss([tailwind(config)]).process(globals, { from: path.join(root, 'src/app/globals.css') })).css;
  let faces = '', heading, body;
  for (const file of fs.readdirSync(path.join(assets, '.next/static/css')).filter(file => file.endsWith('.css'))) {
    for (const face of fs.readFileSync(path.join(assets, '.next/static/css', file), 'utf8').match(/@font-face\{[^}]+\}/g) || []) {
      if (!/Cormorant_Garamond|Instrument_Sans/.test(face)) continue;
      faces += face;
      const family = face.match(/font-family:([^;]+)/)[1];
      if (/Cormorant_Garamond/.test(face) && !/Fallback/.test(family)) heading = family;
      if (/Instrument_Sans/.test(face) && !/Fallback/.test(family)) body = family;
    }
  }
  assert.ok(heading && body, 'Cache Folio fonts in a Next build, or set NAVIGATION_TEST_ASSETS to an existing build root.');
  css += faces + `\n:root{--font-headline:${heading};--font-body:${body}}`;
  fs.writeFileSync(path.join(out, 'globals.css'), css);
}

const person = { id: 'person', name: 'Individual Reader', email: 'reader@example.test', role: 'INDIVIDUAL', operatingAsOrgId: null };
const firm = { id: 'firm', name: 'Fixture Studio', type: 'DESIGN_FIRM', logo: null, userRole: 'OWNER' };
const workspace = (user = person, organizations = [], operatingAsOrgId = null) => ({
  user, organizations, operatingAsOrgId,
  operatingAsOrg: organizations.find(org => org.id === operatingAsOrgId) || null,
});

async function main() {
  await build();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/bundle.css"><title>Navigation verification</title></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://fixture').pathname;
    if (!pathname.includes('.')) { res.setHeader('Content-Type', 'text/html'); return res.end(html); }
    const file = /\/(?:static\/)?media\//.test(pathname) ? path.join(assets, '.next/static/media', path.basename(pathname)) : path.join(out, path.basename(pathname));
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.woff2') ? 'font/woff2' : 'application/javascript');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const executablePath = process.env.NAVIGATION_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(fs.existsSync);
  assert.ok(executablePath, 'Set NAVIGATION_TEST_BROWSER to an installed Chromium browser.');
  const browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const errors = [], results = [], held = [];
  let scenario = { workspace: workspace() }, workspaceRequests = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', async request => {
    if (request.isInterceptResolutionHandled()) return;
    const url = new URL(request.url());
    if (url.origin !== origin) return request.abort();
    const json = (data, status = 200) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname === '/api/user/workspace-context') {
      workspaceRequests += 1;
      const reply = { ...scenario };
      if (reply.hold) { held.push({ request, reply }); return; }
      return json(reply.workspace || { error: 'Could not load firms' }, reply.error ? 503 : 200);
    }
    if (url.pathname.startsWith('/api/')) return json({ items: [], unreadCount: 0 });
    return request.continue();
  });
  const go = route => page.goto(origin + route, { waitUntil: 'networkidle0' });
  const configure = async (user = null, data = workspace(user || person), extra = {}) => {
    scenario = { workspace: data, ...extra };
    await page.evaluate(state => sessionStorage.setItem('fixture-session', JSON.stringify(state)), { user, status: extra.loading ? 'loading' : user ? 'authenticated' : 'unauthenticated' });
    await go('/');
  };
  const visibleText = async () => page.evaluate(() => [...document.querySelectorAll('header a,header button')].filter(el => el.getClientRects().length).map(el => el.textContent.replace(/\s+/g, ' ').trim()));
  const hasCreate = async () => (await visibleText()).some(text => /^(Create|Create Project|Collaboration Story|Add Product|Project Handoff)$/.test(text));
  const mobileToggle = async () => page.click('button[aria-label="Toggle menu"]');
  const accountToggle = async () => page.click('button[aria-label="User menu"]');
  const assertNoCreate = async label => assert.equal(await hasCreate(), false, label);
  const flushHeld = async () => {
    for (const { request, reply } of held.splice(0)) {
      try { await request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(reply.workspace) }); } catch { /* Request may have been aborted on account change. */ }
    }
  };
  try {
    await go('/');
    await page.setViewport({ width: 1440, height: 900 });
    await configure();
    await assertNoCreate('Signed-out visitors must not see Create.');
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewport({ width, height: 900 });
      await go('/');
      await page.evaluate(() => document.fonts.ready);
      const layout = await page.evaluate(() => {
        const visible = el => el.getClientRects().length > 0;
        const brand = document.querySelector('[data-folio-brand-target]');
        const rect = brand.getBoundingClientRect();
        const controls = [...document.querySelectorAll('header a,header button,header input')].filter(visible);
        const overlapping = controls.filter(el => el !== brand && !el.contains(brand) && !brand.contains(el)).map(el => ({ label: el.getAttribute('aria-label') || el.textContent.trim(), rect: el.getBoundingClientRect() })).filter(({ rect: other }) => other.left < rect.right && other.right > rect.left && other.top < rect.bottom && other.bottom > rect.top).map(el => el.label);
        const accounts = controls.filter(el => el.textContent.trim() === 'Log in');
        const search = controls.find(el => el.tagName === 'INPUT' || /Search/.test(el.getAttribute('aria-label') || ''));
        return { center: rect.left + rect.width / 2, viewport: innerWidth, overflow: document.documentElement.scrollWidth, href: brand.getAttribute('href'), overlapping, accounts: accounts.length, searchBeforeAccount: !!search && !!accounts[0] && search.getBoundingClientRect().right <= accounts[0].getBoundingClientRect().left + 1 };
      });
      assert.equal(layout.href, '/');
      assert.ok(Math.abs(layout.center - width / 2) <= 1, `FOLIO must remain centered: ${JSON.stringify(layout)}`);
      assert.ok(layout.overflow <= width, `No horizontal overflow: ${JSON.stringify(layout)}`);
      assert.deepEqual(layout.overlapping, [], `Controls must not overlap FOLIO at ${width}px`);
      assert.equal(layout.accounts, 1, 'One Log in action for account access.');
      assert.equal(layout.searchBeforeAccount, true, 'Search immediately precedes account action.');
      assert.ok(!(await visibleText()).some(text => /^(Magazine|For Professionals)$/i.test(text)));
      await page.screenshot({ path: path.join(out, `anonymous-${width}.png`) });
      if (width < 768) { await mobileToggle(); await assertNoCreate('Signed-out mobile menu must not offer Create.'); assert.ok(!(await visibleText()).some(text => /^(Magazine|For Professionals)$/i.test(text))); }
      results.push(`anonymous navigation layout ${width}px`);
    }

    // The visible bar compacts without shifting the document underneath it.
    for (const width of [390, 1440]) {
      await page.setViewport({ width, height: 900 }); await go('/');
      const resting = await page.evaluate(() => {
        const header = document.querySelector('header');
        return { logo: parseFloat(getComputedStyle(document.querySelector('[data-folio-brand-target]')).fontSize), contentTop: document.querySelector('main').getBoundingClientRect().top + scrollY, tint: getComputedStyle(header.firstElementChild, '::before').opacity, border: getComputedStyle(header).borderBottomWidth };
      });
      assert.equal(resting.logo, width < 768 ? 33 : 46);
      assert.equal(resting.tint, '0', 'Header is transparent at the top.');
      assert.equal(resting.border, '0px', 'Header has no divider line.');
      await page.evaluate(() => scrollTo(0, 160));
      await page.waitForFunction(expected => parseFloat(getComputedStyle(document.querySelector('[data-folio-brand-target]')).fontSize) === expected, {}, width < 768 ? 25 : 30);
      const compact = await page.evaluate(() => ({ contentTop: document.querySelector('main').getBoundingClientRect().top + scrollY, tint: getComputedStyle(document.querySelector('header').firstElementChild, '::before').opacity }));
      assert.equal(compact.contentTop, resting.contentTop, 'Shrinking the logo cannot move page content.');
      assert.equal(compact.tint, '1');
      await page.screenshot({ path: path.join(out, `scrolled-${width}.png`) });
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForFunction(expected => parseFloat(getComputedStyle(document.querySelector('[data-folio-brand-target]')).fontSize) === expected, {}, resting.logo);
      results.push(`transparent masthead and stable scroll compaction ${width}px`);
    }

    await page.setViewport({ width: 1440, height: 900 });
    for (const [label, user, data] of [
      ['individual after skipping setup', person, workspace()],
      ['professional role without membership', { ...person, role: 'DESIGNER' }, workspace()],
      ['pending firm request', person, workspace()],
      ['revoked firm with stale session', { ...person, role: 'DESIGNER', operatingAsOrgId: 'revoked', operatingAsOrg: firm }, workspace()],
    ]) {
      await configure(user, data);
      await assertNoCreate(label);
      await page.click('[aria-label="User menu"]');
      const upgrade = await page.$eval('a[href="/professionals"]', el => el.textContent.trim());
      assert.equal(upgrade, 'Go Professional');
      await page.setViewport({ width: 390, height: 844 });
      await go('/'); await accountToggle(); await assertNoCreate(`${label} on mobile`);
      assert.equal(await page.$eval('a[href="/professionals"]', el => el.getClientRects().length > 0), true);
      await page.setViewport({ width: 1440, height: 900 });
      results.push(label);
    }
    const member = { ...person, operatingAsOrgId: firm.id, operatingAsOrg: firm };
    await configure(member, workspace(member, [firm], firm.id), { loading: true });
    await assertNoCreate('Authentication loading must not grant Create.');
    await configure(member, null, { error: true });
    await assertNoCreate('Membership fetch errors must fail closed.');
    results.push('loading and request failure fail closed');

    for (const personal of [false, true]) {
      const user = personal ? person : member;
      await configure(user, workspace(user, [firm], personal ? null : firm.id));
      assert.equal(await hasCreate(), true, 'Active members can Create.');
      const createHref = await page.$$eval('header a', links => links.find(el => el.textContent.trim() === 'Create')?.getAttribute('href'));
      assert.equal(createHref, personal ? '/auth/org-setup?type=designer&callbackUrl=%2Fprojects%2Fnew' : '/projects/new');
      await page.click('[aria-label="User menu"]');
      assert.equal(await page.$('a[href="/professionals"]'), null, 'Active members do not see Go Professional.');
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewport({ width, height: 900 }); await go('/');
        const overlap = await page.evaluate(() => {
          const brand = document.querySelector('[data-folio-brand-target]'); const r = brand.getBoundingClientRect();
          return { center: r.left + r.width / 2, overflow: document.documentElement.scrollWidth, labels: [...document.querySelectorAll('header a,header button,header input')].filter(el => el !== brand && el.getClientRects().length).filter(el => { const o = el.getBoundingClientRect(); return o.left < r.right && o.right > r.left && o.top < r.bottom && o.bottom > r.top; }).map(el => el.getAttribute('aria-label') || el.textContent.trim()) };
        });
        assert.ok(Math.abs(overlap.center - width / 2) <= 1, JSON.stringify(overlap));
        assert.ok(overlap.overflow <= width, JSON.stringify(overlap));
        assert.deepEqual(overlap.labels, [], `Authenticated controls must not overlap logo at ${width}px`);
        assert.equal(await page.$eval('button[aria-label="Notifications"]', el => el.getClientRects().length > 0), true, 'Notifications remain visible in the header.');
        await accountToggle();
        assert.equal((await page.$$('button[aria-label="Notifications"]')).length, 1, `Only one notification bell is mounted at ${width}px`);
        assert.equal(await page.$eval('a[href="/inbox"]', el => el.getClientRects().length > 0), true);
        assert.equal(await page.$eval('[aria-label="Open my Folio Badge"]', el => el.getClientRects().length > 0), true);
        await page.click('button[aria-label="Notifications"]');
        const notificationBounds = await page.$eval('[role="dialog"][aria-label="Notifications"]', panel => {
          const r = panel.getBoundingClientRect(); return { left: r.left, right: r.right };
        });
        assert.ok(notificationBounds.left >= 0 && notificationBounds.right <= width, `Notification popup remains in the viewport: ${JSON.stringify(notificationBounds)}`);
        await page.click('button[aria-label="Notifications"]');
        await page.screenshot({ path: path.join(out, `${personal ? 'personal-workspace' : 'firm-member'}-${width}.png`) });
        if (width < 768) assert.equal(await hasCreate(), true, 'Active member account menu must offer Create on mobile.');
        await page.keyboard.press('Escape');
        assert.equal(await page.$eval('[aria-label="Account menu"]', el => el.hidden), true);
        assert.equal(await page.$eval('[aria-label="User menu"]', el => el === document.activeElement), true, 'Escape returns focus to account control.');
      }
      results.push(personal ? 'member using personal workspace reaches chooser' : 'active firm member reaches upload');
    }
    await page.setViewport({ width: 1440, height: 900 });
    const vendorFirm = { ...firm, type: 'VENDOR' };
    const vendor = { ...member, role: 'VENDOR', operatingAsOrg: vendorFirm };
    await configure(vendor, workspace(vendor, [vendorFirm], firm.id));
    await page.setViewport({ width: 768, height: 900 });
    await page.click('[aria-label="Create menu"]');
    assert.equal(await page.$eval('a[href="/vendor/products/new"]', el => el.getClientRects().length > 0), true);
    const createBounds = await page.$eval('[aria-label="Create menu"]', button => {
      const r = button.nextElementSibling.getBoundingClientRect(); return { left: r.left, right: r.right };
    });
    assert.ok(createBounds.left >= 0 && createBounds.right <= 768, `Vendor Create popup remains in the viewport: ${JSON.stringify(createBounds)}`);
    await page.screenshot({ path: path.join(out, 'vendor-create-768.png') });
    await page.keyboard.press('Escape');
    await page.setViewport({ width: 390, height: 844 });
    await go('/'); await accountToggle();
    await page.$$eval('[aria-label="Account menu"] button', buttons => buttons.find(button => button.textContent.trim() === 'Collaboration Story').click());
    await page.waitForSelector('[role="dialog"]', { visible: true });
    assert.match(await page.$eval('[role="dialog"]', el => el.textContent), /New Collaboration Story/);
    assert.equal(await page.$eval('[aria-label="Account menu"]', el => el.hidden), true, 'Mobile Create dialog survives closing the account menu.');
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role="dialog"]', { hidden: true });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'User menu');
    await accountToggle();
    await page.click('[aria-label="Open my Folio Badge"]');
    await page.waitForSelector('[role="dialog"]', { visible: true });
    assert.equal(await page.$eval('[aria-label="Account menu"]', el => el.hidden), true, 'Badge dialog survives closing the account menu.');
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role="dialog"]', { hidden: true });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'User menu');
    await page.setViewport({ width: 1440, height: 900 });
    results.push('vendor member retains product and collaboration actions');
    results.push('mobile collaboration and badge dialogs remain usable outside account dropdown');

    // Hold the first account's request, change account, then release the obsolete response.
    const previousPerson = { ...member, id: 'previous-person' };
    scenario = { workspace: workspace(previousPerson, [firm], firm.id), hold: true };
    const before = workspaceRequests;
    const firstLookup = page.waitForRequest(request => new URL(request.url()).pathname === '/api/user/workspace-context');
    await page.evaluate(user => { sessionStorage.setItem('fixture-session', JSON.stringify({ user })); window.dispatchEvent(new Event('authchange')); }, previousPerson);
    await firstLookup;
    await page.waitForFunction(() => document.querySelector('[aria-label="User menu"]'));
    assert.ok(workspaceRequests > before, 'First account starts its own lookup.');
    await assertNoCreate('Pending new account lookup must not reuse prior membership.');
    const nextPerson = { ...person, id: 'next-person' };
    scenario = { workspace: workspace(nextPerson) };
    await page.evaluate(user => { sessionStorage.setItem('fixture-session', JSON.stringify({ user })); window.dispatchEvent(new Event('authchange')); }, nextPerson);
    await page.waitForNetworkIdle({ idleTime: 100 });
    await flushHeld();
    await page.waitForNetworkIdle({ idleTime: 100 });
    await assertNoCreate('Obsolete membership response cannot grant access to the new account.');
    await page.click('[aria-label="User menu"]');
    assert.equal(await page.$eval('a[href="/professionals"]', el => el.textContent.trim()), 'Go Professional');
    results.push('account switch and obsolete request cannot reuse membership');

    await configure();
    await page.type('header input', 'interior design');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.keyboard.press('Enter')]);
    assert.equal(new URL(page.url()).pathname, '/search');
    assert.equal(new URL(page.url()).searchParams.get('q'), 'interior design');
    results.push('search submits the entered query');
    await go('/auth/signup');
    assert.ok(!(await visibleText()).some(text => /^(Magazine|For Professionals)$/i.test(text)));
    const authHref = await page.$$eval('header a', links => links.find(el => el.textContent.trim() === 'Log in')?.getAttribute('href'));
    assert.equal(authHref, '/auth/signin?callbackUrl=%2Fprojects%2Fnew');
    results.push('auth topbar shares navigation and preserves destination');
    assert.deepEqual(errors, [], 'No browser runtime errors.');
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ fixture: 'Real navigation and auth Topbar; synthetic auth/workspace API; cached Folio fonts; external requests blocked. No real onboarding or authorization mutations tested.', revision: revision || 'working tree', results, errors }, null, 2));
    console.log(JSON.stringify({ results, errors, screenshots: out }, null, 2));
  } finally {
    await flushHeld();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

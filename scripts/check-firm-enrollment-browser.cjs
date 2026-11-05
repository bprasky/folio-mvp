// Real firm-enrollment component with synthetic search/mutation/session boundaries.
// No production APIs, accounts, memberships or email. This checks behavior, not styling.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');

async function main() {
  const root = process.cwd();
  const bundle = await esbuild.build({
    stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {ScenarioA} from './src/app/auth/org-setup/_ScenarioA';createRoot(document.getElementById('root')).render(<ScenarioA initialIntent="designer" callbackUrl="/onboarding/workspace"/>);`, loader: 'tsx', resolveDir: root },
    bundle: true, write: false, platform: 'browser', jsx: 'automatic',
    alias: { '@': path.join(root, 'src') },
    plugins: [{ name: 'isolate-next-boundaries', setup(build) {
      build.onResolve({ filter: /^(next-auth\/react|next\/navigation|next\/link)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root, contents: args.path === 'next-auth/react'
        ? `export const useSession=()=>({update:async()=>{}});`
        : args.path === 'next/navigation' ? `export const useRouter=()=>({push(){},replace(){},refresh(){}});`
        : `import React from 'react';export default function Link(props){return <a {...props}/>;}` }));
    } }],
  });
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', req.url === '/bundle.js' ? 'application/javascript' : 'text/html');
    res.end(req.url === '/bundle.js' ? bundle.outputFiles[0].contents : '<div id="root"></div><script src="/bundle.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const executablePath = process.env.GUIDED_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(fs.existsSync);
  assert.ok(executablePath, 'Set GUIDED_TEST_BROWSER to an installed Chromium browser.');
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  await page.setRequestInterception(true);
  let results = [], lastMutation = null;
  const existing = (name, index) => ({ id: 'firm-' + index, name, type: 'DESIGN_FIRM', location: null });
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/api/onboarding/firm/search') return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ results }) });
    if (request.method() === 'POST' && (url.pathname === '/api/auth/org-setup' || /^\/api\/orgs\/[^/]+\/join$/.test(url.pathname))) {
      lastMutation = { path: url.pathname, body: JSON.parse(request.postData()) };
      return request.respond({ status: 201, contentType: 'application/json', body: JSON.stringify({ org: { id: 'new-firm', type: 'DESIGN_FIRM' }, notifications: { inApp: true, email: 'accepted' } }) });
    }
    if (url.origin === `http://127.0.0.1:${server.address().port}`) return request.continue();
    return request.abort();
  });
  const cases = [];
  const open = async (names, typed = 'North') => {
    results = names.map(existing); lastMutation = null;
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle0' });
    await page.type('#firm-name', typed);
    await page.waitForFunction(() => !document.querySelector('#firm-search-status').textContent.includes('Searching') && document.querySelector('#firm-search-status').textContent.length > 0);
  };
  try {
    for (const [label, names] of [['one partial match', ['North Studio']], ['several partial matches', ['North Studio', 'North Interiors']], ['exact match', ['North']], ['ambiguous exact matches', ['North', ' NORTH ']]]) {
      await open(names);
      cases.push({ case: label, typed: 'North', results: names, status: await page.$eval('#firm-search-status', el => el.textContent), button: await page.$eval('button[type=submit]', el => ({ text: el.textContent, disabled: el.disabled })), canConfirmNewFirm: !!await page.$('input[type=checkbox]') });
    }
    assert.equal(cases[0].canConfirmNewFirm, true, 'A distinct full firm name must remain creatable when one substring match exists.');
    assert.equal(cases[1].canConfirmNewFirm, true, 'A distinct full firm name must remain creatable when several substring matches exist.');
    assert.equal(cases[2].canConfirmNewFirm, false, 'An exact normalized duplicate must not offer creation.');
    assert.equal(cases[3].canConfirmNewFirm, false, 'Multiple exact matches must never offer duplicate creation.');
    assert.deepEqual(cases[3].button, { text: 'Select your firm', disabled: true }, 'Multiple exact matches require an intentional selection.');
    await page.click('#firm-option-firm-1');
    await page.click('button[type=submit]');
    await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Request sent');
    assert.equal(lastMutation.path, '/api/orgs/firm-1/join', 'The selected exact-match identity is preserved.');

    await open(['North Studio']);
    await page.click('input[type=checkbox]');
    await page.click('button[type=submit]');
    await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled);
    assert.deepEqual(lastMutation, { path: '/api/auth/org-setup', body: { name: 'North', type: 'designer', confirmed: true } }, 'Create uses the entered distinct name, not its partial suggestion.');

    await open(['North Studio']);
    await page.focus('#firm-name');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await page.$eval('#firm-name', el => el.value), 'North Studio', 'Keyboard selection remains available.');
    assert.equal(await page.$eval('button[type=submit]', el => el.textContent), 'Request access to join firm');
    await page.click('button[type=submit]');
    await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Request sent');
    assert.equal(lastMutation.path, '/api/orgs/firm-0/join');

    await open(['North Studio'], '  NORTH   Studio ');
    assert.equal(!!await page.$('input[type=checkbox]'), false, 'Whitespace and case still normalize to the existing firm.');
    assert.equal(await page.$eval('button[type=submit]', el => el.textContent), 'Request access to join firm');
    console.log('PASS firm enrollment browser: distinct substring names can create; exact duplicates join; ambiguous exact matches require selection; keyboard suggestions and confirmed mutation destinations preserved.');
  } finally { await browser.close(); server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

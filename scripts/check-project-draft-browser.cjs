// Actual manual intake, react-hook-form and draft writer in desktop/mobile Chromium.
// Auth/navigation/HTTP are synthetic. This does not prove database durability.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.tmp/project-draft-browser');
const rows = new Map();
let writes = [], failNext = false;
const navigation = `
import React from 'react';
window.navigations=[];
const router={push:url=>window.navigations.push(url),replace:url=>window.navigations.push(url)};
export const useRouter=()=>router;
export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}
`;
async function build() {
  fs.mkdirSync(out, { recursive: true });
  await esbuild.build({
    stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Page from './src/app/projects/new/page';createRoot(document.getElementById('root')).render(<React.StrictMode><Page/></React.StrictMode>);`, loader: 'tsx', resolveDir: root },
    bundle: true, platform: 'browser', jsx: 'automatic', outfile: path.join(out, 'app.js'), alias: { '@': path.join(root, 'src') },
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'fixture', setup(build) {
      build.onResolve({ filter: /^(next\/(navigation|link)|next-auth\/react|react-hot-toast|@\/components\/interviews\/CreateProjectGuide)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root,
        contents: args.path.startsWith('next/') ? navigation : args.path === 'next-auth/react'
          ? `const session={user:{id:'fixture-owner',operatingAsOrgId:'fixture-firm',operatingAsOrg:{name:'Fixture Studio'}}};export const useSession=()=>({data:session,status:'authenticated'});`
          : args.path === 'react-hot-toast' ? `window.notices=[];export default {success:text=>window.notices.push({type:'success',text}),error:text=>window.notices.push({type:'error',text})};`
          : `import React from'react';export const CreateProjectGuide=({onManual})=><button onClick={onManual}>Add project details first</button>;`,
      }));
    } }],
  });
}
function handler(req, res) {
  const url = new URL(req.url, 'http://fixture.test');
  const json = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  if (url.pathname === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); return fs.createReadStream(path.join(out, 'app.js')).pipe(res); }
  if (url.pathname === '/api/user/workspace-context') return json({ operatingAsOrgId: 'fixture-firm', organizations: [{ id: 'fixture-firm', userRole: 'OWNER' }] });
  if (url.pathname === '/api/projects' && req.method === 'GET') return json([...rows.values()]);
  if (url.pathname === '/api/projects') {
    let body = ''; req.on('data', part => { body += part; });
    return req.on('end', () => {
      const data = JSON.parse(body); writes.push({ method: req.method, data });
      if (failNext) { failNext = false; return json({ error: 'Fixture save failed' }, 503); }
      const id = req.method === 'POST' ? `fixture-project-${rows.size + 1}` : data.id;
      if (req.method === 'PUT' && !rows.has(id)) return json({ error: 'Unknown fixture' }, 404);
      const saved = { ...rows.get(id), ...data, id, isPublic: false };
      rows.set(id, saved); return json(req.method === 'POST' ? { id } : saved, req.method === 'POST' ? 201 : 200);
    });
  }
  if (url.pathname.startsWith('/api/')) return json({ error: 'Unexpected fixture request' }, 404);
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0}:root{--font-headline:Georgia;--font-body:Arial;--surface-canvas:#fff;--surface-ground:#f6f4f0;--folio-copper:#b8845c}.mx-auto{margin-left:auto;margin-right:auto}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`);
}
async function main() {
  await build();
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    const executablePath = process.env.GUIDED_TEST_BROWSER || ['/usr/bin/chromium', '/usr/bin/google-chrome'].find(fs.existsSync);
    browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage(); page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => request.url().startsWith(base) ? request.continue() : request.abort());
    const click = async text => {
      await page.waitForFunction(text => [...document.querySelectorAll('button')].some(node => node.textContent.trim() === text && !node.disabled), {}, text);
      await page.evaluate(text => [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text && !node.disabled).click(), text);
    };
    const fill = async (selector, value) => {
      await page.click(selector, { clickCount: 3 }); await page.keyboard.press('Backspace'); await page.type(selector, value);
    };
    const read = () => page.evaluate(async () => (await fetch('/api/projects?mine=true')).json());
    for (const width of [1440, 390]) {
      rows.clear(); writes = []; failNext = false;
      await page.setViewport({ width, height: 1000 });
      await page.goto(base + '/projects/new'); await click('Add project details first');
      await page.waitForSelector('input[name=title]');
      await click('Create project');
      assert.equal(writes.length, 0, 'completion year remains required');
      await fill('input[name=title]', 'Fixture home');
      await fill('input[name=year]', '2020');
      await page.click('summary');
      await page.select('select[name=projectType]', 'Residential');
      await fill('input[name=location]', 'Fixture city');
      await click('Save draft');
      await page.waitForFunction(() => window.notices.some(n => n.text === 'Draft saved.'));
      const saved = (await read())[0];
      assert.equal(saved.title, 'Fixture home'); assert.equal(saved.city, 'Fixture city');
      assert.equal(saved.completedYear, 2020); assert.equal(saved.isPublic, false);
      assert.equal(await page.$('select[name=visibility]'), null);
      assert.equal(await page.$('input[type=file]'), null, 'photos use the existing upload workspace');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px overflow`);
      // Failed autosave must preserve the last acknowledged state and show recovery.
      failNext = true;
      await fill('input[name=location]', 'Changed city');
      await page.waitForFunction(() => document.querySelector('[role=alert]')?.textContent.includes('Fixture save failed'));
      assert.equal((await read())[0].city, 'Fixture city');
      await click('Save draft');
      await page.waitForFunction(() => !document.querySelector('[role=alert]'));
      await page.waitForFunction(async () => (await (await fetch('/api/projects?mine=true')).json())[0].city === 'Changed city');
      await fill('input[name=title]', 'Fixture final title');
      await click('Create project');
      await page.waitForFunction(() => window.navigations.length > 0);
      const final = await read();
      assert.equal(final.length, 1); assert.equal(final[0].id, saved.id);
      assert.equal(final[0].title, 'Fixture final title'); assert.equal(final[0].city, 'Changed city');
      assert.equal(writes.filter(write => write.method === 'POST').length, 1);
      assert.equal(await page.evaluate(() => window.navigations.at(-1)), `/project/${saved.id}?view=media`);
      await page.screenshot({ path: path.join(out, `manual-${width}.png`), fullPage: true });
      await page.reload();
      assert.deepEqual(await read(), final, 'saved fixture read survives navigation/refresh');
      console.log(`PASS ${width}px manual draft, failed autosave, retry, continue, refresh and private saved values`);
    }
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

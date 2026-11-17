// Actual React editor/public section; HTTP persistence is an isolated synthetic boundary.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.tmp/property-sale-browser');
const fixtureOnly = process.argv.includes('--serve');
let record = null, failSave = false, saves = 0;

(async () => {
  fs.mkdirSync(output, { recursive: true });
  await esbuild.build({ stdin: { contents: `
    import React,{useState,useEffect} from 'react'; import {createRoot} from 'react-dom/client';
    import {PropertySaleEditor} from './src/components/property-sale/PropertySaleEditor';
    import {PropertySaleSection} from './src/components/property-sale/PropertySaleSection';
    import {publicPropertySale} from './src/lib/property-sale/schema';
    import {ProjectChannelLanding} from './src/components/story/ProjectChannelLanding';
    const params=new URLSearchParams(location.search),view=params.get('view')||'public',embed=params.has('embed');
    const images=[{id:'demo-living',url:'/api/project-photos/fixture/living.jpg',room:'Living room'}];
    function App(){const [sale,setSale]=useState(null); window.showPublic=saved=>setSale(publicPropertySale({propertySale:saved}));
      const refresh=async()=>{const response=await fetch('/api/projects/fixture/property-sale');const data=await response.json();setSale(publicPropertySale({propertySale:data.sale}));};
      useEffect(()=>{void refresh()},[]);
      return <><header className="review-header"><span className="review-logo">FOLIO</span>{!embed&&<nav aria-label="Design review"><a href="/?view=public">Public page</a><a href="/?view=edit">Project details</a><a href="/?view=mobile">Mobile preview</a></nav>}<span className="review-note">DESIGN PREVIEW</span></header>
      {view==='mobile'?<iframe title="Mobile project page" src="/?view=public&embed=1" style={{display:'block',width:390,height:844,maxWidth:'100%',margin:'24px auto',border:'1px solid var(--folio-border-subtle)'}}/>:view==='edit'?<main className="review-editor"><p className="review-eyebrow">Project workspace / Details</p><h1 className="review-title">The Courtyard House</h1><p className="review-deck">The details behind your next Folio story.</p><PropertySaleEditor projectId="fixture" canPublish/><button className="review-refresh" onClick={refresh}>Refresh public preview</button><div id="public-preview"><PropertySaleSection sale={sale}/></div></main>:<ProjectChannelLanding post={{status:'DRAFT',project:{title:'The Courtyard House',description:'A quiet conversation between light, natural materials and the spaces we call home.',designerOrg:{name:'Atelier Studio'},city:'Miami',regionState:'Florida',images,propertySale:sale}}}/>}
      <footer className="review-footer">Illustrative design preview · Fictional project details · Sample photography from Unsplash</footer></>};
    createRoot(document.getElementById('root')).render(<App/>);`, resolveDir: root, sourcefile: 'fixture.tsx', loader: 'tsx' },
    outfile: path.join(output, 'app.js'), bundle: true, platform: 'browser', jsx: 'automatic', alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}'  } });
  const globals = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  const config = { ...require(path.join(root, 'tailwind.config.js')), content: [path.join(root, 'src/components/property-sale/*.tsx'),path.join(root,'src/components/story/*.{tsx,css}'),path.join(root,'src/components/SafeImage.tsx')] };
  const css = (await postcss([tailwind(config)]).process(globals, { from: path.join(root, 'src/app/globals.css') })).css;
  if (fixtureOnly) record = { schemaVersion:1, version:1, requestId:'preview-only', updatedBy:'preview', updatedAt:new Date().toISOString(), confirmedAt:new Date().toISOString(), details:{ currentlyForSale:true, listingUrl:'https://example.com/listing', askingPrice:'41000000', currency:'USD', address:'', publishAddress:false, agentName:'', brokerage:'', contactUrl:'', publicationPermission:true, pressLinks:[{title:'The architect’s perspective',url:'https://example.com/story'}] } };
  const server = http.createServer(async (req, res) => {
    if (req.url === '/api/projects/fixture/property-sale/import') {
      for await (const chunk of req) {} // Synthetic boundary: never contacts a listing site.
      res.setHeader('Content-Type','application/json');
      return res.end(JSON.stringify({fields:{askingPrice:'42000000',currency:'USD',address:'Imported sample address',agentName:'Sample agent'}}));
    }
    if (req.url === '/api/projects/fixture/property-sale') {
      if (req.method === 'PUT') {
        let body = ''; for await (const chunk of req) body += chunk;
        if (failSave) { failSave = false; res.writeHead(503, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Synthetic interrupted save. Your edits are retained.' })); }
        const input = JSON.parse(body); saves++;
        record = { schemaVersion: 1, version: input.version + 1, requestId: input.requestId, updatedBy: 'fixture', updatedAt: new Date().toISOString(),
          confirmedAt: input.details.publicationPermission && input.details.currentlyForSale ? new Date().toISOString() : record?.confirmedAt ?? null, details: input.details };
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ sale: record }));
    }
    if (req.url === '/app.css') { res.setHeader('Content-Type','text/css'); return res.end(fs.readFileSync(path.join(output,'app.css'))); }
    if (req.url.startsWith('/api/project-photos/fixture/')) {
      const photo=path.join(output,'photo.jpg');
      if(fs.existsSync(photo)){res.setHeader('Content-Type','image/jpeg');return res.end(fs.readFileSync(photo));}
      res.setHeader('Content-Type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#e8e4df"/><rect x="850" y="100" width="650" height="650" fill="#c7b6a0"/></svg>');
    }
    if (/^\/fonts\/[a-zA-Z-]+\.ttf$/.test(req.url)) { res.setHeader('Content-Type','font/ttf'); return res.end(fs.readFileSync(path.join(root,'public/fonts/publication',path.basename(req.url)))); }
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(fs.readFileSync(path.join(output, 'app.js'))); }
    res.setHeader('Content-Type', 'text/html'); res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Folio · Property story design review</title><link rel="stylesheet" href="/app.css"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}
@font-face{font-family:FolioHeadline;src:url('/fonts/CormorantGaramond.ttf')}@font-face{font-family:FolioBody;src:url('/fonts/InstrumentSans.ttf')}
:root{--font-headline:FolioHeadline,Georgia,serif;--font-body:FolioBody,Arial,sans-serif}body{font-family:var(--font-body);margin:0;background:var(--surface-canvas);color:var(--folio-text-primary)}
.review-header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:22px 4%;border-bottom:1px solid var(--folio-border-subtle)}.review-logo{font-family:var(--font-headline);font-size:30px;letter-spacing:.2em}.review-header nav{display:flex;gap:24px;font-size:13px}.review-header a{text-decoration:underline;text-underline-offset:5px}.review-note,.review-eyebrow{font-size:10px;letter-spacing:.15em;color:var(--folio-text-secondary)}.review-editor{max-width:1120px;margin:auto;padding:40px 4%}.review-title{font-family:var(--font-headline);font-size:48px;font-weight:400;margin:16px 0 8px}.review-deck{font-size:15px;color:var(--folio-text-secondary)}.review-refresh{font-size:13px;text-decoration:underline;margin:12px 0 24px}.review-footer{font-size:11px;color:var(--folio-text-secondary);padding:24px 4%;border-top:1px solid var(--folio-border-subtle)}@media(max-width:600px){.review-header{padding:16px 20px;flex-wrap:wrap}.review-header nav{order:3;width:100%;gap:18px}.review-title{font-size:36px}}
</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`);
  });
  await new Promise(resolve => server.listen(fixtureOnly ? Number((process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : process.env.PORT) || 3000) : 0, fixtureOnly ? '0.0.0.0' : '127.0.0.1', resolve));
  if (fixtureOnly) { console.log('Property sale component fixture is ready.'); return; }
  const browser = await puppeteer.launch({ executablePath: process.env.GUIDED_TEST_BROWSER || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const visit = async () => { await page.goto(`http://127.0.0.1:${server.address().port}/?view=edit`, { waitUntil: 'networkidle0' }); await page.click('summary'); await page.waitForSelector('input[type=checkbox]'); };
    const clickLabel = async label => { await page.evaluate(text => { const item = [...document.querySelectorAll('label')].find(el => el.textContent.startsWith(text)); if (!item) throw Error('Missing label: ' + text); item.querySelector('input').click(); }, label); };
    const fill = async (label, value) => { const selector = await page.evaluateHandle(text => [...document.querySelectorAll('label')].find(el => el.textContent.startsWith(text)).querySelector('input'), label); await selector.asElement().click({ clickCount: 3 }); await selector.asElement().type(value); await selector.dispose(); };
    const clickButton = async label => { await page.evaluate(text => { const button = [...document.querySelectorAll('button')].find(el => el.textContent.startsWith(text)); if (!button || button.disabled) throw Error('Button unavailable: ' + text); button.click(); }, label); };
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 }); await visit();
    await clickLabel('This property is currently for sale');
    await fill('Listing link', 'https://listing.test/house'); await fill('Asking price', '41000000'); await fill('Property address', '123 Private Lane');
    await clickButton('Fill from listing'); await page.waitForFunction(()=>document.querySelector('[role=status]')?.textContent.includes('Listing details filled'));
    assert.equal(await page.evaluate(()=>[...document.querySelectorAll('label')].find(el=>el.textContent.startsWith('Asking price')).querySelector('input').value),'41000000','import preserves entered price');
    assert.equal(await page.evaluate(()=>[...document.querySelectorAll('label')].find(el=>el.textContent.startsWith('Property address')).querySelector('input').value),'123 Private Lane','import preserves entered address');
    failSave = true; await clickButton('Save property details'); await page.waitForSelector('[role=alert]');
    assert.match(await page.$eval('[role=alert]', el => el.textContent), /interrupted/);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('label')].find(el => el.textContent.startsWith('Asking price')).querySelector('input').value), '41000000');
    await clickButton('Save property details'); await page.waitForFunction(()=>[...document.querySelectorAll('[role=status]')].some(el=>el.textContent.startsWith('Saved')));
    assert.equal(saves, 1); assert.equal(record.details.publicationPermission, false);
    await page.evaluate(value => window.showPublic(value), record); assert.equal(await page.$('#public-preview section'), null);
    await clickLabel('I have permission to publish'); await page.evaluate(()=>[...document.querySelectorAll('summary')].find(el=>el.textContent.startsWith('Press & project')).click()); await clickButton('Add press or project link');
    await fill('Link 1 title', 'The architect’s perspective'); await fill('Link 1 URL', 'https://press.test/story');
    await clickButton('Save property details'); await page.waitForFunction(() => [...document.querySelectorAll('[role=status]')].some(el=>el.textContent.includes('Approved details')));
    await page.evaluate(value => window.showPublic(value), record); await page.waitForSelector('#public-preview section');
    let publicText = await page.$eval('#public-preview', el => el.textContent);
    assert.match(publicText, /41,000,000/); assert.doesNotMatch(publicText, /123 Private Lane/);
    assert.equal(await page.$eval('#public-preview a', el => el.getAttribute('rel')), 'noopener noreferrer');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile width fits');
    await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
    await page.setViewport({ width: 1440, height: 1000 });
    await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
    await visit(); assert.equal(await page.$eval('input[type=checkbox]', el => el.checked), true, 'saved sale state survives remount');
    await clickLabel('This property is currently for sale'); await clickButton('Save property details'); await page.waitForFunction(()=>[...document.querySelectorAll('[role=status]')].some(el=>el.textContent.startsWith('Saved')));
    await page.evaluate(value => window.showPublic(value), record);
    publicText = await page.$eval('#public-preview', el => el.textContent);
    assert.doesNotMatch(publicText, /41,000,000|Currently for sale|View listing/); assert.match(publicText, /architect’s perspective/);
    assert.deepEqual(errors, []);
    console.log('PASS actual mobile/desktop editor: validation, interrupted save recovery, private defaults, approved public listing, hidden address, durable reload, withdrawal and retained press. Screenshots: .tmp/property-sale-browser/');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exit(1); });

/** Isolated browser proof: real staging panel + edit context; article and transport fixtures. No database or remote API. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');

async function main() {
  const mocks = {
    'next/navigation': `export function useRouter() { return window.fixture.router; }`,
    'next/link': `import React from 'react'; export default function Link(props) { return <a {...props}/>; }`,
    '@/hooks/usePublishFlow': `export function usePublishFlow() { return window.fixture.flow; }`,
    '@/components/posting/GenerationContextOptions': `export const useGenerationContext = () => ({}); export default function Options() { return null; }`,
    '@/lib/posting/folioLines': `export const needsRoomTeaserPreparation = () => false;`,
    '@/components/project/ImmersiveProjectPage': `
      import React, {useState} from 'react';
      import {useStoryEdit} from '@/components/story/StoryEditContext';
      export function ImmersiveProjectPage({post, showOwnerTools}) {
        const edit = useStoryEdit();
        const [text, setText] = useState(post.expandedBlocks.lead.title);
        return <article data-fixture-article={edit ? 'editor' : 'reader'}>
          {showOwnerTools !== false && <button>Instagram owner tool</button>}
          {edit ? <><label>Title<input aria-label="Draft title" value={text} onChange={event => setText(event.target.value)}/></label>
            <button>Title choices</button><button>Quote choices</button>
            <button onClick={() => {window.fixture.savedTitle = text; edit.refresh();}}>Save fixture title</button></>
            : <h1>{post.expandedBlocks.lead.title}</h1>}
        </article>;
      }`,
  };
  const entry = `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import Panel from './src/app/project/[id]/StagingPublishPanel';
    const fixture = window.fixture = {
      savedTitle: 'Saved fixture title', navigations: [], refreshes: 0, publishSucceeds: false,
      router: { push(url) { fixture.navigations.push(url); }, refresh() { fixture.refreshes++; render(); } },
      flow: {
        data: {interview:{answers:[]}}, heroAssetId:'image', hasCredits:true,
        generateDraft:async()=>{}, publish:async()=>({slug:fixture.publishSucceeds?'fixture-story':null}),
        unpublish:async()=>({ok:true}), refetch:async()=>{},
        contextToggles:{}, setContextToggle:()=>{},
      },
    };
    const root = createRoot(document.getElementById('root'));
    function render() {
      root.render(<><header id="parent-chrome">Project heading and progress stepper</header>
        <Panel projectId="fixture-project" images={[]} isOwner={true}
          initialPostData={{status:'DRAFT', expandedBlocks:{lead:{title:fixture.savedTitle},galleryChapters:[]}}}
          initialModules={[]} editorialState="GENERATED" canPublish={true}
          taggedPhotoCount={1} untaggedPhotoCount={0} unsortedPhotoCount={0}/></>);
    }
    render();
  `;
  const bundle = await esbuild.build({
    stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: 'preview-fixture.tsx', loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'isolated-fixtures', setup(build) {
      build.onResolve({ filter: /.*/ }, args => {
        if (Object.hasOwn(mocks, args.path)) return { path: args.path, namespace: 'fixture' };
        const specifier = args.path.startsWith('@/') ? path.join(process.cwd(), 'src', args.path.slice(2))
          : args.path.startsWith('.') ? path.resolve(args.resolveDir || process.cwd(), args.path) : args.path;
        const local = path.isAbsolute(specifier) && ['', '.tsx', '.ts', '.js'].map(extension => specifier + extension).find(file => fs.existsSync(file) && fs.statSync(file).isFile());
        return { path: local || require.resolve(specifier, { paths: [args.resolveDir || process.cwd()] }), namespace: 'resolved' };
      });
      build.onLoad({ filter: /.*/, namespace: 'resolved' }, args => ({ contents: fs.readFileSync(args.path, 'utf8'), loader: args.path.endsWith('.tsx') ? 'tsx' : args.path.endsWith('.ts') ? 'ts' : 'js', resolveDir: path.dirname(args.path) }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: process.cwd() }));
    } }],
  });
  if (!process.argv.includes('--browser')) {
    await checkDom(bundle.outputFiles[0].text);
    return;
  }
  const executablePath = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].find(candidate => candidate && fs.existsSync(candidate));
  assert.ok(executablePath, 'Chrome/Edge executable available (or set CHROME_PATH)');
  const browser = await puppeteer.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1200, height: 900 });
    // Only fixture CSS needed to exercise the actual fullscreen/hidden classes.
    await page.setContent(`<html><head><style>
      body{margin:0;font-family:Arial}button{margin:5px;padding:10px}article{padding:32px}
      [hidden]{display:none!important}.fixed{position:fixed}.inset-0{inset:0}
      .bg-white{background:white}.overflow-y-auto{overflow-y:auto}
      [class*="z-[60]"]{z-index:60}.sticky{position:sticky}.top-0{top:0}
      #parent-chrome{height:160px;background:#ddd;padding:20px}
    </style></head><body><div id="root"></div></body></html>`);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.waitForSelector('input[aria-label="Draft title"]');
    const click = async label => {
      const handle = await page.evaluateHandle(text => [...document.querySelectorAll('button')]
        .find(button => button.textContent.trim() === text && button.getClientRects().length), label);
      assert.ok(handle.asElement(), `visible button: ${label}`);
      await handle.asElement().click();
      await handle.dispose();
    };
    await page.$eval('input', input => input.select());
    await page.type('input', 'Unsaved fixture title');
    await click('Preview');
    await page.waitForSelector('[data-fixture-article="reader"]');
    assert.equal(await page.$eval('[data-fixture-article="reader"] h1', el => el.textContent), 'Saved fixture title');
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('button')]
      .filter(button => button.getClientRects().length)
      .map(button => button.textContent.trim())), ['Back to editing', 'Preview']);
    assert.equal(await page.evaluate(() => document.elementFromPoint(100, 100).closest('#parent-chrome') === null), true);
    assert.equal(await page.$eval('[data-fixture-article="editor"]', el => el.getClientRects().length), 0);
    console.log('PASS full-screen Preview shows saved article, covers parent chrome, hides selectors and workflow actions');
    await click('Back to editing');
    assert.equal(await page.$eval('input', el => el.value), 'Unsaved fixture title');
    await click('Preview');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('input').getClientRects().length > 0);
    assert.equal(await page.$eval('input', el => el.value), 'Unsaved fixture title');
    console.log('PASS Back and Escape preserve unsaved input through actual React state');
    await click('Save fixture title');
    await click('Preview');
    await page.waitForFunction(() => document.querySelector('[data-fixture-article="reader"] h1')?.textContent === 'Unsaved fixture title');
    console.log('PASS saved content refreshes into the reader preview');
    const screenshot = path.join(os.tmpdir(), 'folio-project-preview-fixture.png');
    await page.screenshot({ path: screenshot });
    console.log('Fixture screenshot:', screenshot);
    await click('Back to editing');
    await click('Publish to Folio');
    assert.deepEqual(await page.evaluate(() => window.fixture.navigations), []);
    await page.evaluate(() => { window.fixture.publishSucceeds = true; });
    await click('Publish to Folio');
    await page.waitForFunction(() => window.fixture.navigations.length === 1);
    assert.deepEqual(await page.evaluate(() => window.fixture.navigations), ['/project/fixture-project']);
    assert.deepEqual(errors, []);
    console.log('PASS failed publish stays put; successful publish navigates to project home');
  } finally {
    await browser.close();
  }
}

async function checkDom(bundle) {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<button id="outside">Project actions</button><div id="root"></div>', {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost',
  });
  const { window } = dom;
  const { document } = window;
  // jsdom has no layout. Only visibility for the real focus trap is supplied.
  window.HTMLElement.prototype.getClientRects = function() { return this.closest('[hidden]') ? [] : [{}]; };
  const tick = () => new Promise(resolve => setTimeout(resolve, 25));
  const visibleButtons = () => [...document.querySelectorAll('#root button')].filter(button => button.getClientRects().length);
  const click = async label => {
    const button = visibleButtons().find(button => button.textContent.trim() === label);
    assert.ok(button, `visible button: ${label}`);
    button.focus(); button.click(); await tick();
  };
  const key = async (key, shiftKey = false) => {
    document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
    await tick();
  };
  try {
    window.eval(bundle);
    await tick();
    const input = document.querySelector('input');
    assert.ok(input);
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'Unsaved fixture title');
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    await tick();
    await click('Preview');
    assert.equal(document.querySelector('[data-fixture-article="reader"] h1').textContent, 'Saved fixture title');
    assert.deepEqual(visibleButtons().map(button => button.textContent.trim()), ['Back to editing', 'Preview']);
    const shell = document.querySelector('[role="dialog"]');
    assert.ok(shell.classList.contains('fixed') && shell.classList.contains('inset-0'));
    assert.equal(document.querySelector('[data-fixture-article="editor"]').getClientRects().length, 0);
    assert.equal(document.activeElement.textContent.trim(), 'Back to editing');
    window.fixture.router.refresh();
    await tick();
    assert.equal(document.body.style.overflow, 'hidden', 'preview keeps background scroll locked after refresh');
    await key('Tab', true);
    assert.equal(document.activeElement.textContent.trim(), 'Preview');
    await key('Tab');
    assert.equal(document.activeElement.textContent.trim(), 'Back to editing');
    document.getElementById('outside').focus();
    await key('Tab');
    assert.equal(document.activeElement.textContent.trim(), 'Back to editing');
    console.log('PASS actual React preview isolates saved reader, hides editor/actions, and traps keyboard focus');
    await click('Back to editing');
    assert.equal(document.querySelector('input').value, 'Unsaved fixture title');
    assert.equal(document.activeElement.textContent.trim(), 'Preview');
    await click('Preview');
    // A nested product sheet consumes Escape before the shell's window listener.
    const consumeEscape = event => { if (event.key === 'Escape') event.preventDefault(); };
    document.addEventListener('keydown', consumeEscape, { once: true });
    await key('Escape');
    assert.ok(document.querySelector('[role="dialog"]'));
    await key('Escape');
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(document.querySelector('input').value, 'Unsaved fixture title');
    console.log('PASS Back/Escape restore focus and unsaved text; consumed nested Escape leaves preview open');
    await click('Save fixture title');
    await click('Preview');
    assert.equal(document.querySelector('[data-fixture-article="reader"] h1').textContent, 'Unsaved fixture title');
    await click('Back to editing');
    await click('Publish to Folio');
    assert.equal(window.fixture.navigations.length, 0);
    window.fixture.publishSucceeds = true;
    await click('Publish to Folio');
    assert.deepEqual([...window.fixture.navigations], ['/project/fixture-project']);
    console.log('PASS saved preview refresh and failed/successful publish navigation');
  } finally { dom.window.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

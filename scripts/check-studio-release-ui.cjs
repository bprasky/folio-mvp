const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const React = require('react'), { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://folio.test/designer/studio/release?projectId=p' });
Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
const { createRoot } = require('react-dom/client');
let calls = [], fail = false, persisted = null;
const options = [
  { sourceId: 'intro', revision: 'r1', kind: 'introduction', title: 'A whole home', caption: 'Supported overview', imageUrl: null, editorHref: '/editor?proposal=intro', status: 'prepared' },
  ...['living', 'dining'].map(sourceId => ({ sourceId, revision: 'r1', kind: 'room', roomId: sourceId, title: sourceId, caption: 'A grounded room decision', imageUrl: null, editorHref: '/editor?proposal=' + sourceId, status: 'draft_saved' })),
];
function load(file) { const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, console, window, document, URLSearchParams, fetch: async (url, init) => {
  calls.push({ url, init });
  if (init?.method === 'PUT') { if (fail) return { ok: false, json: async () => ({ error: 'Save failed; retry.' }) }; const body = JSON.parse(init.body); assert.equal(body.expectedVersion, persisted?.version ?? 0); persisted = { version: (persisted?.version ?? 0) + 1, items: body.items, needsReview: false }; }
  return { ok: true, json: async () => ({ project: { id: 'p', title: 'Project' }, purpose: 'Give Project a fuller introduction.', options, plan: persisted }) };
}, require(name) { if (name === 'next/link') return { default: ({ href, children, ...rest }) => React.createElement('a', { href, ...rest }, children) }; if (name === 'next/navigation') return { useSearchParams: () => new URLSearchParams('projectId=p') }; if (name === './UnsavedActivityDialog') return load('src/components/publishing-studio/UnsavedActivityDialog.tsx'); return require('./studio-publication-test-import.cjs')(name) || require(name); } }); return exports; }
const button = text => [...document.querySelectorAll('button')].find(el => el.textContent === text);
async function click(text) { await React.act(async () => button(text).click()); }
async function main() {
  const root = createRoot(document.getElementById('root')), { StudioReleasePlan } = load('src/components/publishing-studio/StudioReleasePlan.tsx');
  await React.act(async () => root.render(React.createElement(StudioReleasePlan)));
  assert.equal(calls.length, 1); assert.equal(calls[0].init.method, undefined, 'Opening must not save');
  assert(document.body.textContent.includes('Give Project a fuller introduction.'));
  assert(document.querySelector('a[href*="release=p"]'), 'Editor retains release return context');
  await click('Choose rooms →');
  assert.equal(document.querySelectorAll('input:checked').length, 0, 'No fabricated favorite rooms');
  await React.act(async () => { for (const el of document.querySelectorAll('input[type=checkbox]')) el.click(); });
  await click('Review selected posts →');
  const down = document.querySelector('[aria-label="Move living down"]');
  await React.act(async () => down.click());
  assert(document.querySelector('[aria-label="Move A whole home down"]').disabled, 'Introduction anchors sequence');
  assert(document.body.textContent.includes('will not automatically publish'));
  await React.act(async () => require('react-dom/test-utils').Simulate.change(document.querySelector('input[type=date]'), { target: { value: '2026-10-12' } }));
  fail = true; await click('Save release plan'); assert(document.querySelector('[role=alert]').textContent.includes('Save failed')); assert.equal(document.querySelectorAll('li').length, 3);
  fail = false; await click('Save release plan'); assert.deepEqual(persisted.items.map(item => item.sourceId), ['intro', 'dining', 'living']); assert(document.body.textContent.includes('Release plan saved.'));
  await React.act(async () => root.render(null));
  await React.act(async () => root.render(React.createElement(StudioReleasePlan)));
  assert.deepEqual([...document.querySelectorAll('li h3')].map(el => el.textContent), ['A whole home', 'dining', 'living'], 'Saved order survives reload');
  assert.equal(document.querySelector('input[type=date]').value,'2026-10-12','Planning date survives reload without scheduling');
  const before = calls.length;
  await click('2. Choose rooms'); await React.act(async () => document.querySelector('input[type=checkbox]').click());
  await React.act(async () => document.querySelector('a[href="/designer/studio"]').click());
  assert(button('Exit without saving')); assert.equal(calls.length, before, 'Dirty navigation asks before writing');
  await click('Keep editing'); assert.equal(calls.length, before);
  await React.act(async () => root.unmount());
  console.log('PASS release UI: readonly opening, explicit rooms, anchored ordering, save failure retention, resume and dirty exit.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

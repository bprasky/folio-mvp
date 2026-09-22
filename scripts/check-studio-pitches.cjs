const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript'), React = require('react'), { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://folio.test/designer/studio' });
Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
const { createRoot } = require('react-dom/client'), { Simulate } = require('react-dom/test-utils');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, document, window, console, URLSearchParams,
    require(name) {
      if (name === 'next/link') return { default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (name.startsWith('.') || name.startsWith('@/')) {
        const next = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(file), name);
        return load(next + (fs.existsSync(next + '.tsx') ? '.tsx' : '.ts'));
      }
      return require(name);
    },
  });
  return exports;
}
const button = label => [...document.querySelectorAll('button')].find(node => node.textContent === label || node.getAttribute('aria-label') === label);
const click = async label => { assert(button(label), label); await React.act(async () => button(label).click()); };
(async () => {
  const root = createRoot(document.getElementById('root'));
  const { StudioPitchCard } = load('src/components/publishing-studio/StudioPitchCard.tsx');
  let starts = 0;
  await React.act(async () => root.render(React.createElement(StudioPitchCard, { title: 'Make a small room work harder', eyebrow: 'Room feature', image: React.createElement('img', { src: '/project-room.jpg', alt: 'The selected project room' }), actionLabel: 'Polish this post', onAction: () => starts++ }, 'The full prepared pitch.')));
  assert(!document.body.textContent.includes('The full prepared pitch.'));
  const trigger = button('View idea: Make a small room work harder'); trigger.focus();
  await click('View idea: Make a small room work harder');
  assert.equal(starts, 0, 'Opening a pitch does not start or save work');
  assert(document.querySelector('dialog[open]')); assert(document.body.textContent.includes('The full prepared pitch.'));
  assert.equal(document.querySelector('dialog img').getAttribute('src'), '/project-room.jpg', 'The exact project photo remains visible inside the pitch');
  assert.equal(document.body.style.overflow, 'hidden');
  await React.act(async () => document.querySelector('dialog').dispatchEvent(new window.Event('cancel', { bubbles: false, cancelable: true })));
  assert(!document.querySelector('dialog')); assert.ok(document.activeElement === trigger, 'Closing the dialog restores focus to its card trigger');
  await click('View idea: Make a small room work harder'); await click('Polish this post');
  assert.equal(starts, 1); assert(!document.querySelector('dialog')); assert.equal(document.body.style.overflow, '');
  const { StudioDiscovery } = load('src/components/publishing-studio/StudioDiscovery.tsx');
  let chosen = null;
  await React.act(async () => root.render(React.createElement(StudioDiscovery, { projects: [{ id: 'one', title: 'Courtyard House' }, { id: 'two', title: 'Hill House' }], subject: '', format: '', onSubject: value => chosen = value, onFormat() {} })));
  assert(!document.querySelector('select')); await click('Choose project');
  assert(document.querySelector('dialog[open]'));
  await React.act(async () => Simulate.change(document.querySelector('input'), { target: { value: 'Hill' } }));
  assert(!document.querySelector('[aria-label="Projects"]').textContent.includes('Courtyard'));
  await React.act(async () => document.querySelector('[aria-label="Projects"] button').click());
  assert.equal(chosen, 'two'); assert(!document.querySelector('dialog[open]'));
  await React.act(async () => root.unmount());
  console.log('PASS Studio pitches: hidden detail, read-only opening, explicit action, Escape/focus restoration and searchable project gallery.');
})().catch(error => { console.error(error); process.exitCode = 1; });

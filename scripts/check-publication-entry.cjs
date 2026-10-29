// Exercise the actual React publication in JSDOM, with no browser or database.
// Only Next's routing/image boundaries are replaced. Cover, rooms, introduction,
// product drawer and studio editing are real components.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const out = path.join(root, '.tmp/publication-entry-check');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'image.jsx'), `import React from 'react';export default function Image({fill,priority,unoptimized,quality,sizes,...props}){return <img {...props}/>}`);
fs.writeFileSync(path.join(out, 'navigation.js'), `export const useSearchParams=()=>new URLSearchParams(location.search);const router={refresh(){},push(){}};export const useRouter=()=>router;export const usePathname=()=>location.pathname;`);
fs.writeFileSync(path.join(out, 'link.jsx'), `import React from 'react';export default function Link(props){return <a {...props}/>}`);
buildSync({ stdin: { contents: `export { StoryRenderer } from './src/components/story/StoryRenderer';export { StoryEditProvider } from './src/components/story/StoryEditContext';`, resolveDir: root },
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', outfile: path.join(out, 'components.cjs'),
  alias: { '@': path.join(root, 'src'), 'next/navigation': path.join(out, 'navigation.js'), 'next/image': path.join(out, 'image.jsx'), 'next/link': path.join(out, 'link.jsx') },
});

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://publication.test/' });
for (const key of ['window', 'document', 'navigator', 'location', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'NodeFilter', 'MutationObserver', 'Event', 'MouseEvent', 'KeyboardEvent', 'CustomEvent', 'getComputedStyle']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let width = 1200, reducedMotion = false, clock = 0, timerId = 0;
const timers = new Map();
window.matchMedia = () => ({ matches: reducedMotion, addEventListener() {}, removeEventListener() {} });
window.setTimeout = (fn, delay) => { timers.set(++timerId, { fn, at: clock + delay }); return timerId; };
window.clearTimeout = id => timers.delete(id);
Date.now = () => clock;
globalThis.requestAnimationFrame = fn => { fn(); return 0; };
globalThis.cancelAnimationFrame = () => {};
HTMLElement.prototype.scrollTo = function() {};
globalThis.ResizeObserver = class {
  constructor(callback) { this.callback = callback; }
  observe(target) { this.callback([{ contentRect: { width, height: target.hasAttribute('data-publication-phase') ? 620 : 240 } }]); }
  disconnect() {}
};
globalThis.fetch = async () => ({ ok: true, json: async () => ({ presentation: { version: 1, accent: null, roomOrder: [] }, colors: [] }) });
const React = require('react');
const { createRoot } = require('react-dom/client');
const act = React.act || require('react-dom/test-utils').act;
const { StoryRenderer, StoryEditProvider } = require(path.join(out, 'components.cjs'));
let reactRoot;
const byLabel = label => document.querySelector(`[aria-label="${label}"]`);
const phase = () => document.querySelector('[data-publication-phase]')?.dataset.publicationPhase;
const visibleIntro = () => byLabel('Read project introduction')?.closest('[aria-hidden]')?.getAttribute('aria-hidden') === 'false';
async function click(element) { assert.ok(element, 'Expected interactive element'); await act(async () => element.click()); }
async function advance(ms) {
  clock += ms;
  await act(async () => {
    for (const [id, timer] of timers) if (timer.at <= clock) { timers.delete(id); timer.fn(); }
  });
}
function post(count = 2) {
  return { id: 'existing-post', projectId: 'project', slug: 'existing-house', heroAssetId: 'photo-1',
    project: { id: 'project', title: 'Existing house', designer: { name: 'Designer', studio: 'Studio' },
      images: Array.from({ length: count }, (_, i) => ({ id: `photo-${i}`, url: `/photo-${i}.jpg`, roomId: `room-${i}`, room: `Room ${i}`, inclusion: 'INCLUDED',
        tags: i === 0 ? [{ product: { id: 'chair', name: 'Project chair' } }] : [] })) },
    expandedBlocks: { lead: { title: 'A headline belonging inside the publication', deck: 'A deck with its own place.' }, introduction: ['the original introduction.', 'A second paragraph.'],
      galleryChapters: Array.from({ length: count }, (_, i) => ({ roomId: `room-${i}`, title: `Room ${i}`, imageIds: [`photo-${i}`], body: ['a room with a reason.'] })) } };
}
async function mount(data = post(), options = {}) {
  if (reactRoot) await act(async () => reactRoot.unmount());
  width = options.width ?? 1200; reducedMotion = options.reducedMotion ?? false;
  dom.reconfigure({ url: `http://publication.test/${options.query || ''}` });
  reactRoot = createRoot(document.getElementById('root'));
  const viewer = React.createElement(StoryRenderer, { post: data });
  await act(async () => reactRoot.render(options.edit ? React.createElement(StoryEditProvider, { projectId: 'project', initialOverrides: [], chapters: [] }, viewer) : viewer));
}
async function touch(type, x, y) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  const point = { clientX: x, clientY: y };
  Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : [point] }, changedTouches: { value: [point] } });
  await act(async () => document.querySelector('[data-publication-phase]').dispatchEvent(event));
  return event;
}

(async () => {
  await mount();
  assert.equal(document.querySelectorAll('[data-publication-view]').length, 1);
  assert.equal(phase(), 'opening');
  assert.equal(document.querySelector('h1').textContent, 'Existing house');
  assert.equal(document.querySelector('h1').parentElement.querySelector('img').getAttribute('src'), '/photo-1.jpg', 'Designer-selected cover wins');
  assert.equal(byLabel('Go to room'), null);
  assert.equal(byLabel('All rooms'), null);
  assert.equal(byLabel('Project introduction'), null);
  assert.equal(visibleIntro(), false);
  assert.equal(document.querySelector('[data-publication-view]').children.length, 1, 'No old title, hero, intro or credits stack beside the viewer');
  await act(async () => document.querySelector('[data-publication-phase]').dispatchEvent(new window.WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true })));
  assert.equal(phase(), 'opening', 'Desktop scrolling does not dismiss the click gate');
  await act(async () => document.querySelector('[data-publication-phase]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
  assert.equal(byLabel('Go to room'), null, 'Arrow keys cannot skip the gate');
  await click(byLabel('Begin Existing house'));
  assert.equal(phase(), 'revealing');
  await advance(649);
  assert.equal(byLabel('Go to room'), null, 'Room controls remain absent throughout the fade');
  await advance(1);
  assert.equal(phase(), 'ready');
  assert.equal(visibleIntro(), true);
  await click(byLabel('Read project introduction'));
  assert.ok(byLabel('Project introduction').textContent.includes('The original introduction.'));
  assert.ok(byLabel('Project credits'));
  await click(byLabel('Collapse project introduction'));
  await click(byLabel('Next room'));
  assert.ok(byLabel('Read Room 0'));
  await click(byLabel('Previous room'));
  assert.equal(visibleIntro(), true);
  assert.equal(byLabel('Begin Existing house'), null, 'Returning to the cover does not replay the gate');
  await click(byLabel('View full photograph without text'));
  assert.equal(byLabel('All rooms'), null);
  await click(byLabel('Show room details'));
  assert.equal(visibleIntro(), true);

  await mount(post(), { width: 390 });
  await touch('touchstart', 200, 600);
  assert.equal((await touch('touchmove', 195, 520)).defaultPrevented, true, 'Entry scroll stays inside the experience');
  await advance(650);
  await touch('touchend', 50, 520);
  await click(byLabel('View full photograph without text'));
  assert.equal(visibleIntro(), true, 'Entry gesture and ghost click neither advance nor hide the introduction');
  await advance(801);
  await touch('touchstart', 300, 200); await touch('touchend', 100, 200);
  assert.ok(byLabel('Read Room 0'), 'A subsequent side swipe advances the room');
  await mount(post(), { width: 700 });
  await touch('touchstart', 200, 400); await touch('touchend', 200, 400); await advance(650);
  assert.equal(visibleIntro(), true, 'Wide phones use the same tap gate');

  await mount(post(), { query: '?room=room-1&product=chair' });
  assert.equal(byLabel('Room 1 article'), null);
  assert.equal(document.querySelector('[role=dialog]'), null);
  await click(byLabel('Begin Existing house')); await advance(650);
  assert.ok(byLabel('Room 1 article'), 'Room deep link opens only after entry');
  assert.ok(document.querySelector('[role=dialog]').textContent.includes('Project chair'), 'Product deep link opens only after entry');

  const sparse = post(7); sparse.expandedBlocks.galleryChapters.forEach(chapter => chapter.body = []);
  sparse.project.images[0].inclusion = 'EXCLUDED'; sparse.project.images[1].url = '';
  await mount(sparse, { reducedMotion: true });
  assert.equal(document.querySelector('h1').parentElement.querySelector('img').getAttribute('src'), '/photo-2.jpg');
  await click(byLabel('Begin Existing house')); await advance(1);
  assert.equal(phase(), 'ready', 'Reduced motion removes the lengthy fade');
  await click(byLabel('Next room'));
  assert.equal(document.querySelectorAll('[data-count] button').length, 3);
  assert.equal(document.querySelectorAll('[aria-label^="Read Room"]').length, 0, 'Photo-only rooms do not acquire an empty article card');
  await click(byLabel('Next room'));
  assert.equal(document.querySelectorAll('[data-count] button').length, 2);

  await mount(post(120));
  await click(byLabel('Begin Existing house')); await advance(650);
  assert.equal(byLabel('Go to room').options.length, 121);
  await act(async () => { byLabel('Go to room').value = 'room-119'; byLabel('Go to room').dispatchEvent(new Event('change', { bubbles: true })); });
  assert.ok(byLabel('Read Room 119'));

  await mount(post(), { edit: true });
  await click(byLabel('Begin Existing house')); await advance(650);
  await click(byLabel('Read project introduction'));
  assert.ok(document.querySelector('[data-story-edit]'), 'Studio introduction keeps the actual inline editors');
  await click(byLabel('Project introduction').querySelector('h2'));
  assert.ok(document.querySelector('textarea'), 'The headline opens its inline editor');
  assert.equal(byLabel('Collapse project introduction').disabled, true, 'An open edit cannot be discarded by collapsing');
  await click(document.querySelector('[aria-label="All rooms"] button:nth-child(2)'));
  assert.ok(document.querySelector('textarea'), 'Room navigation preserves the open edit');
  await act(async () => document.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await click(byLabel('Collapse project introduction'));
  const anotherPost = post(); anotherPost.id = 'other-post'; anotherPost.project.title = 'Another house';
  await act(async () => reactRoot.render(React.createElement(StoryRenderer, { post: anotherPost })));
  assert.equal(phase(), 'opening', 'Navigating to a different project gets its own gate');
  await act(async () => reactRoot.unmount());
  console.log('Publication entry checks pass: existing-project replacement, cover selection, fade lock, mobile tap/scroll/swipe, ghost clicks, repeat visits, deep links, sparse galleries, 120 rooms, reduced motion and studio editing.');
})().catch(error => { console.error(error); process.exitCode = 1; });

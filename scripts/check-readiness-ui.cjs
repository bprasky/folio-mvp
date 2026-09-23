const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const candidate = { shape:'decision', id: 'c', version: 1, sourceVersion: 's', readiness: 'quick', thesis: 'A considered decision', audienceValue: 'Why the plan changed', rationale: 'Specific source',
  source: { title: 'Home', images: [] }, projectIds: ['p'], format: 'single_image', visuals: [{ id: 'image', projectId: 'p', url: 'https://fixture.test/photo.jpg', role: 'hero', reason: 'Shows the result' }],
  claims: [{ text: 'We changed the plan.', evidenceIds: ['e'] }],
  evidence: [{ id: 'e', text: 'We changed the plan.', tier: 'direct' }],
  draft: { headline: 'The new plan', caption: 'The room opened up.', credits: { designer: 'Designer', photographer: 'Photographer' } },
  blockers: [{ id: 'b', kind: 'truth', question: 'What changed?' }], reasons: ['More source material needed'] };
let calls = [], data = { candidates: [candidate], developing: [], dismissed: [] }, params = new URLSearchParams(), navigation = [];
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, URLSearchParams, window: { get location() { return global.window?.location; }, get history() { return global.window?.history; }, get sessionStorage() { return global.window?.sessionStorage; }, addEventListener: (...args) => global.window?.addEventListener(...args), removeEventListener: (...args) => global.window?.removeEventListener(...args) },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, document: { get activeElement() { return global.document?.activeElement; }, addEventListener: (...args) => global.document?.addEventListener(...args), removeEventListener: (...args) => global.document?.removeEventListener(...args), createElement: () => ({ click() {}, remove() {} }), get body() { return global.document?.body || {appendChild(){}}; } },
    require: id => id in mocks ? mocks[id] : id === './StudioPitchCard' ? load('src/components/publishing-studio/StudioPitchCard.tsx', {'./StudioWorkspace':load('src/components/publishing-studio/StudioWorkspace.tsx'), 'next/link':{default:({children,...props})=>React.createElement('a',props,children)}}) : id === '@/lib/publishing-studio/opportunities' ? load('src/lib/publishing-studio/opportunities.ts') : require('./studio-publication-test-import.cjs')(id) || require(id), console, crypto: require('node:crypto').webcrypto,
    fetch: async (url, options) => { calls.push({ url, body: options?.body && JSON.parse(options.body) }); return { ok: true, json: async () => url.endsWith('/export') ? { images: [{ name: 'slide.jpg', dataUrl: 'data:image/jpeg;base64,eA==' }], caption: 'Caption', filename: 'post.zip' } : options?.method === 'PATCH' ? { candidate: { ...candidate, readiness: 'ready', version: 2, blockers: [{ ...candidate.blockers[0], answer: 'Verified' }] } } : data }; },
  });
  return exports;
}
const configurator = load('src/components/publishing-studio/CandidateConfigurator.tsx', { jszip: { default: class Zip { file() {} async generateAsync() { return 'blob'; } } } });
const workspace = load('src/components/publishing-studio/StudioWorkspace.tsx');
const discovery=load('src/components/publishing-studio/StudioDiscovery.tsx',{'./StudioWorkspace':workspace,'next/link':{default:({children,...props})=>React.createElement('a',props,children)}});
const presentation = load('src/lib/publishing-studio/readiness/presentation.ts');
const { ReadinessStudio } = load('src/components/publishing-studio/ReadinessStudio.tsx', {
  './usePersonalIntroduction':{usePersonalIntroduction:()=>({introduction:{status:"available"},error:'',reload(){}})}, 'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
  'next/dynamic': { default: () => () => React.createElement('section', { 'data-saved-work': true }, 'Existing saved work') },
  'next/navigation': { useRouter: () => ({ replace: url => navigation.push(url) }), useSearchParams: () => params },
  '@/lib/publishing-studio/readiness/types': { DISMISSAL_REASONS: [] },
  '@/lib/publishing-studio/readiness/presentation': presentation,
  './StudioDiscovery':discovery, './expertise/ExpertiseSection':{ExpertiseSection:({saved})=>React.createElement('section',{'data-expertise':saved?'saved':'suggested'},'My expertise')}, './StudioSavedActivities':{StudioSavedActivities:()=>null}, './StudioWorkspace': workspace, './CandidateConfigurator': configurator,
});
const make = (index, readiness = 'ready', blockers = []) => ({ ...candidate, id: `candidate-${index}`, readiness, blockers, thesis: `Story thesis ${index}`,
  draft: { ...candidate.draft, headline: `Prepared story ${index}`, caption: `Prepared caption ${index}` },
  visuals: [{ ...candidate.visuals[0], id: `image-${index}`, url: `https://fixture.test/${index}.jpg` }] });
let html = renderToStaticMarkup(React.createElement(configurator.CandidateConfigurator, { candidate, onChange() {}, onClose() {} }));
assert.match(html, /What changed/); assert.match(html, /We changed the plan/); assert.match(html, /Photography: Photographer/);
assert.match(html, /disabled="">Download post/); assert.match(html, /does not publish to social media/);
assert.match(html, /aspect-\[4\/5\]/); assert.match(html, /maxLength="180"/); assert.match(html, /maxLength="2200"/);
assert.doesNotMatch(html, /Keep this direction/);
async function interactions() {
  const { JSDOM } = require('jsdom'), { createRoot } = require('react-dom/client'), { act } = React;
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://fixture.test' });
  global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');}; dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  let root;
  const mount = async (element = React.createElement(ReadinessStudio)) => { root = createRoot(document.getElementById('root')); await act(async () => root.render(element)); };
  const unmount = async () => act(async () => root.unmount());
  const buttons = () => [...document.querySelectorAll('button')];
  const button = name => buttons().find(node => node.textContent === name);
  await mount(React.createElement(configurator.CandidateConfigurator, { candidate: { ...candidate, readiness: 'ready', blockers: [] }, onChange() {}, onClose() {} }));
  assert.equal(calls.length, 0, 'Opening a configured candidate does not generate or mutate');
  assert.equal(button('Record publication').disabled, true);
  await act(async () => button('Download post').click());
  assert.equal(calls[0].body.version, 1); assert.equal(calls[0].body.sourceVersion, 's'); assert.match(calls[0].url, /\/export$/);
  await unmount();
  for (const count of [0, 1, 2, 3, 5]) {
    data = { candidates: Array.from({ length: count }, (_, index) => make(index)), developing: [], dismissed: [] };
    params = new URLSearchParams();
    await mount();
    assert.equal(document.querySelectorAll('[aria-label="Recommended stories"] article').length, Math.min(count, 2)+1, `${count} qualified candidates: a personal activity is always visible alongside prepared work`);
    if (!count) assert.match(document.body.textContent, /No stories ready for review yet/);
    assert.equal(buttons().filter(node=>node.getAttribute('aria-label')?.includes(': Prepared story')).length,count,'All qualified stories visible without expansion');
    assert.equal(document.querySelectorAll('select').length,0);
    assert.ok(document.querySelector('[aria-label="Start my interview: Meet The designer"]'),'Personal invitation is visible before entering its activity');
    await unmount();
  }
  data = { candidates: [make(0), make(1, 'quick', [{ id: 'q1', kind: 'truth', question: 'Which detail changed?' }]), make(2, 'quick', [{ id: 'q2', kind: 'credit', question: 'Photo credit?' }, { id: 'q3', kind: 'voice', question: 'Your wording?' }])], developing: [], dismissed: [] };
  await mount();
  assert(document.body.textContent.includes('Ready for review'));
  assert(document.body.textContent.includes('2 steps remaining'));
  const beforeBrowse = calls.length;
  await act(async () => document.querySelector('[aria-label="Add your perspective: Prepared story 1"]').click());
  assert.equal(calls.length,beforeBrowse,'Opening the actual configurator does not create a draft');
  assert.equal(document.getElementById('candidate-title').textContent, 'Help readers understand this design decision.', 'Purpose carries into configurator'); assert.equal(document.querySelector('input').value, 'Prepared story 1', 'Exact candidate copy opens in configurator');
  assert.equal(document.getElementById('candidate-question').textContent, 'Which detail changed?');
  assert.ok(!calls.some(call => call.body?.kind === 'opened'), 'Opening a story writes no activity or draft');
  assert.equal(document.querySelector('[role="tablist"]'), null, 'Workspace tabs cannot bypass an active draft guard');
  params = new URLSearchParams(navigation.at(-1).split('?')[1]);
  await act(async () => root.render(React.createElement(ReadinessStudio)));
  params = new URLSearchParams();
  await act(async () => root.render(React.createElement(ReadinessStudio)));
  assert.equal(document.getElementById('candidate-title'), null, 'Browser URL removal clears the configurator');
  assert.ok(document.querySelector('[role="tablist"]'), 'Browser Back restores the workspace');
  await unmount();
  data = { candidates: [make(0), make(1), make(2), { ...make(3), projectIds: ['p', 'p2'], visuals: [...make(3).visuals, { ...candidate.visuals[0], id: 'second-project', projectId: 'p2', url: 'https://fixture.test/second.jpg' }] }, make(4)], projects: [{ id: 'p', title: 'Home' }, { id: 'p2', title: 'Other home' }], developing: [], dismissed: [{ ...candidate, id: 'dismissed', thesis: 'An earlier dismissed story', dismissed: true }] };
  params = new URLSearchParams();
  await mount();
  assert.match(document.body.textContent, /An earlier dismissed story/); assert.ok(button('Restore'), 'Persisted dismissal offers restore after fresh load');
  assert.doesNotMatch(document.body.textContent, /Why the plan changed/, 'Pitch paragraphs stay inside the optional details dialog');
  assert.ok(document.querySelector('[aria-label="Polish this post: Prepared story 3"]'),'Portfolio story stays available');
  assert.ok(document.querySelector('[aria-label="From your projects"]'), 'Additional stories are exposed without a disclosure');
  assert.equal(document.querySelectorAll('img[src="https://fixture.test/3.jpg"]').length, 1, 'Portfolio candidate is not duplicated in recommendations');
  const tabs = document.querySelectorAll('[role="tab"]');
  await act(async () => tabs[0].dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
  assert.match(navigation.at(-1), /tab=progress/); assert.equal(document.activeElement.id, 'studio-tab-progress');
  params = new URLSearchParams(navigation.at(-1).split('?')[1]);
  await act(async () => root.render(React.createElement(ReadinessStudio)));
  assert.equal(document.querySelector('[aria-selected="true"]').textContent, 'In progress');
  assert.ok(document.querySelector('[data-saved-work]'));
  await unmount();
  const currentVersion = { ...make(7), version: 3, draft: { ...make(7).draft, headline: 'Current edited headline' } };
  const historicalVersion = { ...make(7), version: 1, draft: { ...make(7).draft, headline: 'Original exported headline', caption: 'The original export copy.' } };
  data = { candidates: [currentVersion], developing: [], exports: [{ candidate: historicalVersion, needsReview: true, canDownload: false }], inProgress: [] };
  params = new URLSearchParams('tab=exports&candidate=candidate-7&candidateVersion=1');
  await mount();
  assert.equal(document.querySelector('input').value, 'Original exported headline', 'Historical export URL selects its exact persisted version');
  assert.equal(document.querySelector('input').readOnly, true);
  assert.equal(button('Download post'), undefined, 'An old export never downloads the current replacement');
  assert.equal(button('Save draft'), undefined);
  params = new URLSearchParams('candidate=candidate-7');
  await act(async () => root.render(React.createElement(ReadinessStudio)));
  assert.equal(document.querySelector('input').value, 'Current edited headline', 'Current candidate URL still opens the latest version');
  assert.equal(document.querySelector('input').readOnly, false);
  await unmount();
  const published = { ...make(8), confirmedPublishedAt: '2026-09-21T12:00:00.000Z' };
  data = { candidates: [], developing: [], exports: [], inProgress: [{ candidate: published, needsReview: false, canDownload: false }] };
  params = new URLSearchParams('tab=progress');
  await mount();
  assert.match(document.body.textContent, /Publication recorded/, 'Publication without a stored download remains honestly visible in In progress');
  await act(async () => button('View saved work').click());
  assert.equal(document.querySelector('input').readOnly, true, 'Recorded publication opens as retained read-only work');
  assert.equal(button('Download post'), undefined);
  assert.equal(button('Save draft'), undefined);
  await unmount();
  await mount(React.createElement(workspace.StudioPhoto, { images: [{ id: 'first', url: '/first.jpg' }, { id: 'second', url: '/second.jpg' }], alt: 'Approved room' }));
  await act(async () => document.querySelector('img').dispatchEvent(new dom.window.Event('error')));
  assert.match(document.querySelector('img').src, /second.jpg$/);
  await act(async () => document.querySelector('img').dispatchEvent(new dom.window.Event('error')));
  assert.equal(document.querySelector('img'), null); assert.match(document.body.textContent, /Source image unavailable/);
  await unmount();
  console.log('Readiness UI checks passed: 0/1/2/3+ ceilings, mixed readiness, exact configurator handoff, persisted dismissal, portfolio deduplication, keyboard tabs, authorized image fallback and versioned exports.');
}
interactions().catch(error => { console.error(error); process.exitCode = 1; });

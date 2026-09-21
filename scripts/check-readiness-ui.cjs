const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const candidate = { id: 'c', version: 1, sourceVersion: 's', readiness: 'quick', thesis: 'A considered decision', audienceValue: 'Why the plan changed', rationale: 'Specific source',
  projectIds: ['p'], format: 'single_image', visuals: [{ id: 'image', url: 'https://fixture.test/photo.jpg', role: 'hero', reason: 'Shows the result' }],
  evidence: [{ id: 'e', text: 'We changed the plan.', tier: 'direct' }],
  draft: { headline: 'The new plan', caption: 'The room opened up.', credits: { designer: 'Designer', photographer: 'Photographer' } },
  blockers: [{ id: 'b', kind: 'truth', question: 'What changed?' }], reasons: ['More source material needed'] };
let calls = [], destinations = [], dismissed = [];
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, document: { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } }, require: id => id in mocks ? mocks[id] : require(id), console, crypto: require('node:crypto').webcrypto,
    fetch: async (url, options) => { calls.push({ url, body: options?.body && JSON.parse(options.body) }); return { ok: true, json: async () => url.endsWith('/export') ? { images: [{ name: 'slide.jpg', dataUrl: 'data:image/jpeg;base64,eA==' }], caption: 'Caption', filename: 'post.zip' } : options?.method === 'PATCH' ? { candidate: { ...candidate, readiness: 'ready', version: 2, blockers: [{ ...candidate.blockers[0], answer: 'Verified' }] } } : { candidates: [candidate], developing: [], dismissed } }; },
  });
  return exports;
}
const configurator = load('src/components/publishing-studio/CandidateConfigurator.tsx', { jszip: { default: class Zip { file() {} async generateAsync() { return 'blob'; } } } });
let html = renderToStaticMarkup(React.createElement(configurator.CandidateConfigurator, { candidate, onChange() {}, onClose() {} }));
assert.match(html, /What changed/); assert.match(html, /We changed the plan/); assert.match(html, /Photography: Photographer/);
assert.match(html, /disabled="">Download post/); assert.match(html, /does not publish to social media/);
assert.match(html, /aspect-\[4\/5\]/); assert.match(html, /maxLength="180"/); assert.match(html, /maxLength="2200"/);
assert.doesNotMatch(html, /Keep this direction/);
async function interactions() {
  const { JSDOM } = require('jsdom'), { createRoot } = require('react-dom/client'), { act } = React;
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://fixture.test' });
  global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.getElementById('root'));
  let current = { ...candidate, readiness: 'ready', blockers: [] };
  await act(async () => root.render(React.createElement(configurator.CandidateConfigurator, { candidate: current, onChange() {}, onClose() {} })));
  assert.equal(calls.length, 0, 'Opening a configured candidate does not generate or mutate');
  const buttons = () => [...document.querySelectorAll('button')];
  assert.equal(buttons().find(button => button.textContent === 'Record publication').disabled, true);
  await act(async () => buttons().find(button => button.textContent === 'Download post').click());
  assert.equal(calls[0].body.version, 1); assert.equal(calls[0].body.sourceVersion, 's'); assert.match(calls[0].url, /\/export$/);
  await act(async () => root.unmount());
  dismissed = [{ ...candidate, id: 'dismissed-story', thesis: 'An earlier dismissed story', dismissed: true }];
  const { ReadinessStudio } = load('src/components/publishing-studio/ReadinessStudio.tsx', {
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    'next/navigation': { useRouter: () => ({ replace() {} }), useSearchParams: () => new URLSearchParams() },
    '@/lib/publishing-studio/readiness/types': { DISMISSAL_REASONS: [] },
    './CandidateConfigurator': configurator,
  });
  const studioRoot = createRoot(document.getElementById('root'));
  await act(async () => studioRoot.render(React.createElement(ReadinessStudio)));
  assert.match(document.body.textContent, /Prepared caption.*The room opened up\./, 'The actual prepared caption is visible before opening the story');
  assert.match(document.body.textContent, /An earlier dismissed story/, 'Initial API load restores persisted dismissed stories');
  assert.ok(buttons().some(button => button.textContent === 'Restore'), 'Persisted dismissal offers Restore after a fresh mount');
  await act(async () => studioRoot.unmount());
  console.log('Readiness UI checks passed: source and credit visibility, readiness gating, publication attestation, exact versioned export and no opening mutations.');
}
interactions().catch(error => { console.error(error); process.exitCode = 1; });

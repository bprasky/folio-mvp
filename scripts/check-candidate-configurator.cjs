const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://fixture.test/designer/studio' });
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator;
global.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const { Simulate } = require('react-dom/test-utils');
const { act } = React;
const fixture = { shape:'decision', id: 'story', version: 1, sourceVersion: 'source', readiness: 'quick', thesis: 'A considered room', audienceValue: 'Show the decision behind the room.', source: { title: 'A home' },
  projectIds: ['p'], format: 'single_image', visuals: [{ id: 'image', url: '/fixture.jpg', role: 'hero', reason: 'The finished room' }],
  draft: { headline: 'A considered room', caption: 'The original saved caption.', credits: { designer: 'Designer', photographer: 'Photographer' } },
  claims: [{ id: 'claim', text: 'Closed storage keeps the room calm.', evidenceIds: ['e'], status: 'supported' }],
  evidence: [{ id: 'e', text: 'Published project detail.', tier: 'direct' }],
  blockers: [{ id: 'question', kind: 'truth', question: 'Which decision changed the room?' }], reasons: ['The answer still needs clarification.'] };
const calls = [];
const exported = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/publishing-studio/CandidateConfigurator.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText,
 { exports: exported, require: id => { if(id === '@/lib/publishing-studio/opportunities') { const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/publishing-studio/opportunities.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URLSearchParams});return exports;} return require('./studio-publication-test-import.cjs')(id) || require(id); }, window: dom.window, document: dom.window.document, console,
   fetch: (url, options) => new Promise(resolve => calls.push({ url, body: JSON.parse(options.body), resolve })) });
let candidate = structuredClone(fixture), readOnly = false, closed = 0;
let root;
const render = () => root.render(React.createElement(exported.CandidateConfigurator, { candidate, readOnly,
  onChange: saved => { candidate = saved; render(); }, onClose: () => { closed++; } }));
const button = text => [...document.querySelectorAll('button')].find(node => node.textContent === text);
const change = async (node, value) => act(async () => Simulate.change(node, { target: { value } }));
const click = text => act(async () => { assert.ok(button(text), `Missing ${text}`); button(text).click(); });
const key = () => `folio:studio-unsaved:story:${candidate.version}:source`;
async function mount() {
  if (root) await act(async () => root.unmount());
  root = createRoot(document.getElementById('root'));
  await act(async () => render());
}
async function resolveSave(saved, ok = true, error = '') {
  await act(async () => calls.at(-1).resolve({ ok, json: async () => ok ? { candidate: saved } : { error } }));
}
const unloadIsBlocked = () => !window.dispatchEvent(new window.Event('beforeunload', { cancelable: true }));
const assertChoices = () => ['Save draft and exit', 'Discard changes', 'Keep editing'].forEach(text => assert.ok(button(text), text));
(async () => {
  await mount();
  assert.equal(calls.length, 0);
  assert.equal(button('Save draft').disabled, true, 'Opening an unchanged post cannot create a saved draft');
  assert.equal(unloadIsBlocked(), false, 'An unchanged post must not prompt on reload');
  await click('Back to stories');
  assert.equal(closed, 1);
  assert.equal(document.querySelector('[role="alert"]'), null);
  assert.equal(calls.length, 0, 'Opening and closing a story performs no request');
  await mount();
  await change(document.querySelector('input'), 'Temporary headline');
  assert.equal(button('Save draft').disabled, false);
  await change(document.querySelector('input'), fixture.draft.headline);
  assert.equal(button('Save draft').disabled, true, 'Reverting an edit restores clean state');
  assert.equal(unloadIsBlocked(), false);
  await click('Back to stories'); assert.equal(closed, 2);
  assert.equal(calls.length, 0);

  await mount();
  await change(document.querySelector('input'), 'My edited headline');
  await change(document.querySelector('#candidate-answer'), 'An unfinished answer');
  await mount();
  assert.equal(document.querySelector('input').value, 'My edited headline', 'Forced remount recovers unsaved copy');
  assert.equal(document.querySelector('#candidate-answer').value, 'An unfinished answer');
  assert.match(document.body.textContent, /Recovered unsaved changes/);
  assert.equal(calls.length, 0, 'Recovery does not submit or save');
  await click('Back to stories'); assert.equal(closed, 2); assertChoices();
  assert.equal(unloadIsBlocked(), true);
  await click('Keep editing');
  assert.equal(button('Discard changes'), undefined);

  const anchor = document.createElement('a'); anchor.href = '/designer'; anchor.textContent = 'Dashboard'; document.body.append(anchor);
  const navigation = new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  await act(async () => { assert.equal(anchor.dispatchEvent(navigation), false, 'Ordinary navigation is intercepted while dirty'); });
  assertChoices(); assert.equal(calls.length, 0);
  await click('Keep editing'); anchor.remove();
  const currentUrl = window.location.href;
  window.history.pushState({ earlier: true }, '', '/designer');
  await act(async () => window.dispatchEvent(new window.PopStateEvent('popstate')));
  assert.equal(window.location.href, currentUrl, 'Back navigation restores the editing URL while awaiting a choice');
  assertChoices();
  await click('Keep editing');

  await click('Back to stories');
  await click('Save draft and exit');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.action, 'draft');
  assert.equal(calls[0].body.headline, 'My edited headline');
  assert.equal(calls[0].body.caption, undefined, 'Unchanged copy is not reattributed');
  assert.deepEqual(calls[0].body.pendingAnswer, { blockerId: 'question', text: 'An unfinished answer' });
  assert.equal(calls[0].body.version, 1);
  assert.equal(button('Back to stories').disabled, true);
  assert.equal(document.querySelector('input').disabled, true);
  assert.equal(button('Discard changes').disabled, true, 'Cannot discard while save is in flight');
  await resolveSave(null, false, 'Source changed; your edit is still here.');
  assert.equal(closed, 2, 'Save failure never exits');
  assert.equal(document.querySelector('input').value, 'My edited headline');
  assert.equal(document.querySelector('#candidate-answer').value, 'An unfinished answer');
  assert.match(document.body.textContent, /Unsaved changes/); assertChoices();
  assert.match(window.sessionStorage.getItem(key()), /An unfinished answer/);
  await click('Save draft and exit');
  const savedPartial = { ...candidate, version: 2, draft: { ...candidate.draft, headline: 'My edited headline', pendingAnswer: { blockerId: 'question', text: 'An unfinished answer' } } };
  await resolveSave(savedPartial);
  assert.equal(closed, 3, 'Successful draft save exits once');
  assert.equal(candidate.readiness, 'quick');
  assert.equal(candidate.blockers[0].answer, undefined, 'Draft saving does not complete the question');
  assert.equal(window.sessionStorage.getItem('folio:studio-unsaved:story:1:source'), null);
  assert.equal(window.sessionStorage.getItem(key()), null, 'Persisted partial answers need no unsaved recovery buffer');

  await mount();
  assert.equal(document.querySelector('input').value, 'My edited headline');
  assert.equal(document.querySelector('#candidate-answer').value, 'An unfinished answer', 'Partial draft resumes from the server snapshot');
  assert.equal(button('Save draft').disabled, true);
  assert.equal(button('Download post').disabled, true);
  assert.equal(unloadIsBlocked(), false);
  await click('Back to stories'); assert.equal(closed, 4);
  await mount();
  await click('Save and continue');
  assert.equal(calls.at(-1).body.action, 'answer');
  assert.equal(calls.at(-1).body.version, 2);
  assert.equal(calls.at(-1).body.blockerId, 'question');
  const savedNonready = { ...candidate, version: 3, readiness: 'developing', draft: { ...candidate.draft }, blockers: [{ ...candidate.blockers[0], answer: 'An unfinished answer' }] };
  delete savedNonready.draft.pendingAnswer;
  await resolveSave(savedNonready);
  assert.match(document.body.textContent, /Needs more source material/);
  assert.equal(button('Download post').disabled, true, 'Server nonready response is never overridden');
  assert.equal(document.querySelector('#candidate-answer'), null);
  assert.match(document.body.textContent, /An unfinished answer/, 'Completed answer remains inspectable');
  assert.equal(button('Save draft').disabled, true);

  await change(document.querySelector('input'), 'Discard this revision');
  const requestsBeforeDiscard = calls.length;
  await click('Back to stories'); await click('Discard changes');
  assert.equal(closed, 5);
  assert.equal(calls.length, requestsBeforeDiscard);
  assert.equal(window.sessionStorage.getItem(key()), null);
  await mount();
  assert.equal(document.querySelector('input').value, 'My edited headline', 'Discard preserves the last saved version');

  candidate = { ...structuredClone(fixture), format: 'carousel', visuals: [...fixture.visuals, { id: 'second', url: '/second.jpg', role: 'detail', reason: 'Detail' }] };
  await mount();
  const originals = candidate.visuals.map(image => image.id);
  const beforeReorder = calls.length;
  await act(async () => document.querySelector('[aria-label="Move image 1 later"]').click());
  assert.equal(calls.length, beforeReorder, 'Reordering is local until explicit save');
  assert.equal(document.querySelector('figure img').getAttribute('src'), '/second.jpg');
  assert.deepEqual(candidate.visuals.map(image => image.id), originals, 'The saved candidate is untouched');
  await click('Back to stories'); assertChoices(); await click('Discard changes');
  await mount();
  assert.equal(document.querySelector('figure img').getAttribute('src'), '/fixture.jpg');
  assert.equal(button('Save draft').disabled, true);
  await act(async () => document.querySelector('[aria-label="Move image 1 later"]').click());
  await act(async () => document.querySelector('[aria-label="Move image 1 later"]').click());
  assert.equal(button('Save draft').disabled, true, 'Restoring photo order restores clean state');
  await act(async () => document.querySelector('[aria-label="Move image 1 later"]').click());
  await click('Save draft');
  assert.deepEqual(calls.at(-1).body.imageIds, ['second', 'image']);
  assert.equal(calls.at(-1).body.headline, undefined);
  await resolveSave({ ...candidate, version: 2, visuals: [...candidate.visuals].reverse() });
  assert.equal(button('Save draft').disabled, true);
  assert.equal(document.querySelector('figure img').getAttribute('src'), '/second.jpg');
  assert.equal(unloadIsBlocked(), false);

  candidate = structuredClone(fixture); window.sessionStorage.clear();
  await mount();
  const beforeHeadlineChoice = calls.length;
  await click('Closed storage keeps the room calm.');
  assert.equal(document.querySelector('input').value, 'Closed storage keeps the room calm.');
  assert.equal(candidate.draft.headline, fixture.draft.headline, 'Choosing an alternative leaves the saved candidate unchanged');
  assert.equal(calls.length, beforeHeadlineChoice, 'Choosing supported copy is local until explicit Save');
  assert.equal(button('Save draft').disabled, false, 'Choosing an alternative marks the draft dirty');
  assert.equal(unloadIsBlocked(), true);
  await click('Save draft');
  assert.equal(calls.length, beforeHeadlineChoice + 1);
  assert.equal(calls.at(-1).body.headline, 'Closed storage keeps the room calm.');
  assert.equal(calls.at(-1).body.caption, undefined, 'Headline choice does not rewrite the caption');
  await resolveSave({ ...candidate, version: 2, draft: { ...candidate.draft, headline: 'Closed storage keeps the room calm.' } });
  assert.equal(button('Save draft').disabled, true);

  candidate = { ...savedNonready, readiness: 'ready' }; readOnly = true;
  await mount();
  const beforeRead = calls.length;
  assert.equal(button('Save draft'), undefined); assert.equal(button('Download post'), undefined);
  assert.equal(document.querySelector('input').readOnly, true);
  assert.equal(document.querySelector('[aria-label="Supported headline alternatives"]'), null, 'Historical versions expose no editable alternative chips');
  assert.match(document.body.textContent, /Saved version · read only/);
  assert.match(document.body.textContent, /An unfinished answer/);
  await click('Back to stories');
  assert.equal(calls.length, beforeRead, 'Reading history never mutates');
  candidate = { ...structuredClone(fixture), readiness: 'ready', blockers: [] }; readOnly = false;
  window.sessionStorage.clear();
  await mount();
  const destination = document.querySelector('input[placeholder="For example, Instagram"]');
  assert.equal(destination.value, '', 'Publication destination is never guessed');
  assert.equal(button('Record publication').disabled, true);
  await change(destination, 'LinkedIn');
  await act(async () => Simulate.change(document.querySelector('input[type="checkbox"]'), { target: { checked: true } }));
  await click('Record publication');
  assert.equal(calls.at(-1).body.publicationDestination, 'LinkedIn');
  await resolveSave({ ...candidate, version: 2, confirmedPublishedAt: '2026-09-23T12:00:00Z', confirmedPublicationDestination: 'LinkedIn' });
  assert.match(document.body.textContent, /published on LinkedIn/);
  await act(async () => root.unmount());
  console.log('PASS configurator: clean and reverted exits, three-way dirty exits, failed-save retention, explicit partial draft save/resume, authoritative readiness, local image ordering, recovery, link/back/reload guards, and read-only history.');
})().catch(error => { console.error(error); process.exitCode = 1; });

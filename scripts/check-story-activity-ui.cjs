const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://fixture.test' });
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
global.navigator = dom.window.navigator;
const { createRoot } = require('react-dom/client');
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, console, Error, navigator: {}, require: name => name === '@/lib/publishing-studio/activities' ? activities : name === './StoryConfigurator' ? load('src/components/publishing-studio/StoryConfigurator.tsx') : require(name) });
  return exports;
}
const activities = load('src/lib/publishing-studio/activities.ts');
const { StoryActivity } = load('src/components/publishing-studio/StoryActivity.tsx');
const context = { designerName: 'Designer', firmName: 'Studio', profile: { hasBio: true, hasPointOfView: true }, projects: [] };
const definition = activities.createActivity({ subject: 'designer', format: 'qa', topic: '', destinations: ['folio', 'instagram'] }, context);
  definition.questionSource = 'personalized'; // Assembly fixture; generation grounding has separate tests.
  definition.questions.forEach((q,i) => { q.prompt = 'Fixture question '+(i+1)+'?'; });
let snapshot = { id: 'activity', revision: 1, definition, answers: [], reviewed: false, draft: null };
const calls = []; let closeCount = 0;
const persistence = { create: async () => snapshot, save: next => new Promise((resolve, reject) => calls.push({ next, resolve, reject })) };
const button = name => [...document.querySelectorAll('button')].find(item => item.textContent === name);
async function click(name) { assert(button(name), name); await React.act(async () => button(name).click()); }
async function typeAnswer(text) {
  const input = document.querySelector('textarea');
  await React.act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(input, text); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
}
async function main() {
  const root = createRoot(document.getElementById('root'));
  await React.act(async () => root.render(React.createElement(StoryActivity, { context, persistence, onClose() {} })));
  assert.equal(document.querySelectorAll('select').length, 0, 'Topic choices must be visible');
  assert.equal(document.querySelectorAll('input').length, 0, 'No angle or destination fields');
  assert(document.body.textContent.includes('Firm History'));
  await click('Next: Story type');
  assert(button('Prepare my interview'));
  assert.equal(document.querySelectorAll('select').length, 0);
  await React.act(async () => root.render(React.createElement(StoryActivity, { key: 'interview', context, persistence, initial: snapshot, onClose: () => closeCount++ })));
  assert.equal(document.querySelectorAll('textarea').length, 1);
  await typeAnswer('The table was the starting point.');
  await click('Save progress');
  assert.equal(calls[0].next.answers[0].text, 'The table was the starting point.');
  await React.act(async () => calls[0].reject(new Error('Connection lost. Retry saving.')));
  assert.equal(document.querySelector('textarea').value, 'The table was the starting point.');
  assert(document.body.textContent.includes('Connection lost'));
  await click('Save & return to Studio');
  assert.equal(closeCount, 0, 'Must not exit before save succeeds');
  snapshot = { ...calls[1].next, revision: 2 };
  await React.act(async () => calls[1].resolve(snapshot));
  assert.equal(closeCount, 1);
  await React.act(async () => root.render(React.createElement(StoryActivity, { key: 'resumed', context, persistence, initial: snapshot, onClose() {} })));
  assert(document.body.textContent.includes('Question 2 of 5'), 'Resume at first unanswered question');
  await click('See all questions and answers');
  assert(button('Prepare my draft').disabled);
  assert(document.body.textContent.includes('The table was the starting point.'));
  snapshot = { ...snapshot, answers: definition.questions.map(q => ({ questionId: q.id, text: 'We tested the actual turning space with a full size template before deciding where the dining table would sit.' })), reviewed: false };
  await React.act(async () => root.render(React.createElement(StoryActivity, { key: 'complete', context, persistence, initial: snapshot, onClose() {} })));
  await click('See all questions and answers');
  assert(button('Prepare my draft').disabled, 'Complete answers still need review');
  await React.act(async () => document.querySelector('input[type=checkbox]').click());
  await click('Prepare my draft');
  const prepared = calls.at(-1);
  assert.equal(prepared.next.draft.entries.length, 5);
  await React.act(async () => prepared.resolve({ ...prepared.next, revision: 3 }));
  assert(document.body.textContent.includes('Draft preview'));
  await click('Review or edit answers'); await click('Edit answer 1');
  await typeAnswer('An edited original answer.');
  await click('See all questions and answers');
  assert(button('Prepare my draft').disabled, 'Editing invalidates review and old draft');
  assert.equal(document.querySelector('input[type=checkbox]').checked, false);
  await React.act(async () => root.unmount());
  console.log('PASS interview UI: one question, retained answers on failure, save-before-exit, resume, review requirement and edit invalidation.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

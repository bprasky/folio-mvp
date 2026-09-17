const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports }, { filename: file });
  return exports;
}
const { createActivity, activityProgress, prepareActivityDraft, profileActivitySuggestions } = load('src/lib/publishing-studio/activities.ts');
const { isArrivalSafe } = load('src/lib/interview/prompts/validateQuestion.ts');
const context = { designerName: 'Example Designer', firmName: 'Example Studio', profile: { hasBio: false, hasPointOfView: false }, projects: [{ id: 'p1', title: 'Garden House', rooms: [{ id: 'r1', name: 'Living room' }] }] };
const brief = { subject: 'designer', format: 'twenty_questions' };
for (const subject of ['designer', 'firm', 'project']) {
  const definition = createActivity({ ...brief, subject, ...(subject === 'project' ? { projectId: 'p1', roomId: 'r1' } : {}) }, context);
  definition.questionSource = 'personalized'; // Assembly fixture; generation grounding has separate tests.
  definition.questions.forEach((q,i) => { q.prompt = 'Fixture question '+(i+1)+'?'; });
  assert.equal(definition.questions.length, 20);
  assert.equal(new Set(definition.questions.map(q => q.id)).size, 20);
  definition.questions.forEach(q => assert(isArrivalSafe(q.prompt), q.prompt));
  const answers = definition.questions.map((q, index) => ({ questionId: q.id, text: `My original answer ${index + 1}.` }));
  assert.equal(activityProgress(definition, []).ready, false);
  assert.equal(activityProgress(definition, answers.slice(0, 19)).ready, false);
  assert.throws(() => prepareActivityDraft(definition, answers, false), /Review/);
  assert.throws(() => prepareActivityDraft(definition, answers.slice(0, 19), true), /Finish/);
  const draft = prepareActivityDraft(definition, answers, true);
  assert.equal(draft.entries.length, 20);
  draft.entries.forEach((entry, index) => assert.equal(entry.answer, answers[index].text));
  assert.throws(() => activityProgress(definition, [...answers, answers[0]]), /Invalid/);
  assert.throws(() => activityProgress(definition, [{ questionId: 'forged', text: 'Invented answer' }]), /Invalid/);
  assert.throws(() => activityProgress(definition, [{ questionId: answers[0].questionId, text: 'x'.repeat(8001) }]), /Invalid/);
  assert.equal(createActivity({ ...brief, subject: 'project', projectId: 'p1', roomId: 'r1' }, context).subjectLabel, 'Living room at Garden House');
}
for (const format of ['qa', 'material', 'method', 'history']) {
  const definition = createActivity({ ...brief, subject: format === 'history' ? 'firm' : 'designer', format }, context);
  definition.questionSource = 'personalized';
  definition.questions.forEach((q,i) => { q.prompt = 'Fixture question '+(i+1)+'?'; });
  assert.equal(definition.questions.length, 5);
  definition.questions.forEach(q => assert(isArrivalSafe(q.prompt), q.prompt));
  const answers = definition.questions.map(q => ({ questionId: q.id, text: 'We used a full size sample to verify the turning space beside the table before installation.' }));
  assert.equal(prepareActivityDraft(definition, answers, true).entries.length, 5);
}
assert.throws(() => createActivity({ ...brief, subject: 'project', projectId: 'foreign' }, context), /available/);
assert.throws(() => createActivity({ ...brief, subject: 'project', projectId: 'p1', roomId: 'foreign' }, context), /room/);
assert.throws(() => createActivity({ ...brief, projectId: 'p1' }, context), /do not belong/);
assert.throws(() => createActivity({ ...brief, format: 'history' }, context), /not available/);


assert.equal(profileActivitySuggestions(context).length, 2);
assert.equal(profileActivitySuggestions({ ...context, profile: { hasBio: true, hasPointOfView: true } }).length, 0);
console.log('PASS activities: 3 subject-specific 20-question structures, scoped room/context, authored prompts, completed/reviewed gate, exact answers, bounds and truthful profile gaps.');

for(const format of ['material','method']) assert.throws(() => createActivity({...brief,subject:'firm',format},context), /not available/);

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const fixtures = require('./fixtures/project-guide-quality.cjs');
let request, response, calls = 0;
const cache = new Map();
function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, console, Error, require(name) {
    if (name === 'server-only') return {};
    if (name === '@/lib/interview/guided/decision') return { parseGuidedJson: raw => typeof raw === 'string' ? JSON.parse(raw) : raw,
      callGuidedModel: async value => { request = value; calls++; if (response instanceof Error) throw response; return JSON.stringify(response); } };
    if (name.startsWith('@/')) return load(path.resolve('src', name.slice(2)) + '.ts');
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
    return require(name);
  } }, { filename: file }); return exports;
}
async function main() {
  const planner = load('src/lib/live-interview/project-guide-planner.ts');
  const base = fixtures[1].input;
  for (const stage of ['upload', 'tagging', 'interview_new', 'interview_resume', 'interview_complete']) {
    const reply = await planner.planProjectGuide({ ...base, stage, userText: '' });
    assert.equal(reply.action, 'none'); assert.ok(reply.reply.length > 10);
  }
  const skippedAll = await planner.planProjectGuide({ ...base, stage: 'interview_complete', answeredCount: 0, remainingQuestionCount: 0, userText: '' });
  assert.match(skippedAll.reply, /no project answers are saved yet/);
  assert.doesNotMatch(skippedAll.reply, /enough/i, 'Exhausting questions by skipping is not evidence of a usable story.');
  assert.equal(skippedAll.action, 'none', 'A greeting may offer a restart but cannot perform or request one automatically.');
  assert.match(planner.projectGuideGreeting({ ...base, stage: 'interview_complete', answeredCount: 1 }), /enough from your interview/);
  assert.equal(calls, 0, 'Every first greeting is immediate and free of generation calls.');
  const ambiguous = await planner.planProjectGuide(fixtures.find(f => f.id === 'ambiguous-resume').input);
  assert.equal(ambiguous.action, 'none'); assert.equal(calls, 0, 'A bare yes cannot choose between resume and restart.');
  const directActions = { 'resume interview': 'resume_interview', 'start the interview': 'start_interview', 'start over': 'start_over', 'add more': 'add_more', 'upload photos': 'open_upload', 'tag photos': 'open_tagging' };
  for (const [userText, action] of Object.entries(directActions)) {
    assert.equal((await planner.planProjectGuide({ ...base, userText, allowedActions: [action] })).action, action);
  }
  assert.equal(calls, 0, 'Six explicit whole-utterance actions do not invoke a model.');
  response = { action: 'none', reply: 'Your saved answers stay in place until you explicitly confirm a restart.' };
  for (const userText of ['do not start over', 'should I start over?', 'I said start over yesterday', 'start over?', 'yes', 'continue']) {
    assert.equal((await planner.planProjectGuide({ ...base, userText })).action, 'none');
  }
  assert.equal(calls, 6, 'Negations, embedded phrases, questions and ambiguous controls are not direct commands.');
  await planner.planProjectGuide({ ...base, userText: 'start over', allowedActions: ['none'] });
  assert.equal(calls, 7, 'Direct commands never bypass allowed actions.'); calls = 0;
  assert.match(planner.projectGuideGreeting({ ...base, stage: 'tagging', unreviewedPhotoCount: 0 }), /5 of your 12 photos have product tags/);
  assert.doesNotMatch(planner.projectGuideGreeting({ ...base, stage: 'tagging', unreviewedPhotoCount: 0 }), /12.*tagged|all.*tagged/i);
  response = { action: 'resume_interview', reply: 'Let’s pick up where we left off.' };
  const resumed = await planner.planProjectGuide({ ...base, userText: 'Pick up where we left off.' });
  assert.equal(resumed.action, 'resume_interview'); assert.equal(calls, 1);
  assert.equal(request.thinking.type, 'disabled'); assert.ok(request.output_config.format);
  response = { action: 'start_over', reply: 'I can show you the start-over confirmation.' };
  assert.equal((await planner.planProjectGuide({ ...base, userText: 'Start again.' })).action, 'start_over');
  response = { action: 'start_interview', reply: 'Starting now.' };
  assert.equal((await planner.planProjectGuide(base)).action, 'none', 'Unavailable model actions fail closed.');
  const detailInput = fixtures.find(f => f.id === 'completed-add-detail').input;
  const detailText = 'We kept a separate kitchen instead.';
  assert.equal(planner.validateProjectGuideReply({ action: 'add_more', reply: 'You can review that detail before adding it.', detailText }, detailInput).detailText, detailText);
  assert.throws(() => planner.validateProjectGuideReply({ action: 'add_more', reply: 'A detail.', detailText: 'We designed a marble kitchen.' }, detailInput), /exact passage/);
  assert.throws(() => planner.validateProjectGuideReply({ action: 'none', reply: 'A detail.', detailText }, detailInput), /exact passage/);
  response = { action: 'none', reply: 'A reply.', canonicalAnswer: 'secret evidence' };
  assert.equal((await planner.planProjectGuide(base)).action, 'none');
  assert.throws(() => planner.validateProjectGuideReply(response, base), /unrecognized/i, 'The guide cannot add editorial fields.');
  response = new Error('provider unavailable');
  assert.equal((await planner.planProjectGuide(base)).action, 'none');
  await assert.rejects(planner.planProjectGuide({ ...base, taggedPhotoCount: 13 }), /counts/i);
  await assert.rejects(planner.planProjectGuide({ ...base, userText: 'a'.repeat(2001) }));
  const tone = load('src/lib/interview/prompts/editorialTone.ts');
  assert.ok(planner.PROJECT_GUIDE_PROMPT.includes(tone.FOLIO_TONE));
  assert.ok(planner.PROJECT_GUIDE_PROMPT.includes(tone.EDITORIAL_BANNED_PHRASES));
  assert.ok(planner.PROJECT_GUIDE_PROMPT.includes(tone.EDITORIAL_ACCURACY_RULES));
  assert.match(planner.PROJECT_GUIDE_PROMPT, /not an editorial answer/);
  assert.match(planner.PROJECT_GUIDE_PROMPT, /recordingAvailable is true/);
  assert.match(planner.PROJECT_GUIDE_PROMPT, /Never promise automatic clipping/);
  assert.match(planner.projectGuideGreeting({...base,stage:'interview_new',recordingAvailable:true}),/private recording/);
  assert.doesNotMatch(planner.projectGuideGreeting({...base,stage:'interview_new',recordingAvailable:false}),/clips/);
  console.log('Project guide planner: five deterministic greetings, allowed-action and structured-output boundaries, provider failure, count bounds, and canonical tone pass.');
}
main().catch(e => { console.error(e); process.exitCode = 1; });

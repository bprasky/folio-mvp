// Execute the actual installation guard with in-memory mutations only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const checker = fs.readFileSync('scripts/check-spotlight-durable-install.cjs', 'utf8');
function run(mutate = (_path, text) => text) {
  vm.runInNewContext(checker, {
    require: name => name === 'node:fs' ? {
      readFileSync: (path, encoding) => mutate(path, fs.readFileSync(path, encoding)),
    } : require(name),
    process: { argv: [], exit: () => { throw new Error('Unexpected guard early exit'); } },
    console: { log() {} },
  });
}
run();
assert.throws(() => run((path, text) => path === 'prisma/migrations/20260924120000_org_member_posting_policy/migration.sql'
  ? text + '\nSELECT 1;\n' : text), /Approved firm posting policy SQL/, 'Changed approved firm SQL must fail');
assert.throws(() => run((path, text) => path === 'prisma/schema.prisma'
  ? text.replace(/membersCanPublish\s+Boolean\s+@default\(true\)/, 'membersCanPublish Boolean @default(false)') : text), /Only reviewed schema tokens/, 'Changed approved member posting default must fail');
for (const pathToMutate of ['docs/reviews/story-activities/migration.sql','prisma/migrations/20260921220000_editorial_story_activities/migration.sql']) {
  assert.throws(() => run((path, text) => path === pathToMutate ? text + '\nSELECT 1;\n' : text), /Studio activity SQL/, 'Changed approved or installed SQL must fail');
}
assert.throws(() => run((path, text) => path === 'prisma/schema.prisma'
  ? text.replace(/(model EditorialStory \{[\s\S]*?ownerId\s+)String/, '$1Int') : text), /Only reviewed schema tokens/, 'Changed activity fields must fail');
assert.throws(() => run((path, text) => path === 'prisma/schema.prisma'
  ? text.replace(/studioStoryAnswers\s+EditorialStoryAnswer\[\]/, 'studioStoryAnswers EditorialStoryAnswer?') : text), /Only reviewed schema tokens/, 'Changed activity inverse relations must fail');
assert.throws(() => run((path, text) => path === 'docs/reviews/story-activities/schema.prisma.txt'
  ? text.replace('ownerId String', 'ownerId Int') : text), /Approved Studio activity model artifact/, 'Editing the activity proposal cannot authorize schema changes');
assert.throws(() => run((path, text) => path === 'prisma/schema.prisma'
  ? text.replace(/(model StudioCandidate \{[\s\S]*?currentVersion\s+)Int/, '$1String') : text), /Only reviewed schema tokens/, 'A changed readiness field must fail');
assert.throws(() => run((path, text) => path === 'prisma/schema.prisma'
  ? text + '\nmodel UnreviewedModel { id String @id }\n' : text), /Only reviewed schema tokens/, 'An unreviewed model must fail');
assert.throws(() => run((path, text) => path === 'prisma/schema.prisma'
  ? text.replace(/(model SpotlightAnswerRevision \{[\s\S]*?revisionNumber\s+)Int/, '$1String') : text), /Only reviewed schema tokens/, 'Historical Spotlight token protection must remain');
assert.throws(() => run((path, text) => path === 'docs/reviews/studio-readiness-proposed.prisma'
  ? text.replace('currentVersion Int', 'currentVersion String') : text), /Approved Editorial Readiness model artifact/, 'Editing a proposal cannot authorize schema changes');
for (const model of ['LiveInterviewSession', 'InterviewMediaRecord']) {
  assert.throws(() => run((path, text) => path === 'prisma/schema.prisma'
    ? text.replace(new RegExp('(model '+model+' \\{[\\s\\S]*?actorId\\s+)String'), '$1Int') : text), /Only reviewed schema tokens/, 'Changed live actor ownership field must fail');
}
for (const [field, model] of [['liveInterviewSessions', 'LiveInterviewSession'], ['interviewMediaRecords', 'InterviewMediaRecord']]) {
  assert.throws(() => run((path, text) => path === 'prisma/schema.prisma'
    ? text.replace(new RegExp(field+'\\s+'+model+'\\[\\]'), field+' '+model+'?') : text), /Only reviewed schema tokens/, 'Changed live User inverse relation must fail');
}
assert.throws(() => run((path, text) => path === 'prisma/schema.prisma'
  ? text.replace(/(model InterviewMediaRecord \{[\s\S]*?onDelete: )Cascade/, '$1NoAction') : text), /Only reviewed schema tokens/, 'Changed live deletion semantics must fail');
assert.throws(() => run((path, text) => path === 'docs/reviews/live-interviews/schema-proposal.patch'
  ? text.replace(/(actorId\s+)String/, '$1Int') : text), /Approved live interview schema artifact/, 'Editing the live proposal cannot authorize schema changes');
assert.throws(() => run((path, text) => path === 'prisma/migrations/20261001120000_live_interview_private_media/migration.sql'
  ? text + '\nSELECT 1;\n' : text), /Approved live interview SQL/, 'Changed approved live SQL must fail');
console.log('PASS exact installation scope: approved schema accepted; changed fields, inverse relations, deletion semantics, extra model and tampered approval artifacts rejected.');

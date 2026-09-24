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
console.log('PASS exact installation scope: approved schema accepted; changed readiness field, extra model, changed Spotlight field and tampered approval artifact rejected.');

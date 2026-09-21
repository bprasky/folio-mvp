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
assert.throws(() => run((path, text) => path === 'prisma/schema.prisma'
  ? text.replace(/(model StudioCandidate \{[\s\S]*?currentVersion\s+)Int/, '$1String') : text), /Only reviewed schema tokens/, 'A changed readiness field must fail');
assert.throws(() => run((path, text) => path === 'prisma/schema.prisma'
  ? text + '\nmodel UnreviewedModel { id String @id }\n' : text), /Only reviewed schema tokens/, 'An unreviewed model must fail');
assert.throws(() => run((path, text) => path === 'prisma/schema.prisma'
  ? text.replace(/(model SpotlightAnswerRevision \{[\s\S]*?revisionNumber\s+)Int/, '$1String') : text), /Only reviewed schema tokens/, 'Historical Spotlight token protection must remain');
assert.throws(() => run((path, text) => path === 'docs/reviews/studio-readiness-proposed.prisma'
  ? text.replace('currentVersion Int', 'currentVersion String') : text), /Approved Editorial Readiness model artifact/, 'Editing a proposal cannot authorize schema changes');
console.log('PASS exact installation scope: approved schema accepted; changed readiness field, extra model, changed Spotlight field and tampered approval artifact rejected.');

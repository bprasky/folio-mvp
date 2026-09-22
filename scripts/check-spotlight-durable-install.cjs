// Exact reviewed scope; no database connections or environment-file loading.
const fs = require('node:fs');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const assert = require('node:assert/strict');
const baseline = 'e55e8b0434a82174ceaebc2652f7e8dd4c8091b1';
const directory = 'prisma/migrations/20260910210000_add_spotlight_durable_interview';
const hashes = {
  'models.prisma':'2559d6f6f77ccf819912ee9c372fbde79a508fe2bd5e8702f778fa20066b1cad',
  'inverse-fields.txt':'8c38f1cf724c6644d2c26f3c2aba23a18884eef74a2ba906f7d6da4f4d91d84d',
  'schema.patch':'b4adb1c49440f67777d9298975be3310805189608d2f300760adb130beb6f8b9',
  'migration.sql':'50adeaf12a7b402181769746caed685ba3c0a5b58821528f83cffa397e5e2c10',
};
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
for (const [name,value] of Object.entries(hashes)) assert.equal(hash(read('docs/proposals/spotlight-durable-interview/'+name)),value,name);
if(process.argv.includes('--artifacts-only')) { console.log(JSON.stringify({baseline,hashes,pass:true})); process.exit(0); }
assert.equal(hash(read(directory+'/migration.sql')),hashes['migration.sql']);
let expected=execFileSync('git',['show',baseline+':prisma/schema.prisma'],{encoding:'utf8'}).replace(/\r\n/g,'\n');
expected=expected.replace('model User {','model User {\nspotlightAnswerRevisions SpotlightAnswerRevision[] @relation("SpotlightAnsweringUser")');
expected=expected.replace('model ProductSpotlight {','model ProductSpotlight {\nquestions SpotlightQuestion[]');
expected+='\n'+read('docs/proposals/spotlight-durable-interview/models.prisma');
// Separately approved 2026-09-18 completion-date migration; preserve the exact
// full-schema comparison rather than allowing arbitrary Project changes.
expected=expected.replace('model Project {','model Project {\ncompletedYear Int?\ncompletedMonth Int?');
// Separately approved 2026-09-21 Editorial Readiness models. Pin the reviewed
// artifact before adding it to the expected schema: editing the proposal must
// never authorize arbitrary new tokens or weaken the Spotlight comparison.
const readinessModels=read('docs/reviews/studio-readiness-proposed.prisma');
assert.equal(hash(readinessModels),'739c6ad26cd2777ea09a6a4a237425294c4fb9142afacae5c31ad0a043b86874','Approved Editorial Readiness model artifact');
expected+='\n'+readinessModels;
// Separately approved four-table Studio activity batch and inverse relations.
const storyModels=read('docs/reviews/story-activities/schema.prisma.txt');
assert.equal(hash(storyModels),'6558b351f9363ce856ac244ba667e118307ff6d0e81e4c2e5a034790b1c8cd3c','Approved Studio activity model artifact');
const storySqlHash='f9088338b93877bda5646f77b1dce0f19c1af8c895c34796005a0b31f28ef193';
assert.equal(hash(read('docs/reviews/story-activities/migration.sql')),storySqlHash,'Approved Studio activity SQL artifact');
assert.equal(hash(read('prisma/migrations/20260921220000_editorial_story_activities/migration.sql')),storySqlHash,'Installed Studio activity SQL');
const [storyDefinitions, storyInverses]=storyModels.split('// Inverse-only additions to existing model blocks:');
expected+='\n'+storyDefinitions;
for(const [,model,fields] of storyInverses.matchAll(/\/\/ (User|Organization|EditorialQueueItem|ProjectPost)\n([\s\S]*?)(?=\n\/\/ |$)/g)) {
  expected=expected.replace('model '+model+' {','model '+model+' {\n'+fields.trim()+'\n');
}
const tokens=s=>(s.match(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|[^\s"]/g)||[]).filter(x=>!x.startsWith('//')).join('');
assert.equal(tokens(read('prisma/schema.prisma')),tokens(expected),'Only reviewed schema tokens');
assert.equal(JSON.parse(read('vercel.json')).git.deploymentEnabled,false);
console.log(JSON.stringify({baseline,directory,hashes,approvedSchemaTokensOnly:true,gitDeploymentDisabled:true},null,2));

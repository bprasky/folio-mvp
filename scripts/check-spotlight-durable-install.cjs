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
// Separately approved 2026-09-24 firm member posting policy. Pin both the
// exact additive SQL and the one permitted Organization field.
assert.equal(hash(read('prisma/migrations/20260924120000_org_member_posting_policy/migration.sql')),'ff6fa82f8627f4272c57b61a8c4cae1764e5dd52643588f1e977eb7e6dc629ee','Approved firm posting policy SQL');
expected=expected.replace(/(model Organization \{[\s\S]*?)(\s+status\s+OrgStatus)/,'$1\nmembersCanPublish Boolean @default(true)\n$2');
// Separately approved 2026-10-01 private live-interview models and User inverses.
// Read definitions only from the pinned review patch, never from the schema
// under test. Prisma format places the inverse fields before User's @@map.
const livePatch=read('docs/reviews/live-interviews/schema-proposal.patch');
assert.equal(hash(livePatch),'2aef1e60909e194a457311c403594c58f5172d95431ea8274049275c8a4269b6','Approved live interview schema artifact');
assert.equal(hash(read('prisma/migrations/20261001120000_live_interview_private_media/migration.sql')),'fddd410cfe7bbcc43eae19769fd11d3b41c3e271392196230c6af04d7f7172e3','Approved live interview SQL');
const liveAdditions=livePatch.split('\n').filter(line=>line.startsWith('+')&&!line.startsWith('+++')).map(line=>line.slice(1));
const liveModelsIndex=liveAdditions.indexOf('model LiveInterviewSession {');
assert.ok(liveModelsIndex>0,'Reviewed live model definitions exist');
const liveInverses=liveAdditions.slice(0,liveModelsIndex).join('\n');
expected=expected.replace(/(model User \{[\s\S]*?)(\n\s*@@map\("users"\)\s*\n\})/,'$1\n'+liveInverses+'$2');
expected+='\n'+liveAdditions.slice(liveModelsIndex).join('\n');
// Signup verification adds an isolated pending table. Pin the reviewed model
// and exact migration without permitting changes to existing account models.
const signupModel=read('docs/reviews/signup-email-verification.prisma.txt');
assert.equal(hash(signupModel),'20224060fe14faf24e54da92b5187bee87d5f782b9c55ad68793c496cb11fe51','Reviewed signup verification schema artifact');
assert.equal(hash(read('prisma/migrations/20261029193000_signup_email_verification/migration.sql')),'607f9a1d3caa013db66ef931d9ed03d945fbb6ffda5c2d42899aa0804db8b7a7','Reviewed signup verification SQL');
expected+='\n'+signupModel;
// The separately approved organization cover stores only this nullable JSON
// field. Pin its exact SQL while retaining the full historical token comparison.
assert.equal(hash(read('prisma/migrations/20261029120000_org_profile_appearance/migration.sql')),'8402508f17da644621be7b2762336d8f715319633691057f58cc877df072b38e','Approved organization appearance SQL');
expected=expected.replace(/(model Organization \{[\s\S]*?followerCount\s+Int\s+@default\(0\))/,'$1\nprofileAppearance Json?');
const tokens=s=>(s.match(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|[^\s"]/g)||[]).filter(x=>!x.startsWith('//')).join('');
assert.equal(tokens(read('prisma/schema.prisma')),tokens(expected),'Only reviewed schema tokens');
assert.equal(JSON.parse(read('vercel.json')).git.deploymentEnabled,false);
console.log(JSON.stringify({baseline,directory,hashes,approvedSchemaTokensOnly:true,gitDeploymentDisabled:true},null,2));

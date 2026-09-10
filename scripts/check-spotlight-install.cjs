// Static scope check; never connects to a database.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const baseline = 'a483ec202b66f588ec85cddcc34a745e92af269f';
const directory = 'prisma/migrations/20260910180000_add_product_spotlight_draft_selection';
const hashes = {
  'models.prisma': '6a63461558a89a5ac78e99eccc34634af78e909b1186b7c9cb676c8195c54463',
  'inverse-fields.txt': 'a271cd1f64ea5bee1f68302adfdd4a9547771e2afcde0726d3399864490257c0',
  'schema.patch': 'feaa2845e1477bb6e380b9c4cb21f0e4a64015dbf453e38d824edee397008660',
  'migration.sql': '77fa2afe19f2f1e61d344f54d78381ca18d862b795e48edca9b3101c939291ab',
  'recon-summary.json': '111f0932e5be2bb7165b1b0435e39340851d786a92a1c581b3e5106847b83861',
};
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
for (const [name, expected] of Object.entries(hashes)) {
  assert.equal(hash(read(`docs/proposals/spotlight-draft-selection/${name}`)), expected, name);
}
assert.equal(hash(read(`${directory}/migration.sql`)), hashes['migration.sql']);
let expected = execFileSync('git', ['show', `${baseline}:prisma/schema.prisma`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
const fields = {
  User: 'spotlightsAsPublisher ProductSpotlight[] @relation("SpotlightPublisher")\nselectedSpotlights ProductSpotlight[] @relation("SpotlightSelector")',
  Organization: 'spotlightsAsPublisher ProductSpotlight[] @relation("SpotlightPublisherOrg")',
  Project: 'productSpotlights ProductSpotlight[]',
  Product: 'spotlights ProductSpotlight[]',
  Room: 'productSpotlights ProductSpotlight[]',
  ProductTag: 'spotlightLink ProductSpotlightTag?',
};
for (const [model, additions] of Object.entries(fields)) {
  expected = expected.replace(`model ${model} {`, `model ${model} {\n${additions}`);
}
expected += '\n' + read('docs/proposals/spotlight-draft-selection/models.prisma');
// Prisma format only changes inter-token whitespace. Retain whitespace within strings.
const tokens = s => (s.match(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|[^\s"]/g) || []).filter(token => !token.startsWith('//')).join('');
assert.equal(tokens(read('prisma/schema.prisma')), tokens(expected), 'Only the approved model and inverse tokens may change');
assert.equal(JSON.parse(read('vercel.json')).git.deploymentEnabled, false, 'Git deployment must remain disabled for the separate migration handoff');
console.log(JSON.stringify({ baseline, directory, hashes, approvedSchemaTokensOnly: true, gitDeploymentDisabled: true }, null, 2));

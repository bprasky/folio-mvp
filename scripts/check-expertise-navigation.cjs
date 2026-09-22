const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exported = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/publishing-studio/expertise-navigation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: exported, URLSearchParams });
const intent = exported.expertiseIntent('Storage & daily routines', 'project-a,project-b,project-a,https://evil.test,../private');
assert.deepEqual(Array.from(intent.projectIds), ['project-a', 'project-b']);
const url = new URL(exported.expertiseReturnUrl(intent, 'new-project'), 'https://folio.test');
assert.equal(url.origin, 'https://folio.test');
assert.equal(url.pathname, '/designer/studio');
assert.equal(url.searchParams.get('expertiseTopic'), 'Storage & daily routines');
assert.equal(url.searchParams.get('expertiseProjects'), 'project-a,project-b,new-project');
assert.equal(url.hash, '#my-expertise');
assert.equal(exported.expertiseIntent('a'.repeat(1000), '').topic.length, 240);
assert.equal(exported.expertiseIntent(null, {}).projectIds.length, 0);
console.log('PASS expertise upload return: bounded intent, project deduplication, safe local destination and comparison retention.');

const flagCode = ts.transpileModule(fs.readFileSync('src/lib/publishing-studio/expertise/flag.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
for (const [value, expected] of [[undefined, true], ['true', true], ['false', false]]) {
  const flags = {}; vm.runInNewContext(flagCode, { exports: flags, process: { env: { STUDIO_MY_EXPERTISE: value } } });
  assert.equal(flags.expertiseEnabled(), expected, `Expertise flag ${value}: default availability and explicit kill switch`);
}
console.log('PASS expertise availability: absent flag enables; explicit false disables.');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync('src/lib/onboarding/professional-entry.ts', 'utf8');
const result = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: result, URL, URLSearchParams });
const { firmWorkspaceDestination, safeProfessionalCallback, safeCallbackPath, projectEntryHref, professionalSetupHref } = result;
assert.equal(professionalSetupHref(), '/auth/org-setup', 'navigation must not invent a project action');
assert.equal(professionalSetupHref('designer'), '/auth/org-setup?type=designer');
assert.equal(result.professionalEntryHref(true), '/auth/org-setup');
assert.equal(new URL(result.professionalEntryHref(false), 'https://folio.test').searchParams.get('callbackUrl'), '/auth/org-setup');
for (const path of ['https://evil.test', '//evil.test', '/%2fevil.test', '/%5cevil.test', '/%0aevil', '/%ZZ']) assert.equal(safeCallbackPath(path, '/projects'), '/projects');
assert.equal(safeCallbackPath('/projects/new?visitToken=abc'), '/projects/new?visitToken=abc');
const personal = projectEntryHref({ role: 'INDIVIDUAL' });
assert.equal(personal, professionalSetupHref('designer', '/projects/new'));
const anonymous = new URL(projectEntryHref(null), 'https://folio.test');
assert.equal(anonymous.pathname, '/auth/signin');
assert.equal(anonymous.searchParams.get('callbackUrl'), personal);
assert.equal(projectEntryHref({ role: 'DESIGNER', operatingAsOrgId: 'employer' }), '/projects/new');
assert.equal(new URL(professionalSetupHref('builder', 'https://evil.test'), 'https://folio.test').searchParams.get('callbackUrl'), '/projects/new');


for (const path of ['/auth/org-setup?callbackUrl=/auth/org-setup', '/auth/signin', '/auth/signup/', '/onboarding/firm', '/professionals', '/auth/%73ignin']) assert.equal(safeProfessionalCallback(path), '/projects/new');
assert.equal(safeCallbackPath('/auth/claim?token=abc'), '/auth/claim?token=abc');
assert.equal(safeProfessionalCallback('/auth/claim?token=abc'), '/auth/claim?token=abc');

for (const type of ['VENDOR', 'MANUFACTURER', 'SHOWROOM']) {
  for (const callback of ['/projects/new?visitToken=abc', '/designer/create/', '/auth/org-setup', undefined]) assert.equal(firmWorkspaceDestination({ id: 'firm', type }, callback), '/org/firm');
  assert.equal(firmWorkspaceDestination({ id: 'firm', type }, '/settings?tab=firm'), '/settings?tab=firm');
}
for (const type of ['DESIGN_FIRM', 'ARCHITECTURE_FIRM', 'CONTRACTOR']) assert.equal(firmWorkspaceDestination({ id: 'firm', type }, '/projects/new?visitToken=abc'), '/projects/new?visitToken=abc');
for (const type of ['PHOTOGRAPHY_STUDIO', 'DEVELOPER']) {
  assert.equal(firmWorkspaceDestination({ id: 'firm/id', type }, '/designer/create'), '/org/firm%2Fid');
  assert.equal(firmWorkspaceDestination({ id: 'firm', type }, '/settings'), '/settings');
  assert.equal(firmWorkspaceDestination({ id: 'firm', type }, '/auth/signin'), '/org/firm');
}
assert.equal(firmWorkspaceDestination({ id: 'firm', type: 'VENDOR' }, 'https://evil.test'), '/org/firm');
console.log('Professional entry callback, identity and firm destination tests passed');

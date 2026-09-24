const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, URLSearchParams, process: { env: {} }, require: key => { if (!(key in mocks)) throw Error('Unexpected dependency: ' + key); return mocks[key]; },
  });
  return exports;
}
const helper = load('src/lib/onboarding/professional-entry.ts');
const redirect = value => { throw Object.assign(new Error('redirect'), { destination: value }); };
const common = { 'next/navigation': { redirect }, '@/lib/onboarding/professional-entry': helper };
async function destination(page, props) {
  try { await page(props); } catch (error) { if (error.destination) return error.destination; throw error; }
  assert.fail('Expected redirect');
}
(async () => {
  const signin = load('src/app/auth/signin/page.tsx', { ...common, 'next/link': {}, react: {}, 'react/jsx-runtime': {}, './signin.module.css': {}, './SigninForm': {}, '@/app/api/auth/[...nextauth]/options': { authOptions: {} }, 'next-auth': { getServerSession: async () => ({ user: { id: 'existing-person' } }) }, '@/lib/auth/getSigninHero': { getSigninHero: () => { throw Error('Authenticated users must redirect before loading signin content'); } } }).default;
  for (const callbackUrl of ['/auth/org-setup', '/auth/org-setup?callbackUrl=%2Fprojects%2Fnew', '/auth/claim?token=abc', '/projects']) assert.equal(await destination(signin, { searchParams: { callbackUrl } }), callbackUrl);
  for (const callbackUrl of ['/auth/signin', '/auth/signup?callbackUrl=/auth/signin', '/auth/%73ignin/', 'https://evil.test']) assert.equal(await destination(signin, { searchParams: { callbackUrl } }), '/');
  const legacy = load('src/app/for-professionals/page.tsx', common).default;
  assert.equal(await destination(legacy, { searchParams: {} }), '/professionals');
  const alias = new URL(await destination(legacy, { searchParams: { type: 'architect', callbackUrl: '/projects/new?visitToken=abc' } }), 'https://folio.test');
  assert.equal(alias.searchParams.get('type'), 'architect'); assert.equal(alias.searchParams.get('callbackUrl'), '/projects/new?visitToken=abc');
  const join = load('src/app/professionals/join/page.tsx', common).default;
  assert.equal(await destination(join, { searchParams: {} }), '/auth/org-setup');
  const selected = new URL(await destination(join, { searchParams: { orgId: 'existing-firm', add: '1', type: 'designer', callbackUrl: '/projects/new' } }), 'https://folio.test');
  assert.equal(selected.pathname, '/auth/org-setup'); assert.equal(selected.searchParams.get('orgId'), 'existing-firm'); assert.equal(selected.searchParams.get('add'), '1'); assert.equal(selected.searchParams.get('callbackUrl'), '/projects/new');
  console.log('PASS authenticated signin return/loop prevention and legacy professional aliases with explicit intent');
})().catch(error => { console.error(error); process.exitCode = 1; });

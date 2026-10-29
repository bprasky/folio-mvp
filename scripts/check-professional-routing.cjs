const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { exports, URL, URLSearchParams, require: name => {
    if (name in mocks) return mocks[name];
    if (['react', 'react/jsx-runtime'].includes(name)) return require(name);
    throw Error('Unexpected dependency: ' + name);
  } });
  return exports;
}
const helper = load('src/lib/onboarding/professional-entry.ts');
const Link = ({ children, ...props }) => React.createElement('a', props, children);
const accountComponent = load('src/app/auth/org-setup/_AccountStatus.tsx', { 'next/link': { default: Link } });
const component = load('src/app/auth/org-setup/_ScenarioA.tsx', {
  'next/link': { default: Link }, './_AccountStatus': accountComponent,
  'next/navigation': { useRouter: () => ({}) }, 'next-auth/react': { useSession: () => ({ update: async () => {} }) },
  '@/lib/onboarding/professional-entry': helper,
  '@/lib/onboarding/firm-name': load('src/lib/onboarding/firm-name.ts'),
  '@/components/onboarding/SetupProgress': load('src/components/onboarding/SetupProgress.tsx'),
}).ScenarioA;
let session, memberships, account, selected;
const page = load('src/app/auth/org-setup/page.tsx', {
  '@/components/onboarding/ProfessionalSetupFrame': load('src/components/onboarding/ProfessionalSetupFrame.tsx', { 'next/link': { default: Link }, './professional-setup.css': {} }),
  'next/link': { default: Link }, '../_components/auth.css': {}, './_ScenarioA': { ScenarioA: component },
  'next/navigation': { redirect: destination => { throw Object.assign(new Error('redirect'), { destination }); } },
  'next-auth': { getServerSession: async () => session }, '@/app/api/auth/[...nextauth]/options': {},
  '@/lib/onboarding/professional-entry': helper,
  '@/lib/prisma': { prisma: {
    organizationUser: { findMany: async ({ where }) => { assert.equal(where.userId, 'person'); assert.equal(where.isActive, true); return memberships; } },
    user: { findUniqueOrThrow: async ({ where }) => { assert.equal(where.id, 'person'); return account; } },
    organization: { findUnique: async ({ where, select }) => { assert.equal(where.id, 'selected'); assert.deepEqual(Object.keys(select).sort(), ['id', 'location', 'name', 'type']); return selected; } },
  } },
}).default;
function propsOf(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === component) return node.props;
  for (const child of React.Children.toArray(node.props?.children)) { const found = propsOf(child); if (found) return found; }
  return null;
}
const firm = (id, name, role = 'MEMBER') => ({ role, organization: { id, name, type: 'DESIGN_FIRM', location: null } });
async function props(searchParams = {}) { return propsOf(await page({ searchParams })); }
const html = p => renderToStaticMarkup(React.createElement(component, p));
(async () => {
  session = null;
  for (const query of [{}, { add: '1', orgId: 'selected' }, { callbackUrl: '/projects/new?visitToken=abc' }]) {
    await assert.rejects(page({ searchParams: query }), error => {
      const signin = new URL(error.destination, 'https://folio.test');
      assert.equal(signin.pathname, '/auth/signin');
      const setup = new URL(signin.searchParams.get('callbackUrl'), 'https://folio.test');
      assert.equal(setup.searchParams.get('callbackUrl'), query.callbackUrl ?? null);
      assert.equal(setup.searchParams.get('orgId'), query.orgId ?? null);
      assert.equal(setup.searchParams.get('add'), query.add ?? null);
      return true;
    });
  }
  session = { user: { id: 'person', operatingAsOrgId: 'wrong-session-firm' } };
  account = { name: 'Example Designer', email: 'example@example.test', operatingAsOrgId: 'second' };
  memberships = [firm('first', 'Employer'), firm('second', 'Side Practice', 'OWNER')];
  let p = await props(); let rendered = html(p);
  assert.equal(p.accountOverview, true); assert.equal(p.existingOnly, false); assert.equal(p.callbackUrl, '/settings');
  assert.match(rendered, /Signed in as/); assert.match(rendered, /example@example.test/);
  assert.match(rendered, /Operating under<\/dt><dd[^>]*><a[^>]*>Side Practice/);
  assert.match(rendered, /Join or create another firm/); assert.doesNotMatch(rendered, /Where does this work belong|Choose your firm|<button/);
  account.operatingAsOrgId = null; assert.match(html(await props()), /Your personal account/);
  account.operatingAsOrgId = 'revoked'; assert.match(html(await props()), /previous firm access is no longer active/);
  memberships = [firm('first', 'Employer')]; p = await props(); assert.equal(p.accountOverview, true); assert.doesNotMatch(html(p), /Where does this work belong/);
  p = await props({ add: '1' }); assert.equal(p.accountOverview, false); assert.match(html(p), /Add another firm/);
  memberships.push(firm('viewer', 'Read only firm', 'VIEWER'));
  p = await props({ callbackUrl: '/projects/new' }); assert.equal(p.existingOnly, true); assert.match(html(p), /Where does this work belong/); assert.doesNotMatch(html(p), /Read only firm<\/button>/);
  selected = { id: 'selected', name: 'Chosen firm', type: 'DESIGN_FIRM', location: null };
  p = await props({ orgId: 'selected' }); assert.equal(p.accountOverview, false); assert.equal(p.initialFirm.name, 'Chosen firm'); assert.match(html(p), /Request access to join firm/);
  memberships.push(firm('selected', 'Chosen firm', 'VIEWER'));
  p = await props({ orgId: 'selected', callbackUrl: '/projects/new' }); assert.match(html(p), /view-only access/); assert.match(html(p), />View firm<\/button>/);
  memberships = []; account.operatingAsOrgId = null;
  p = await props(); assert.equal(p.accountOverview, false); assert.match(html(p), /Firm name/); assert.match(html(p), /Signed in as/);
  console.log('PASS professional routing: auth intent, live current firm, personal/single/multiple/stale/view-only states, selected firm and explicit project selection');
})().catch(error => { console.error(error); process.exitCode = 1; });

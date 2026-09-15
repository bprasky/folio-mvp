/** Scoped UI regression: actual home component and page view selection, no DB writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { act } = React;
const { JSDOM } = require('jsdom');
const { createRoot } = require('react-dom/client');

const compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX };
const pagePath = 'src/app/project/[id]/page.tsx';
function resolveView(source, overrides = {}) {
  const start = source.indexOf('  const defaultView:');
  const end = source.indexOf('\n  // Second pass', start);
  assert.ok(start > 0 && end > start, 'actual page view-selection region exists');
  const context = {
    isPublished: true, inPublishingFlow: true, boardsVisible: false, isProspective: false,
    hasDraftOrPublished: true, isOwner: true, editorialState: 'PUBLISHED', searchParams: {},
    progressState: { steps: [{ key: 'publish' }], reachedIndex: 0 },
    viewForStepKey: key => key === 'photos' || key === 'tags' ? 'media' : key,
    ...overrides,
  };
  vm.runInNewContext(ts.transpileModule(`${source.slice(start, end)}\nresult = view;`, { compilerOptions }).outputText, context);
  return context.result;
}

async function main() {
  // --baseline HEAD checks the old landing behavior without altering production files.
  const baseline = process.argv.indexOf('--baseline');
  const page = baseline >= 0
    ? require('node:child_process').execFileSync('git', ['show', `${process.argv[baseline + 1] || 'HEAD'}:${pagePath}`], { encoding: 'utf8' })
    : fs.readFileSync(pagePath, 'utf8');
  assert.equal(resolveView(page), 'overview', 'published return visits land on project home');
  assert.equal(resolveView(page, { searchParams: { view: 'publish' } }), 'publish', 'explicit article view is preserved');
  assert.equal(resolveView(page, { searchParams: { view: 'media' } }), 'media');
  assert.equal(resolveView(page, { searchParams: { view: 'invalid' } }), 'overview');
  const draft = { isPublished: false, editorialState: 'UNPUBLISHED' };
  assert.equal(resolveView(page, draft), 'publish', 'unpublished draft resumes Publish');
  assert.equal(resolveView(page, { ...draft, searchParams: { view: 'overview' } }), 'publish', 'stale home URL resumes draft');
  assert.equal(resolveView(page, { ...draft, hasDraftOrPublished: false, progressState: { steps: [{ key: 'photos' }], reachedIndex: 0 } }), 'media');
  assert.equal(resolveView(page, { ...draft, inPublishingFlow: false, boardsVisible: true, isProspective: true }), 'boards');
  console.log('PASS published/draft/working landing and explicit views execute actual page selection');

  // Real React events/state; child dialogs and transport are isolated at their boundaries.
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const requests = [], navigations = [], downloads = [];
  let response = { ok: true }, refreshes = 0;
  const button = (label, onClick) => React.createElement('button', { onClick }, label);
  const stubs = {
    'next/navigation': { useRouter: () => ({ push: url => navigations.push(url), refresh: () => refreshes++ }) },
    'next/image': { default: ({ src, alt }) => React.createElement('img', { src, alt }) },
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    'sonner': { toast: { success() {}, error() {} } },
    '@/components/instagram/CampaignWizard': { CampaignWizard: () => React.createElement('div', null, 'Campaign wizard') },
    '@/components/ui/ConfirmDialog': { default: props => props.open && React.createElement('div', { role: 'dialog' }, props.description, button(props.confirmText, props.onConfirm), button('Cancel', props.onCancel)) },
    './ExportSpecModal': { default: props => props.open && React.createElement('div', { role: 'dialog' }, button('Download PDF', () => props.onExport('all', 'pdf')), button('Close export', props.onClose)) },
    './OverviewModal': { default: props => props.open && React.createElement('div', { role: 'dialog' }, `Details: ${props.project.title}`) },
  };
  const source = fs.readFileSync('src/app/project/[id]/PublishedProjectHome.tsx', 'utf8');
  const context = {
    exports: {}, console, URLSearchParams, window: dom.window, document: dom.window.document,
    fetch: async (url, options) => { requests.push({ url, options }); return response; },
    require: id => Object.hasOwn(stubs, id) ? stubs[id] : require(id),
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions }).outputText, context);
  const Home = context.exports.default;
  const root = createRoot(document.getElementById('root'));
  const props = { project: { id: 'fixture-project', title: 'Fixture house', isPublic: true }, slug: 'fixture-house', coverUrl: null, canUseSocialTools: true };
  const render = async extra => act(async () => root.render(React.createElement(Home, { ...props, ...extra })));
  const click = async label => {
    const target = [...document.querySelectorAll('button')].find(el => el.textContent === label);
    assert.ok(target, `button exists: ${label}`);
    await act(async () => target.click());
  };
  try {
    await render();
    assert.equal(document.querySelector('a[href="/p/fixture-house"]').textContent.trim(), 'View published story');
    assert.ok(document.querySelector('a[href="/designer/projects/fixture-project/instagram"]'));
    assert.doesNotMatch(document.body.textContent, /Readiness|Finish tagging|Export spec/);
    await click('Create a campaign');
    assert.match(document.body.textContent, /Campaign wizard/);
    await render({ canUseSocialTools: false });
    assert.doesNotMatch(document.body.textContent, /Social hub|Campaign wizard/);
    console.log('PASS published actions render and social tools honor the owner capability');

    const exportButton = [...document.querySelectorAll('button')].find(el => el.textContent.includes('Export product list'));
    await act(async () => exportButton.click());
    response = { ok: true, headers: { get: () => 'attachment; filename="fixture.pdf"' }, blob: async () => new dom.window.Blob(['PDF']) };
    dom.window.URL.createObjectURL = () => 'blob:fixture';
    dom.window.URL.revokeObjectURL = url => assert.equal(url, 'blob:fixture');
    dom.window.HTMLAnchorElement.prototype.click = function() { downloads.push({ filename: this.download, href: this.href }); };
    await click('Download PDF');
    assert.equal(requests[0].url, '/api/projects/fixture-project/export-spec?scope=all&format=pdf');
    assert.equal(requests[0].options.method, 'POST');
    assert.deepEqual(downloads, [{ filename: 'fixture.pdf', href: 'blob:fixture' }]);
    await click('Close export');
    console.log('PASS moved export opens the existing dialog and downloads the server filename');

    const detailsButton = [...document.querySelectorAll('button')].find(el => el.textContent.includes('Project details'));
    await act(async () => detailsButton.click());
    assert.match(document.body.textContent, /Details: Fixture house/);

    requests.length = 0;
    await click('Edit project');
    assert.ok([...document.querySelectorAll('[role="dialog"]')].some(el => /leave public view/.test(el.textContent)));
    assert.equal(requests.length, 0, 'opening confirmation must not unpublish');
    await click('Cancel');
    assert.equal(requests.length, 0, 'cancelling must not unpublish');
    await click('Edit project');
    response = { ok: false, json: async () => ({ error: 'Fixture denied' }) };
    await click('Unpublish and edit');
    assert.equal(document.querySelector('[role="alert"]').textContent, 'Fixture denied');
    assert.equal(navigations.length, 0, 'failed unpublish stays on home');
    await click('Edit project');
    response = { ok: true };
    await click('Unpublish and edit');
    assert.equal(requests.at(-1).url, '/api/posting/project/fixture-project/status');
    assert.equal(requests.at(-1).options.method, 'PATCH');
    assert.deepEqual(JSON.parse(requests.at(-1).options.body), { action: 'unpublish' });
    assert.deepEqual(navigations, ['/project/fixture-project?view=publish']);
    assert.equal(refreshes, 1);
    console.log('PASS edit confirmation, cancellation, unpublish failure, and successful draft navigation');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

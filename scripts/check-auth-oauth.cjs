// Real auth callbacks and form components; no network, credentials or database writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, mocks = {}, env = {}) {
  const exports = {};
  const source = process.env.AUTH_BASELINE && file.endsWith('/options.ts')
    ? require('node:child_process').execFileSync('git', ['show', `origin/main:${file}`], { encoding: 'utf8' })
    : fs.readFileSync(file, 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, {
    exports, URL, URLSearchParams, Date, console: { log() {}, error() {} },
    process: { env: { NODE_ENV: 'production', ...env } },
    require: key => {
      if (key in mocks) return mocks[key];
      if (key.endsWith('.css')) return {};
      if (key === 'react/jsx-runtime' || key.startsWith('next-auth/providers/')) return require(key);
      throw Error('Unexpected dependency: ' + key);
    },
  });
  return exports;
}

const folioUser = { id: 'folio-person', role: 'INDIVIDUAL', accountStatus: 'APPROVED', subscriptionTier: 'FREE' };
function options(env = {}, resolveUser = async () => folioUser) {
  return load('src/app/api/auth/[...nextauth]/options.ts', {
    bcryptjs: {}, '@prisma/client': { AccountStatus: { APPROVED: 'APPROVED' } },
    '@/lib/rateLimit': {},
    '@/lib/prisma': { prisma: {
      user: { findUnique: resolveUser, upsert: async () => folioUser },
      $queryRaw: async () => [],
    } },
  }, env).authOptions;
}

function formHarness(file, query = '', providers = {}, failDiscovery = false) {
  const state = [], effects = [], dependencies = [];
  let cursor = 0, effectCursor = 0;
  const calls = [];
  const hooks = { ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useEffect(effect, deps) {
      const index = effectCursor++;
      if (!dependencies[index] || deps.some((value, i) => value !== dependencies[index][i])) {
        effects.push(effect); dependencies[index] = deps;
      }
    },
  };
  const helper = load('src/lib/onboarding/professional-entry.ts');
  const router = { replace() {}, refresh() {} };
  const mocks = {
    react: hooks, 'next/link': ({ children, ...props }) => React.createElement('a', props, children),
    'next/navigation': { useRouter: () => router, useSearchParams: () => new URLSearchParams(query) },
    'next-auth/react': { useSession: () => ({ status: 'unauthenticated' }),
      getProviders: async () => { if (failDiscovery) throw Error('offline'); return providers; },
      signIn: async (...args) => { calls.push(args); },
    },
    '@/lib/onboarding/professional-entry': helper,
    '@/components/onboarding/SetupProgress': load('src/components/onboarding/SetupProgress.tsx'),
    '../_components/SsoRow': load('src/app/auth/_components/SsoRow.tsx'),
  };
  for (const name of ['Topbar', 'PhotoPanel', 'PageFooter', 'AuthFormField', 'AuthDivider', 'AgreementCheckbox', 'PasswordStrengthMeter']) {
    mocks[`../_components/${name}`] = { [name]: () => React.createElement('span', { 'data-component': name }) };
  }
  const module = load(file, mocks);
  const Component = module.default || module.SigninForm;
  return {
    render(props) { cursor = 0; effectCursor = 0; return renderToStaticMarkup(React.createElement(Component, props)); },
    async settle() { for (const effect of effects.splice(0)) effect(); await new Promise(setImmediate); },
    calls,
    // Access the real event handlers without constructing an imitation form.
    tree(props) {
      cursor = 0; effectCursor = 0;
      const result = Component(props);
      return module.default ? result.props.children.type() : result;
    },
  };
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props?.children)) {
    const result = find(child, predicate); if (result) return result;
  }
  return null;
}

(async () => {
  for (const provider of ['google', 'apple']) {
    const auth = options();
    const user = { id: `${provider}-external-id`, email: 'PERSON@example.test' };
    const account = { provider };
    assert.equal(await auth.callbacks.signIn({ user, account }), true);
    const token = await auth.callbacks.jwt({ token: { sub: user.id }, user, account });
    assert.equal(token.id, folioUser.id, `${provider} token must carry Folio ID`);
    assert.equal(token.sub, folioUser.id);
    const session = await auth.callbacks.session({ session: { user: {} }, token });
    assert.equal(session.user.id, folioUser.id);
    assert.equal(session.user.role, 'INDIVIDUAL');
    for (const resolveUser of [async () => null, async () => { throw Error('database unavailable'); }]) {
      await assert.rejects(options({}, resolveUser).callbacks.jwt({ token: { sub: user.id }, user, account }));
    }
  }
  const auth = options();
  const credentials = await auth.callbacks.jwt({ token: { sub: folioUser.id }, user: folioUser, account: { provider: 'credentials' } });
  assert.equal(credentials.id, folioUser.id);
  const refreshed = await auth.callbacks.jwt({ token: credentials });
  assert.equal(refreshed.id, folioUser.id);
  for (const callback of ['/onboarding/diagnostic', '/auth/org-setup?type=designer&callbackUrl=%2Fprojects%2Fnew']) {
    assert.equal(await auth.callbacks.redirect({ url: callback, baseUrl: 'https://folioad.com' }), 'https://folioad.com' + callback);
  }
  for (const [google, apple] of [[false, false], [true, false], [false, true], [true, true]]) {
    const env = { ...(google ? { GOOGLE_CLIENT_ID: 'fixture', GOOGLE_CLIENT_SECRET: 'fixture' } : {}), ...(apple ? { APPLE_CLIENT_ID: 'fixture', APPLE_CLIENT_SECRET: 'fixture' } : {}) };
    const providers = Object.fromEntries(options(env).providers.map(p => [p.id, { id: p.id }]));
    const form = formHarness('src/app/auth/signup/page.tsx', 'type=designer&next=project', providers);
    assert.doesNotMatch(form.render(), /Continue with (Google|Apple)/, 'No unavailable-provider flash');
    await form.settle();
    const html = form.render();
    assert.equal(html.includes('Continue with Google'), google);
    assert.equal(html.includes('Continue with Apple'), apple);
    assert.equal(html.includes('data-component="AuthDivider"'), google || apple);
    if (google || apple) {
      const row = find(form.tree(), node => node.props?.onGoogleClick);
      for (const provider of [google && 'google', apple && 'apple'].filter(Boolean)) {
        await row.props[provider === 'google' ? 'onGoogleClick' : 'onAppleClick']();
        const call = form.calls.at(-1);
        assert.equal(call[0], provider);
        const destination = new URL(call[1].callbackUrl, 'https://folio.test');
        assert.equal(destination.pathname, '/auth/org-setup');
        assert.equal(destination.searchParams.get('type'), 'designer');
        const workspace = new URL(destination.searchParams.get('callbackUrl'), 'https://folio.test');
        assert.equal(workspace.pathname, '/onboarding/workspace');
        assert.equal(workspace.searchParams.get('returnTo'), '/projects/new');
      }
    }
  }
  for (const providers of [null, {}]) {
    const form = formHarness('src/app/auth/signup/page.tsx', '', providers, providers === null);
    form.render(); await form.settle();
    assert.doesNotMatch(form.render(), /Continue with (Google|Apple)|data-component="AuthDivider"/);
  }
  for (const error of ['OAuthSignin', 'OAuthCallback', 'AccessDenied', 'OAuthAccountNotLinked', '<script>untrusted</script>']) {
    const form = formHarness('src/app/auth/signin/SigninForm.tsx', `error=${encodeURIComponent(error)}&callbackUrl=%2Fprojects%2Fnew`);
    const html = form.render({ showGoogle: false, showApple: false });
    assert.match(html, /role="alert"/);
    assert.match(html, error === 'OAuthAccountNotLinked' ? /method you originally used/ : /Sign-in could not be completed/);
    assert.doesNotMatch(html, /untrusted/);
    assert.match(html, /auth\/signup\?callbackUrl=%2Fprojects%2Fnew/);
  }
  console.log('PASS OAuth Folio identity, failed identity resolution, credentials/session refresh, provider visibility, callback intent, and sign-in error feedback');
})().catch(error => { console.error(error); process.exitCode = 1; });

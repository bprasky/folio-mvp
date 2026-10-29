// Real signup service, API handlers and auth provider. PGlite executes the migration
// and transactional SQL; the small adapter below translates the Prisma calls used here.
// Email is captured locally. No production database or email service is contacted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const { randomUUID } = require('node:crypto');
const { NextRequest } = require('next/server');
let now = Date.now(), failEmail = false, failCreate = false, pg, db;
const emails = [], cache = new Map();
const env = { NODE_ENV: 'test', NEXTAUTH_SECRET: 'signup-test-secret-never-used-outside-this-test', RESEND_API_KEY: 'fixture', NEXTAUTH_URL: 'https://folio.test' };
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const value = item => item instanceof Date ? item.toISOString() : item;
function adapter(sql) {
  const client = {};
  for (const [model, table] of [['signupEmailChallenge', 'signup_email_challenges'], ['user', 'users']]) {
    client[model] = new Proxy({}, { get: (_, method) => async (args = {}) => {
      const params = [], bind = item => { params.push(value(item)); return '$' + params.length; };
      const where = () => Object.entries(args.where || {}).map(([key, item]) => {
        if (!item || typeof item !== 'object' || item instanceof Date) return `${quote(key)} = ${bind(item)}`;
        return Object.entries(item).filter(([op]) => op !== 'mode').map(([op, v]) => {
          if (op === 'equals' && item.mode === 'insensitive') return `lower(${quote(key)}) = lower(${bind(v)})`;
          const operator = { equals: '=', lt: '<', gt: '>' }[op];
          assert.ok(operator, 'Unsupported predicate ' + op);
          return `${quote(key)} ${operator} ${bind(v)}`;
        }).join(' AND ');
      }).join(' AND ') || 'TRUE';
      const selection = args.select ? Object.keys(args.select).map(quote).join(',') : '*';
      if (method.startsWith('find')) return (await sql.query(`SELECT ${selection} FROM ${quote(table)} WHERE ${where()} LIMIT 1`, params)).rows[0] || null;
      if (method === 'create') {
        if (model === 'user' && failCreate) throw Error('Injected account creation failure');
        const data = { id: randomUUID(), ...args.data };
        try { return (await sql.query(`INSERT INTO ${quote(table)} (${Object.keys(data).map(quote)}) VALUES (${Object.values(data).map(bind)}) RETURNING ${selection}`, params)).rows[0]; }
        catch (error) { if (error.code === '23505') error.code = 'P2002'; throw error; }
      }
      if (method === 'deleteMany') return { count: (await sql.query(`DELETE FROM ${quote(table)} WHERE ${where()}`, params)).affectedRows };
      if (method === 'updateMany') {
        const set = Object.entries(args.data).map(([key, v]) => `${quote(key)} = ${v && typeof v === 'object' && 'increment' in v ? `${quote(key)} + ${bind(v.increment)}` : bind(v)}`);
        return { count: (await sql.query(`UPDATE ${quote(table)} SET ${set} WHERE ${where()}`, params)).affectedRows };
      }
      throw Error('Unsupported operation ' + method);
    } });
  }
  client.$transaction = work => sql.transaction(tx => work(adapter(tx)));
  return client;
}
function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, {
    exports, process: { env, cwd: process.cwd }, console: { log() {}, warn() {}, error() {} }, Error, Date: Clock, URL, URLSearchParams, Headers, Buffer, setTimeout, clearTimeout,
    require(name) {
      if (name === 'server-only') return {};
      if (name === '@/lib/prisma') return { prisma: new Proxy({}, { get: (_, key) => db[key] }) };
      if (name === '@/lib/email/sendEmail') return { sendEmail: async email => { if (failEmail) return { success: false }; emails.push(email); return { success: true }; } };
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
      if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts');
      return require(name);
    },
  }, { filename: file });
  return exports;
}
const request = (body, cookie, pathname = '/api/auth/signup', origin = 'https://folio.test', ip = randomUUID()) => new NextRequest('https://folio.test' + pathname, {
  method: body === undefined ? 'GET' : 'POST', headers: { origin, cookie: cookie || '', 'content-type': 'application/json', 'x-forwarded-for': ip }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const count = async table => Number((await pg.query(`SELECT count(*) AS n FROM ${quote(table)}`)).rows[0].n);
const input = (email = randomUUID() + '@example.test') => ({ name: 'First Applicant', email, password: 'Fixture password 42!', acceptedTerms: true, returnTo: '/auth/org-setup?type=designer&callbackUrl=%2Fonboarding%2Fworkspace' });
let service, signup, state, resend, authorize;
async function start(data = input()) {
  const response = await signup.POST(request(data));
  assert.equal(response.status, 202, JSON.stringify(await response.clone().json()));
  const cookie = response.headers.get('set-cookie').split(';')[0];
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
  const payload = await response.json();
  assert.equal(payload.verificationRequired, true);
  assert.equal('user' in payload, false);
  return { data, cookie, secret: cookie.split('=')[1], code: payload.deliveryAccepted ? emails.at(-1).html.match(/>(\d{6})</)[1] : null };
}
const rejects = (operation, code) => assert.rejects(operation, error => error.code === code || error.message === code);
(async () => {
  // Prisma treats TIMESTAMP(3) as UTC; PGlite's default JS parser uses local time.
  pg = new PGlite({ parsers: { 1114: text => new Date(text.replace(' ', 'T') + 'Z') } });
  await pg.exec('CREATE TABLE users (id text PRIMARY KEY,email text UNIQUE,name text,"passwordHash" text,role text,"accountStatus" text,"tosAcceptedAt" timestamp,"privacyAcceptedAt" timestamp,"tosVersion" text,"privacyVersion" text)');
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;');
  const migration = fs.readFileSync('prisma/migrations/20261029193000_signup_email_verification/migration.sql', 'utf8');
  await pg.exec(migration); await pg.exec(migration); // Additive and rerunnable.
  db = adapter(pg);
  service = load('src/lib/auth/signup-verification.ts'); signup = load('src/app/api/auth/signup/route.ts');
  state = load('src/app/api/auth/email-verification/route.ts'); resend = load('src/app/api/auth/email-verification/resend/route.ts');
  const auth = load('src/app/api/auth/[...nextauth]/options.ts').authOptions;
  authorize = auth.providers.find(p => p.options?.id === 'email-verification').options.authorize;
  const passwordLogin = auth.providers.find(p => p.id === 'credentials' && !p.options?.id).options.authorize;
  const verify = attempt => authorize({ code: attempt.code }, { headers: { cookie: attempt.cookie, 'x-forwarded-for': randomUUID() } });

  const first = await start(input('  APPLICANT@example.test  '));
  assert.equal(await count('users'), 0);
  assert.equal(await passwordLogin({ email: first.data.email, password: first.data.password }, { headers: {} }), null);
  const pending = await service.pendingSignup(first.secret);
  assert.equal((await pg.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'signup_email_challenges'")).rows[0].relrowsecurity, true);
  for (const role of ['anon', 'authenticated']) {
    await pg.exec('SET ROLE ' + role);
    try { await assert.rejects(pg.query('SELECT * FROM signup_email_challenges'), error => error.code === '42501'); }
    finally { await pg.exec('RESET ROLE'); }
    // RLS still protects the table if a later accidental grant restores access.
    await pg.exec('GRANT SELECT, UPDATE, DELETE ON signup_email_challenges TO ' + role + '; SET ROLE ' + role);
    try {
      assert.equal((await pg.query('SELECT * FROM signup_email_challenges')).rows.length, 0);
      assert.equal((await pg.query('UPDATE signup_email_challenges SET attempts = 0')).affectedRows, 0);
      assert.equal((await pg.query('DELETE FROM signup_email_challenges')).affectedRows, 0);
    } finally { await pg.exec('RESET ROLE'); }
  }
  await pg.exec(migration); // Revoke the synthetic grants; populated replay preserves the pending signup.
  assert.equal(await count('signup_email_challenges'), 1);
  assert.equal(pending.email, 'applicant@example.test');
  assert.notEqual(pending.passwordHash, first.data.password); assert.notEqual(pending.codeHash, first.code);
  assert.equal(await service.pendingSignup(first.secret.replace(/.$/, first.secret.endsWith('a') ? 'b' : 'a')), null);
  const reloaded = await (await state.GET(request(undefined, first.cookie))).json();
  assert.equal(reloaded.returnTo, first.data.returnTo); assert.equal(reloaded.email, pending.email);
  assert.equal(Object.keys(reloaded).some(key => /hash|secret|password/i.test(key)), false);
  assert.equal(emails.length, 1, 'Refresh must not send email');
  assert.equal((await resend.POST(request({}, first.cookie, '/api/auth/email-verification/resend'))).status, 429);
  const results = await Promise.allSettled([verify(first), verify(first)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1, 'Exactly one concurrent verification succeeds');
  assert.equal(await count('users'), 1); assert.equal(await service.pendingSignup(first.secret), null);
  await rejects(verify(first), 'MISSING');
  const user = await passwordLogin({ email: 'APPLICANT@example.test', password: first.data.password }, { headers: {} });
  assert.ok(user.id); assert.equal(user.role, 'INDIVIDUAL');
  const token = await auth.callbacks.jwt({ token: {}, user, account: { provider: 'email-verification' } });
  assert.equal(token.id, user.id); assert.equal(token.sub, user.id);
  assert.equal((await signup.POST(request({ ...first.data, email: 'applicant@example.test' }))).status, 400);

  // Exercise NextAuth's real CSRF check, Credentials callback and signed session cookie.
  const { AuthHandler } = require(path.join(path.dirname(require.resolve('next-auth')), 'core/index.js'));
  const httpSignup = await start();
  const httpOptions = { ...auth, secret: env.NEXTAUTH_SECRET, debug: false, logger: { error() {}, warn() {}, debug() {} } };
  const csrf = await AuthHandler({ req: { action: 'csrf', method: 'GET', origin: 'https://folio.test', headers: {}, cookies: {} }, options: httpOptions });
  const cookies = Object.fromEntries(csrf.cookies.map(cookie => [cookie.name, cookie.value]));
  cookies[service.SIGNUP_COOKIE] = httpSignup.secret;
  const callbackRequest = { action: 'callback', providerId: 'email-verification', method: 'POST', origin: 'https://folio.test', cookies,
    headers: { cookie: Object.entries(cookies).map(([key, val]) => key + '=' + val).join('; '), 'x-forwarded-for': randomUUID() },
    body: { code: httpSignup.code, callbackUrl: httpSignup.data.returnTo } };
  const noCsrf = await AuthHandler({ req: callbackRequest, options: httpOptions });
  assert.equal(noCsrf.cookies.some(cookie => cookie.name.endsWith('session-token')), false);
  assert.ok(await service.pendingSignup(httpSignup.secret), 'CSRF rejection must not consume the challenge');
  const authenticated = await AuthHandler({ req: { ...callbackRequest, body: { ...callbackRequest.body, csrfToken: csrf.body.csrfToken } }, options: httpOptions });
  const sessionCookie = authenticated.cookies.find(cookie => cookie.name.endsWith('session-token'));
  assert.ok(sessionCookie?.value, JSON.stringify(authenticated));
  const decoded = await require('next-auth/jwt').decode({ token: sessionCookie.value, secret: env.NEXTAUTH_SECRET });
  assert.equal(decoded.email, httpSignup.data.email); assert.ok(decoded.sub);
  assert.ok(authenticated.redirect.endsWith(httpSignup.data.returnTo));

  const guesses = await start(), wrong = guesses.code === '000000' ? '000001' : '000000';
  for (let i = 0; i < 5; i++) await rejects(service.verifySignup(guesses.secret, wrong), 'INVALID');
  await rejects(verify(guesses), 'ATTEMPTS');
  now += 61_000; await rejects(service.resendSignup(guesses.secret), 'ATTEMPTS');
  assert.equal((await service.pendingSignup(guesses.secret)).attempts, 5);

  const expired = await start(); now += 10 * 60_000 + 1;
  await rejects(verify(expired), 'EXPIRED');
  assert.equal(await service.resendSignup(expired.secret), true);
  const nextCode = emails.at(-1).html.match(/>(\d{6})</)[1]; assert.notEqual(nextCode, expired.code);
  await rejects(verify(expired), 'INVALID');
  await service.verifySignup(expired.secret, nextCode);

  const rollback = await start(); failCreate = true;
  await rejects(verify(rollback), 'UNAVAILABLE'); failCreate = false;
  assert.ok(await service.pendingSignup(rollback.secret), 'Failed account creation rolls back code consumption');
  await verify(rollback);

  const taken = await start();
  await db.user.create({ data: { email: taken.data.email, name: 'Existing OAuth member', passwordHash: '' } });
  await rejects(verify(taken), 'EXISTS');
  assert.equal((await db.user.findFirst({ where: { email: taken.data.email } })).passwordHash, '', 'An older pending signup cannot take over an account');

  failEmail = true; const delivery = await start(); assert.equal(delivery.code, null);
  assert.equal((await (await state.GET(request(undefined, delivery.cookie))).json()).deliveryAccepted, false);
  failEmail = false; now += 61_000;
  const concurrentResends = await Promise.allSettled([service.resendSignup(delivery.secret), service.resendSignup(delivery.secret)]);
  assert.equal(concurrentResends.filter(r => r.status === 'fulfilled').length, 1);
  await service.verifySignup(delivery.secret, emails.at(-1).html.match(/>(\d{6})</)[1]);

  const limited = await start();
  for (let i = 1; i < 5; i++) { now += 61_000; await service.resendSignup(limited.secret); }
  now += 61_000; await rejects(service.resendSignup(limited.secret), 'RATE_LIMIT');
  assert.equal((await signup.POST(request(limited.data))).status, 429, 'New attempts cannot bypass the per-email send limit');
  assert.equal((await signup.POST(request(input(), '', '/api/auth/signup', 'https://attacker.test'))).status, 403);
  assert.equal((await resend.POST(request({}, limited.cookie, '/api/auth/email-verification/resend', 'https://attacker.test'))).status, 403);
  assert.equal((await state.GET(request(undefined, ''))).status, 404);
  const sharedIp = randomUUID();
  assert.equal((await signup.POST(request({ ...input(), acceptedTerms: false }))).status, 400);
  assert.equal((await signup.POST(request({ ...input(), password: 'short' }))).status, 400);
  for (let i = 0; i < 20; i++) assert.equal((await signup.POST(request({}, '', '/api/auth/signup', 'https://folio.test', sharedIp))).status, 400);
  assert.equal((await signup.POST(request({}, '', '/api/auth/signup', 'https://folio.test', sharedIp))).status, 429, 'IP limit blocks mass signup across different addresses');
  for (const bad of ['https://attacker.test', '//attacker.test', '/\\attacker.test', '/auth/verify-email', '/auth/signin']) assert.equal(service.signupReturnTo(bad), '/onboarding/diagnostic');
  now += 3600_001; await start();
  assert.equal(await service.pendingSignup(limited.secret), null, 'Old pending credentials are removed');
  delete env.RESEND_API_KEY;
  assert.equal((await signup.POST(request(input()))).status, 503);
  console.log('PASS signup email verification: pending isolation, browser binding, real SQL rollback/consumption, replay, expiry, resend races/limits, recovery, callbacks and provider identity');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (pg) await pg.close(); });

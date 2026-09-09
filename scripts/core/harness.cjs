const { disposableTarget } = require('./fixtures.cjs');
const target = disposableTarget();
// Before loading any Folio module: no inherited application database or services.
process.env.DATABASE_URL = target || 'postgresql://disabled:disabled@127.0.0.1:1/core_test_disabled';
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.POSTING_V1 = 'true';
process.env.POSTING_FORCE_FALLBACK = 'false';
process.env.ANTHROPIC_API_KEY = 'core-fixture-key';
process.env.OPENAI_API_KEY = 'core-fixture-key';
process.env.OPENAI_ENABLED = 'false';
process.env.ANTHROPIC_ENABLED = 'true';
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
process.env.NEXTAUTH_SECRET = 'core-regression-fixture-secret-only';
process.env.NEXTAUTH_URL = 'http://folio.test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://storage.test';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';

const { resolve } = require('node:path');
const { NextRequest } = require('next/server');
let database, session = null;
const unexpectedNetwork = [];
const modelCalls = [];
let article = {};
function replace(name, exports) {
  const path = require.resolve(name.startsWith('src/') ? resolve(name) : name);
  require.cache[path] = { id: path, filename: path, loaded: true, exports };
}
const facade = new Proxy({}, { get: (_, key) => {
  if (key === '$transaction') return async work => typeof work === 'function' ? work(facade) : Promise.all(work);
  const value = database[key];
  return typeof value === 'function' ? value.bind(database) : value;
} });
replace('src/lib/prisma', { prisma: facade });
const nextAuth = require('next-auth');
replace('next-auth', { ...nextAuth, getServerSession: async () => session });
replace('react', { ...require('react'), cache: fn => fn });
replace('next/cache', { revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: fn => fn });
// Actual external boundaries. Folio authz, orchestration, generation, projection,
// signals, permissions, moderation and lifecycle modules remain real.
replace('src/lib/storage', { saveBufferToProjectStorage: async ({ projectId, buffer }) => {
  if (!buffer.length) throw Error('Empty upload fixture');
  return { publicUrl: `https://storage.test/${projectId}/fixture.png` };
} });
class AnthropicFixture {
  messages = { create: async input => {
    modelCalls.push(input);
    const system = typeof input.system === 'string' ? input.system : JSON.stringify(input.system);
    const questionRequest = JSON.stringify(input.messages).includes('Generate room-level questions');
    const output = questionRequest
      ? { questions: [{ text: 'How did the doorway change the route through this room?', type: 'opening', vendors: [], products: [], boostable: false, topic: 'doorway' }] }
      : /select.*quote|choose.*quote|pick.*quote/i.test(system) ? { quote: null } : article;
    return { id: 'fixture-message', type: 'message', role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(output) }] };
  } };
}
replace('@anthropic-ai/sdk', AnthropicFixture);
class OpenAIFixture { embeddings = { create: async () => ({ data: [{ embedding: Array(1536).fill(0) }] }) }; }
replace('openai', OpenAIFixture);
replace('resend', { Resend: class { emails = { send: async () => ({ data: { id: 'fixture-email' }, error: null }) }; } });
global.fetch = async url => {
  const parsed = new URL(String(url));
  if (parsed.origin === 'https://storage.test') {
    if (parsed.pathname.endsWith('.png')) return new Response(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3foAAAAASUVORK5CYII=', 'base64'), { headers: { 'content-type': 'image/png' } });
    if (parsed.pathname === '/storage/v1/bucket') return Response.json([]);
    if (parsed.pathname.startsWith('/storage/v1/object/analytics/')) return new Response('');
  }
  unexpectedNetwork.push(String(url)); throw Error('Unexpected network request in core journey');
};
const { authOptions } = require(resolve('src/app/api/auth/[...nextauth]/options.ts'));
const { encode, getToken } = require('next-auth/jwt');
async function login(user) {
  const token = await authOptions.callbacks.jwt({ token: { sub: user.id }, user, account: { provider: 'credentials' } });
  const cookie = await encode({ token, secret: process.env.NEXTAUTH_SECRET });
  const request = new NextRequest('http://folio.test/projects', { headers: { cookie: `next-auth.session-token=${cookie}` } });
  const decoded = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  session = await authOptions.callbacks.session({ session: { user: { name: user.name, email: user.email } }, token: decoded });
  return { request, session, token: decoded };
}
const route = path => require(resolve(`src/app/api/${path}/route.ts`));
const request = (body, method = 'POST', path = '/api/test') => new NextRequest(`http://folio.test${path}`, body === undefined ? { method: 'GET' } : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
module.exports = { target, facade, route, request, login, authOptions, modelCalls, unexpectedNetwork,
  useDatabase: db => { database = db; session = null; article = {}; modelCalls.length = 0; unexpectedNetwork.length = 0; }, anonymous: () => { session = null; }, setArticle: value => { article = value; } };

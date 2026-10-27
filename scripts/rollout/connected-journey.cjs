// Real Chrome -> Next.js -> NextAuth -> disposable PostgreSQL -> rendered pages.
// Only email (disabled), model HTTP responses, and the HTTP object store are synthetic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');
const puppeteer = require('puppeteer-core');
const { PrismaClient } = require('@prisma/client');
const { disposableTarget, factories } = require('../core/fixtures.cjs');
const { storageFixture } = require('./storage-fixture.cjs');
const target = disposableTarget();
assert.ok(target, 'Explicitly disposable PostgreSQL required; never skip');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(target).hostname));
const origin = 'http://127.0.0.1:55141';
const out = path.resolve(process.env.ROLLOUT_EVIDENCE_DIR || '.tmp/connected-journey');
fs.mkdirSync(out, { recursive: true });
const db = new PrismaClient({ datasources: { db: { url: target } } });
const f = factories(db), runId = randomUUID(), password = 'Rollout fixture password 42!';
let article = {}, modelCalls = 0, browser, server, storage;
const evidence = { runId, boundary: 'real Next server/session/PostgreSQL; local synthetic model and storage HTTP; email disabled', checks: [], screenshots: [] };
function passed(name, detail) { evidence.checks.push({ name, detail }); console.log('PASS', name, detail ? JSON.stringify(detail) : ''); }
async function api(page, pathname, body, method = 'POST', expected = 200) {
  const result = await page.evaluate(async ({ pathname, body, method }) => {
    const response = await fetch(pathname, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text.slice(0, 300); }
    return { status: response.status, data };
  }, { pathname, body, method });
  if (expected !== null) assert.equal(result.status, expected, `${pathname}: ${JSON.stringify(result)}`);
  return result.data;
}
async function clickText(page, text) {
  await page.waitForFunction(text => [...document.querySelectorAll('button')].some(el => el.textContent.trim() === text && !el.disabled), {}, text);
  const consent = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Accept'));
  if (consent.asElement()) { await consent.asElement().click(); await new Promise(r => setTimeout(r, 350)); } await consent.dispose();
  const button = await page.evaluateHandle(text => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === text), text);
  await button.asElement().click(); await button.dispose();
}
async function shot(page, name, width) {
  await page.setViewport({ width, height: 920, isMobile: width < 500, hasTouch: width < 500 });
  await page.evaluate(() => document.fonts.ready); await new Promise(r => setTimeout(r, 400));
  const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(overflow.scroll <= overflow.width + 1, `${name} overflows: ${JSON.stringify(overflow)}`);
  const file = `${name}-${width}.png`; await page.screenshot({ path: path.join(out, file), fullPage: true }); evidence.screenshots.push(file);
}
async function signIn(page, email) {
  await page.goto(origin + '/auth/signin', { waitUntil: 'networkidle2' });
  const csrf = await api(page, '/api/auth/csrf', undefined, 'GET');
  const result = await page.evaluate(async ({ email, password, csrf }) => {
    const r = await fetch('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, password, csrfToken: csrf.csrfToken, json: 'true', callbackUrl: location.origin }) }); return r.status;
  }, { email, password, csrf }); assert.equal(result, 200);
  const session = await api(page, '/api/auth/session', undefined, 'GET'); assert.ok(session.user?.id); return session.user;
}
async function contextPage() {
  const context = await browser.createBrowserContext(); const page = await context.newPage();
  page.setDefaultTimeout(45000);
  await page.setRequestInterception(true);
  page.on('request', request => { const url = request.url(); if (/^(data:|blob:|http:\/\/127\.0\.0\.1:)/.test(url)) request.continue(); else request.abort(); });
  return page;
}
async function main() {
  storage = await storageFixture({ port: 55142, redis: true, model: async input => {
    modelCalls++;
    const system = typeof input.system === 'string' ? input.system : JSON.stringify(input.system);
    let output = /select.*quote|choose.*quote|pick.*quote/i.test(system) ? { quote: null } : article;
    if (JSON.stringify(input.messages).includes('Generate room-level questions')) output = { questions: [] };
    if (system?.includes('Review a guided preparation batch')) output = { reviews: JSON.parse(input.messages[0].content).candidates.map(c => ({ id: c.id, valid: false, reason: 'No verified synthetic premise', evidence: [] })) };
    return { id: 'fixture-' + modelCalls, type: 'message', role: 'assistant', model: input.model, usage: { input_tokens: 10, output_tokens: 20 }, stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(output) }] };
  } });
  const env = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'COMSPEC', 'PATHEXT', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA']) if (process.env[key]) env[key] = process.env[key];
  Object.assign(env, { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', DATABASE_URL: target, DIRECT_URL: target,
    NEXTAUTH_URL: origin, NEXTAUTH_SECRET: 'rollout-fixture-session-secret-only', NEXT_PUBLIC_SUPABASE_URL: storage.origin,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: storage.anonKey, SUPABASE_SERVICE_ROLE_KEY: storage.serviceKey,
    ANTHROPIC_API_KEY: 'rollout-local-fixture', ANTHROPIC_BASE_URL: storage.origin, ANTHROPIC_ENABLED: 'true',
    OPENAI_API_KEY: 'rollout-local-fixture', OPENAI_BASE_URL: storage.origin + '/v1', OPENAI_ENABLED: 'false',
    UPSTASH_REDIS_REST_URL: storage.origin, UPSTASH_REDIS_REST_TOKEN: 'rollout-local-redis',
    POSTING_V1: 'true', POSTING_FORCE_FALLBACK: 'false', NODE_OPTIONS: `--require=${path.resolve('scripts/rollout/loopback-boundaries.cjs')}` });
  const log = fs.openSync(path.join(out, 'next.log'), 'w');
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '55141', '-H', '127.0.0.1'], { env, stdio: ['ignore', log, log], windowsHide: true });
  let ready = false;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(origin + '/api/auth/csrf')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 500)); }
  assert.ok(ready, 'Next server did not start; see next.log');
  browser = await puppeteer.launch({ executablePath: process.env.GUIDED_TEST_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const owner = await contextPage();
  const startingWidth = process.env.ROLLOUT_MOBILE === '1' ? 390 : 1440;
  await owner.setViewport({ width: startingWidth, height: 920, isMobile: startingWidth < 500, hasTouch: startingWidth < 500 });
  evidence.startingWidth = startingWidth;
  await owner.goto(origin + '/auth/signup?intent=designer&next=project', { waitUntil: 'networkidle2' });
  const email = `${runId}@rollout.test`;
  await owner.type('#firstName', 'Rollout'); await owner.type('#lastName', 'Designer');
  await owner.type('#email', email); await owner.type('#password', password); await owner.click('#acceptedTerms');
  await owner.click('button[type="submit"]');
  await owner.waitForFunction(async () => !!(await (await fetch('/api/auth/session')).json()).user?.id);
  const session = await api(owner, '/api/auth/session', undefined, 'GET'), userId = session.user.id;
  assert.ok((await db.user.findUniqueOrThrow({ where: { id: userId } })).passwordHash);
  passed('signup UI, real credential exchange and signed browser session', { userId });
  await api(owner, '/api/onboarding/diagnostic', { role: 'DESIGNER' });
  const firm = await api(owner, '/api/auth/org-setup', { name: `Rollout Studio ${runId.slice(0, 8)}`, type: 'designer', confirmed: true }, 'POST', 201);
  await api(owner, '/api/onboarding/bio/commit', { bio: 'We arrange rooms around daylight and daily use.', specialties: ['Residential'] });
  await api(owner, '/api/onboarding/profile-preview/complete', {});
  await api(owner, '/api/user/workspace-context', { operatingAsOrgId: firm.organizationId });
  await signIn(owner, email); // reissue actual session after role/firm transition
  assert.equal((await api(owner, '/api/onboarding/state', undefined, 'GET')).completed, true);
  passed('designer onboarding and active firm saved through authenticated Next APIs');
  await owner.goto(origin + '/projects/new', { waitUntil: 'networkidle2' });
  await clickText(owner, 'Add project details first');
  await owner.waitForSelector('input[name="title"]');
  const title = `Rollout Courtyard House ${runId.slice(0, 8)}`;
  await owner.type('input[name="title"]', title); await owner.type('input[name="year"]', '2024');
  await shot(owner, 'manual-create', startingWidth);
  // Discard a real committed response at the client boundary. The request still
  // reaches Next/PostgreSQL; neither API handler nor persistence is replaced.
  await owner.evaluate(() => { const original = window.fetch; let drop = true; window.fetch = async (input, init) => { const r = await original(input, init); if (drop && String(input) === '/api/projects' && init?.method === 'POST' && r.ok) { drop = false; throw new TypeError('Fixture lost acknowledgement after commit'); } return r; }; });
  await clickText(owner, 'Save draft'); await owner.waitForSelector('[role="alert"]');
  const saved = await db.project.findFirstOrThrow({ where: { ownerId: userId, title } }), projectId = saved.id;
  await clickText(owner, 'Save draft'); await owner.waitForFunction(() => document.body.innerText.includes('Draft saved.'));
  assert.equal(await db.project.count({ where: { ownerId: userId, title } }), 1);
  await owner.reload({ waitUntil: 'networkidle2' });
  await owner.goto(origin + `/project/${projectId}`, { waitUntil: 'networkidle2' });
  assert.ok((await owner.$eval('body', e => e.innerText)).includes(title));
  passed('manual creation UI lost-response retry and refresh/resume retain one database project', { projectId });
  const buffer = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#ac8a67' } }).jpeg({ quality: 93 }).withExif({ IFD0: { Artist: 'PRIVATE_FIXTURE_METADATA' } }).toBuffer();
  const payload = { imageData: buffer.toString('base64'), mimeType: 'image/jpeg', name: 'Courtyard living room', deduplicate: true };
  const image = (await api(owner, `/api/projects/${projectId}/images`, payload, 'POST', 201)).image;
  const replay = await api(owner, `/api/projects/${projectId}/images`, payload); assert.equal(replay.image.id, image.id);
  const roomInput = { name: 'Living Room', requestId: randomUUID() };
  const room = await api(owner, `/api/projects/${projectId}/rooms`, roomInput);
  assert.equal((await api(owner, `/api/projects/${projectId}/rooms`, roomInput)).id, room.id);
  await api(owner, `/api/projects/${projectId}/images/${image.id}`, { room: room.name }, 'PATCH');
  const product = await api(owner, '/api/designer/products', { name: 'Rollout Oak Chair', vendorName: 'Fixture Workshop', url: 'https://example.test/fixture-chair', imageUrl: image.url });
  const tag = await api(owner, '/api/tag-product-to-image', { projectId, imageId: image.id, productId: product.productId, x: 25, y: 45, createSelection: true, deduplicate: true });
  assert.equal((await db.selection.findFirstOrThrow({ where: { productTagId: tag.id } })).roomId, room.id);
  // An isolated 11-photo archive catches the former first-ten readiness sample.
  const extra = [];
  for (let i = 0; i < 10; i++) extra.push(await db.projectImage.create({ data: { projectId, url: image.url, name: 'Readiness fixture ' + i, roomId: i < 9 ? room.id : null } }));
  await owner.goto(origin + `/project/${projectId}/publish`, { waitUntil: 'networkidle2' });
  const draftDisabled = () => owner.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Create Draft')?.disabled);
  assert.equal(await draftDisabled(), true, 'eleventh included photo is unassigned');
  await db.projectImage.update({ where: { id: extra[9].id }, data: { inclusion: 'EXCLUDED' } });
  await owner.reload({ waitUntil: 'networkidle2' }); assert.equal(await draftDisabled(), false, 'excluded eleventh photo does not block readiness');
  await db.projectImage.update({ where: { id: extra[9].id }, data: { inclusion: 'INCLUDED', roomId: room.id } });
  passed('legacy publication page derives readiness from all eleven images and exclusion');
  await owner.goto(origin + `/project/${projectId}?view=media`, { waitUntil: 'networkidle2' });
  for (const width of [360, 390, 768, 1440]) await shot(owner, 'workspace', width);
  passed('photo bytes, room replay, assignment and product tagging persisted and rendered at four widths');
  const anonymous = await contextPage(); await anonymous.goto(origin + '/auth/signin');
  assert.equal((await fetch(origin + image.url)).status, 404);
  const authorizedBytes = await owner.evaluate(async url => { const r = await fetch(url); return { status: r.status, size: (await r.arrayBuffer()).byteLength, cache: r.headers.get('cache-control') }; }, image.url);
  assert.equal(authorizedBytes.status, 200); assert.ok(authorizedBytes.size > 0); assert.match(authorizedBytes.cache, /no-store/);
  assert.equal((await fetch(origin + '/_next/image?url=' + encodeURIComponent(image.url) + '&w=640&q=75')).status, 404);
  assert.equal((await fetch(origin + '/_next/image?url=' + encodeURIComponent(origin + image.url) + '&w=640&q=75')).status, 404);
  passed('real Next private byte proxy and optimizer bypass denial', authorizedBytes);
  const bcrypt = require('bcryptjs'); const passwordHash = await bcrypt.hash(password, 10);
  const collaborator = await f.user({ email: `${runId}-editor@rollout.test`, passwordHash, onboardingCompletedAt: new Date() });
  const access = await db.projectParticipant.create({ data: { projectId, userId: collaborator.id, role: 'EDITOR', side: 'DESIGNER' } });
  const editor = await contextPage(); await signIn(editor, collaborator.email);
  const admitted = await editor.goto(origin + `/project/${projectId}?view=media`, { waitUntil: 'networkidle2' }); assert.equal(admitted.status(), 200);
  assert.ok((await editor.$eval('body', e => e.innerText)).includes(title));
  await api(editor, `/api/projects/${projectId}/rooms`, { name: 'Editor permitted room', requestId: randomUUID() });
  const denied = await api(editor, `/api/posting/project/${projectId}/status`, { action: 'publish' }, 'PATCH', null); assert.ok(denied.error);
  await db.projectParticipant.update({ where: { id: access.id }, data: { role: 'VIEWER' } });
  await api(editor, `/api/projects/${projectId}/rooms`, { name: 'Viewer blocked', requestId: randomUUID() }, 'POST', 403);
  await db.projectParticipant.delete({ where: { id: access.id } });
  await editor.goto(origin + `/project/${projectId}`, { waitUntil: 'networkidle2' });
  assert.match(await editor.$eval('body', e => e.innerText), /(?:Page|Project) Not Found/);
  assert.ok(!(await editor.content()).includes(title), 'streamed not-found must not serialize private project content');
  await api(editor, `/api/projects/${projectId}`, undefined, 'GET', 403);
  const membership = await f.membership(collaborator.id, firm.organizationId, { role: 'MEMBER' });
  await editor.goto(origin + `/project/${projectId}?view=media`, { waitUntil: 'networkidle2' });
  assert.ok((await editor.$eval('body', e => e.innerText)).includes(title));
  await api(editor, `/api/projects/${projectId}/rooms`, { name: 'Firm member permitted room', requestId: randomUUID() });
  await api(editor, `/api/projects/${projectId}`, undefined, 'DELETE', 403);
  await db.organizationUser.update({ where: { id: membership.id }, data: { isActive: false } });
  await api(editor, `/api/projects/${projectId}`, undefined, 'GET', 403);
  passed('authenticated collaborator page admission, permitted write, viewer write denial and revoked page denial');
  await api(owner, `/api/posting/project/${projectId}/init`, {});
  const answers = ['We moved the doorway to bring the garden into view.', 'The oak chair gives us a place to read in the afternoon.', 'The room is arranged around a quiet route through the house.'].map((answer, i) => ({ questionId: `rollout-q-${i}`, question: 'What changed in this room?', answer, section: 'designIntent', role: 'DESIGNER', roomId: room.id }));
  await api(owner, `/api/posting/project/${projectId}/interview`, { answers, selectedQuestionIds: answers.map(a => a.questionId) });
  const narrative = 'The doorway now faces the garden. A chair sits beside the opening, leaving a clear route through the room. The designer arranged this place for reading in afternoon light. The change follows the daily pattern described in the interview.';
  article = { lead: { title: 'A Door Opens Toward the Garden', kicker: 'A Door Opens Toward the Garden', deck: 'A changed doorway brings afternoon reading closer to the garden.' }, sections: [0, 1, 2].map(() => ({ type: 'narrative', heading: 'Living Room', body: narrative })), galleryChapters: [{ title: 'Living Room', imageIds: [image.id], body: [narrative, narrative] }], pullQuotes: [], credits: [] };
  await api(owner, `/api/posting/project/${projectId}/interview/generate`, { force: true, includeBio: false, includeProjectHistory: false });
  const draft = await db.projectPost.findUniqueOrThrow({ where: { projectId } }); assert.ok(draft.expandedBlocks?.galleryChapters?.length);
  assert.equal(draft.provenance.interview.payload.answers.length, 3);
  await anonymous.goto(origin + '/p/' + draft.slug, { waitUntil: 'networkidle2' });
  assert.match(await anonymous.$eval('body', e => e.innerText), /(?:Page|Project) Not Found/);
  await api(owner, `/api/posting/project/${projectId}/status`, { action: 'submit' }, 'PATCH');
  await api(owner, `/api/posting/project/${projectId}/status`, { action: 'publish' }, 'PATCH', 409);
  assert.equal((await db.projectPost.findUniqueOrThrow({ where: { projectId } })).status, 'REVIEW');
  const admin = await f.user({ email: `${runId}-admin@rollout.test`, passwordHash, role: 'ADMIN', onboardingCompletedAt: new Date() });
  const adminPage = await contextPage(); await signIn(adminPage, admin.email);
  const review = await db.projectPost.findUniqueOrThrow({ where: { projectId } });
  const approval = { action: 'approve', expectedUpdatedAt: review.updatedAt.toISOString() };
  await api(adminPage, `/api/posting/project/${projectId}/status`, approval, 'PATCH');
  await api(adminPage, `/api/posting/project/${projectId}/status`, approval, 'PATCH');
  const published = await db.projectPost.findUniqueOrThrow({ where: { projectId } }); assert.equal(published.status, 'PUBLISHED');
  const publicResponse = await anonymous.goto(origin + '/p/' + published.slug, { waitUntil: 'networkidle2' }); assert.equal(publicResponse.status(), 200);
  assert.ok((await anonymous.$eval('body', e => e.innerText)).includes('A Door Opens Toward the Garden'));
  for (const width of [360, 390, 768, 1440]) await shot(anonymous, 'public-story', width);
  assert.equal((await fetch(origin + image.url)).status, 200);
  const exported = await api(owner, '/api/instagram-export/generate-images', { projectId, saveOnly: false,
    config: { headline: 'A Door Opens Toward the Garden', aspectRatio: '4:5', slideCount: 2, bioEnabled: false, selectedImageUrls: [image.url] }, caption: 'Disposable export fixture' });
  assert.equal(exported.images.length, 2);
  for (const rendered of exported.images) { const meta = await sharp(Buffer.from(rendered.dataUrl.split(',')[1], 'base64')).metadata(); assert.equal(meta.width, 1080); assert.equal(meta.height, 1350); }
  const exportRecord = await db.instagramExport.findUniqueOrThrow({ where: { id: exported.export.id } });
  assert.equal(exportRecord.config.selectedImageUrls[0], image.url, 'provider bearer links must not be persisted');
  passed('separate carousel export reads protected source and returns two real 1080×1350 JPEGs');
  assert.equal((await anonymous.goto(origin + '/profile/' + userId, { waitUntil: 'networkidle2' })).status(), 200);
  await shot(anonymous, 'public-profile', 390);
  await editor.goto(origin + '/profile/' + userId, { waitUntil: 'networkidle2' });
  await editor.setViewport({ width: 390, height: 920, isMobile: true, hasTouch: true });
  await clickText(editor, 'Follow');
  await editor.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Following'));
  assert.equal(await db.userRelationship.count({ where: { followerId: collaborator.id, followingId: userId } }), 1);
  await editor.reload({ waitUntil: 'networkidle2' });
  await clickText(editor, 'Following');
  await editor.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Follow'));
  assert.equal(await db.userRelationship.count({ where: { followerId: collaborator.id, followingId: userId } }), 0);
  passed('mobile profile follow/unfollow confirms database state and survives refresh');
  const cookie = (await editor.cookies()).find(c => c.name.endsWith('next-auth.session-token')); assert.ok(cookie);
  const { encode, decode } = require('next-auth/jwt');
  const secret = 'rollout-fixture-session-secret-only';
  const expired = await encode({ token: await decode({ token: cookie.value, secret }), secret, maxAge: -60 });
  await editor.setCookie({ name: cookie.name, value: expired, url: origin, httpOnly: true, secure: cookie.secure, path: '/' });
  await api(editor, `/api/projects/${projectId}/rooms`, { name: 'Expired session blocked', requestId: randomUUID() }, 'POST', 401);
  passed('expired signed NextAuth token cannot mutate after session expiry');
  passed('saved interview, local-model generation, failed owner publish, approved retry and public project/profile', { modelCalls, slug: published.slug });
  await api(owner, `/api/posting/project/${projectId}/status`, { action: 'unpublish' }, 'PATCH');
  assert.equal((await fetch(origin + image.url)).status, 404);
  await anonymous.goto(origin + '/p/' + published.slug, { waitUntil: 'networkidle2' });
  assert.match(await anonymous.$eval('body', e => e.innerText), /(?:Page|Project) Not Found/);
  passed('unpublishing revokes anonymous story and original byte URL on real Next server');
}
main().catch(async error => {
  evidence.failure = error.stack; console.error(error);
  if (browser) for (const [i, page] of (await browser.pages()).entries()) { try { await page.screenshot({ path: path.join(out, `failure-${i}.png`), fullPage: true }); fs.writeFileSync(path.join(out, `failure-${i}.txt`), await page.$eval('body', e => e.innerText)); } catch {} }
  process.exitCode = 1;
}).finally(async () => {
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(evidence, null, 2));
  await browser?.close(); if (server) server.kill(); await storage?.close(); await db.$disconnect();
});

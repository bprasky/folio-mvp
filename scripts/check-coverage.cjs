// Real source parsing, permissions, review/CAS service, HTTP handlers and public projections.
// Database, web search and HTTP transport are deterministic doubles; no credentials/network.
const assert = require('node:assert/strict');
const path = require('node:path');
const { NextRequest } = require('next/server');
function replace(name, exports) {
  const id = require.resolve(name.startsWith('src/') ? path.resolve(name) : name);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
let db, session = { user: { id: 'owner' } }, role = 'ADMIN', searchResults = [], readResult = { sourceText: '', readStatus: 'unavailable', readAt: new Date().toISOString(), readMessage: 'Unavailable' };
replace('src/lib/prisma.ts', { prisma: new Proxy({}, { get: (_, key) => db[key] }) });
replace('next-auth', { getServerSession: async () => session });
replace('src/app/api/auth/[...nextauth]/options.ts', { authOptions: {} });
replace('src/lib/rateLimit.ts', { rateLimit: async () => ({ ok: true }) });
const transport = require('../src/lib/server/safe-product-url.ts');
let pages = [], requested = [];
replace('src/lib/server/safe-product-url.ts', { ...transport, safeProductResource: async url => { requested.push(url); return pages.shift(); } });
const source = require('../src/lib/coverage/source.ts');
const schema = require('../src/lib/coverage/schema.ts');
const seo = require('../src/lib/seo/public.ts');
replace('src/lib/coverage/source.ts', { ...source, discoverCoverage: async () => searchResults, readCoverageSource: async () => readResult });
const service = require('../src/lib/coverage/service.ts');
const route = require('../src/app/api/coverage/route.ts');
const legacy = require('../src/app/api/import/[sessionId]/route.ts');
const sitemap = require('../src/lib/seo/sitemap.ts');
const scope = { type: 'organization', id: 'studio' };
const rows = new Map(); let clock = Date.now(), loseCas = false, publicProject = true;
const project = { id: 'house', title: 'Courtyard House', ownerId: 'owner', designerId: 'owner', designerOrgId: 'studio',
  isPublic: true, publishedAt: new Date(0), portfolioPublishedAt: null, post: { status: 'PUBLISHED', slug: 'courtyard-house' }, images: [{ url: 'https://images.example/public.jpg' }] };
const match = (row, where) => {
  if (!where) return true;
  if (where.AND && !where.AND.every(w => match(row, w))) return false;
  for (const [key, value] of Object.entries(where)) {
    if (key === 'AND') continue;
    if (key === 'processingMeta') { if (value.path.reduce((v, k) => v?.[k], row.processingMeta) !== value.equals) return false; }
    else if (key === 'updatedAt') { if (+row.updatedAt !== +value) return false; }
    else if (row[key] !== value) return false;
  }
  return true;
};
db = {
  user: { findFirst: async () => ({ name: 'Designer', website: null, location: 'Miami' }) },
  organizationUser: { findFirst: async q => q.where.isActive && role ? { role, organization: { name: 'Studio', website: 'https://studio.example', location: 'Miami' } } : null },
  project: {
    findFirst: async q => q.where.id === 'house' && (q.where.designerOrgId === 'studio' || q.where.OR) ? { id: 'house' } : null,
    findUnique: async () => project,
    findMany: async q => q.where.isPublic ? (publicProject ? [project] : []) : [project],
    count: async () => 1,
  },
  importSession: {
    findMany: async q => [...rows.values()].filter(row => match(row, q.where)),
    findUnique: async q => rows.get(q.where.id) || null,
    findFirst: async q => [...rows.values()].find(row => match(row, q.where)) || null,
    upsert: async q => { if (!rows.has(q.where.id)) rows.set(q.where.id, { ...q.create, projectId: null, updatedAt: new Date(++clock), createdAt: new Date(clock) }); return { id: q.where.id }; },
    updateMany: async q => { const row = rows.get(q.where.id); if (loseCas || !row || !match(row, q.where)) return { count: 0 }; Object.assign(row, q.data, { updatedAt: new Date(++clock) }); return { count: 1 }; },
  },
};
const req = (method, body, origin = 'https://folio.test') => new NextRequest('https://folio.test/api/coverage?type=organization&id=studio', {
  method, headers: { origin, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
});
async function run() {
  assert.equal(schema.coverageUrl('https://press.example/story?utm_source=x&x=1#chapter'), 'https://press.example/story?x=1');
  assert.equal(schema.coverageUrl('javascript:alert(1)'), null);
  assert.equal(schema.coverageUrl('https://user:secret@press.example'), null);
  const url = 'https://press.example/story';
  const evidence = [{ type: 'web_search_tool_result', content: [{ type: 'web_search_result', title: 'Actual source title', url }] }];
  assert.deepEqual(source.verifiedSearchCandidates(evidence, [{ url, title: 'Invented title' }, { url }, { url: 'https://invented.example' }]).map(r => r.title), ['Actual source title']);
  assert.equal(source.verifiedSearchCandidates([{ type: 'text', content: evidence }], [{ url }]).length, 0);
  const article = '<article><h1>Courtyard house</h1><p>' + 'The designer explained how the courtyard shapes light and material choices. '.repeat(18) + '</p></article>';
  assert.ok(source.readableArticle(article).text);
  assert.equal(source.readableArticle('<nav>' + article.replaceAll('article', 'div') + '</nav>').text, null);
  assert.equal(source.readableArticle('<script>{"isAccessibleForFree":false}</script>' + article).text, null);
  pages = [{ status: 302, headers: { location: 'http://127.0.0.1/private' } }];
  assert.equal((await source.readCoverageSource(url)).readStatus, 'unavailable');
  assert.equal(requested.length, 1, 'A redirect to a private host is never requested');
  pages = [{ status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(article) }];
  assert.equal((await source.readCoverageSource(url)).readStatus, 'read');
  session = null; assert.equal((await route.GET(req('GET'))).status, 401); session = { user: { id: 'owner' } };
  assert.equal((await route.POST(req('POST', { scope }, 'https://other.example'))).status, 403);
  role = 'MEMBER'; await assert.rejects(service.findCoverage('owner', scope, url), e => e.status === 403); role = 'ADMIN';
  await assert.rejects(service.coverageReviewList('owner', { type: 'person', id: 'someone-else' }), e => e.status === 403);
  let review = await service.findCoverage('owner', scope, url), item = review.items[0];
  assert.equal((await service.getPublicCoverage(scope)).length, 0);
  assert.equal(item.sourceText, undefined);
  const approval = () => ({ id: item.id, version: item.version, action: 'approve', title: 'A courtyard shaped by light', source: 'Press', projectId: 'house', useForInterview: true });
  await assert.rejects(service.reviewCoverage('owner', { ...approval(), projectId: 'other' }), e => e.status === 403);
  await assert.rejects(service.reviewCoverage('owner', { ...approval(), publicationDate: '2026-02-31' }), e => e.status === 400);
  review = await service.reviewCoverage('owner', approval()); item = review.items[0];
  assert.equal(item.useForInterview, false, 'Unavailable source cannot inform interviews');
  assert.equal((await service.getPublicCoverage({ projectId: 'house' })).length, 1);
  assert.equal((await service.getCoverageInterviewContext('house')).length, 0);
  const oldVersion = item.version;
  readResult = { sourceText: 'PRIVATE_BODY', readStatus: 'read', readAt: new Date().toISOString(), readMessage: 'Read' };
  review = await service.reviewCoverage('owner', { id: item.id, version: item.version, action: 'read' }); item = review.items[0];
  assert.equal(item.useForInterview, false, 'Reading does not imply consent');
  await assert.rejects(service.reviewCoverage('owner', { ...approval(), version: oldVersion }), e => e.status === 409);
  loseCas = true; await assert.rejects(service.reviewCoverage('owner', approval()), e => e.status === 409); loseCas = false;
  review = await service.reviewCoverage('owner', approval()); item = review.items[0];
  assert.equal((await service.getCoverageInterviewContext('house'))[0].text, 'PRIVATE_BODY');
  assert.doesNotMatch(JSON.stringify(await service.getPublicCoverage(scope)), /PRIVATE_BODY|reviewedBy|matchReason|useForInterview/);
  publicProject = false;
  assert.equal((await service.getPublicCoverage({ projectId: 'house' })).length, 0);
  const profileItem = (await service.getPublicCoverage(scope))[0]; assert.equal(profileItem.project, null); assert.equal(profileItem.imageUrl, null);
  publicProject = true;
  await service.findCoverage('owner', scope, url + '?utm_source=duplicate');
  assert.equal(rows.size, 1); assert.equal(rows.get(item.id).processingMeta.state, 'approved');
  role = null; await assert.rejects(service.reviewCoverage('owner', approval()), e => e.status === 403);
  for (const method of ['GET', 'PATCH', 'DELETE']) {
    const r = await legacy[method](req(method, method === 'PATCH' ? { status: 'COMPLETED' } : undefined), { params: Promise.resolve({ sessionId: item.id }) });
    assert.equal(r.status, 409, 'Legacy importer cannot bypass revoked coverage membership');
  }
  role = 'ADMIN'; review = await service.reviewCoverage('owner', { id: item.id, version: item.version, action: 'withdraw' });
  assert.equal((await service.getPublicCoverage(scope)).length, 0); assert.equal((await service.getCoverageInterviewContext('house')).length, 0);
  assert.equal(review.items[0].state, 'dismissed');
  assert.ok(!seo.serializeJsonLd({ text: '</script><script>alert(1)</script>' }).includes('<'));
  assert.equal(seo.profileMetadata({ kind: 'Person', id: 'a/b', name: 'Test' }).alternates.canonical, 'https://folioad.com/profile/a%2Fb');
  process.env.FOLIO_EDITORIAL_CHANNELS = 'true';
  assert.deepEqual(await sitemap.sitemapUrls('projects', 0), ['https://folioad.com/p/courtyard-house', 'https://folioad.com/p/courtyard-house/feature']);
  assert.match(sitemap.sitemapXml(['https://example.com/?a=1&b=2']), /a=1&amp;b=2/);
  console.log('PASS coverage: search evidence, safe reading, auth, CAS, scope, consent, withdrawal, private projections, legacy isolation and SEO');
}
run().catch(error => { console.error(error); process.exitCode = 1; });

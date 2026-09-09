const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const h = require('./harness.cjs');
const { memoryDatabase } = require('./memory-db.cjs');
const { factories } = require('./fixtures.cjs');

// Only the Next request-cookie boundary is supplied here. Vendor context,
// membership checks, claim review and conditional Product writes remain real.
const headersPath = require.resolve('next/headers');
require.cache[headersPath] = { id: headersPath, filename: headersPath, loaded: true,
  exports: { ...require('next/headers'), cookies: () => ({ get: () => undefined }) } };

async function json(response, status = 200) {
  const body = await response.json();
  assert.equal(response.status, status, JSON.stringify(body));
  return body;
}

test('product attribution stays unclaimed until a server-authorized vendor claim', async t => {
  h.useDatabase(memoryDatabase());
  const db = h.facade, f = factories(db), r = h.request;
  const designer = await f.user({ onboardingCompletedAt: new Date() });
  const vendor = await f.user({ role: 'VENDOR', email: 'rep@acme.test' });
  const admin = await f.user({ role: 'ADMIN' });
  const org = await f.organization({ type: 'VENDOR', name: 'Acme', website: 'https://acme.test', verifiedAt: new Date(), verifiedBy: admin.id });
  await f.membership(vendor.id, org.id, { role: 'MEMBER' });
  const otherOrg = await f.organization({ type: 'VENDOR', name: 'Other Vendor', verifiedAt: new Date(), verifiedBy: admin.id });
  const otherVendor = await f.user({ role: 'VENDOR' });
  await f.membership(otherVendor.id, otherOrg.id);
  await h.login(designer);
  const create = h.route('designer/products');
  const catalog = h.route('products');
  const identities = async () => ({ users: await db.user.count(), organizations: await db.organization.count(),
    memberships: await db.organizationUser.count(), vendors: await db.vendor.count() });
  const before = await identities();
  let unknown, brandOnly;

  await t.test('unknown vendor creates an attributed product and no identities', async () => {
    const response = await json(await create.POST(r({ name: 'Reading chair', vendorName: '  Unknown Workshop  ',
      url: 'https://unknown.test/chair', imageUrl: 'https://storage.test/chair.png', priceCents: 12900 })));
    unknown = await db.product.findUniqueOrThrow({ where: { id: response.productId } });
    assert.equal(unknown.brand, 'Unknown Workshop'); assert.equal(unknown.vendorId, null);
    assert.equal(unknown.price, 129); assert.equal(unknown.isPending, false);
    assert.deepEqual(await identities(), before);
  });

  await t.test('repeated names and known organization names do not assert ownership', async () => {
    await json(await create.POST(r({ name: 'Second chair', vendorName: 'Unknown Workshop' })));
    const response = await json(await create.POST(r({ name: 'Acme lamp', vendorName: org.name,
      vendorId: vendor.id, organizationId: org.id, vendorOrgId: org.id, vendorRecordId: 'spoof' })));
    brandOnly = await db.product.findUniqueOrThrow({ where: { id: response.productId } });
    assert.equal(brandOnly.brand, org.name); assert.equal(brandOnly.vendorId, null);
    assert.deepEqual(await identities(), before);
    assert.equal(await db.vendorProductClaim.count(), 0);
  });

  await t.test('catalog creation ignores spoofed owner IDs and preserves claimed URL matches', async () => {
    const response = await json(await catalog.POST(r({ name: 'Catalog chair', brand: 'Acme',
      vendorId: vendor.id, vendorOrgId: org.id, vendor: { connect: { id: vendor.id } } })), 201);
    assert.equal(response.product.brand, 'Acme'); assert.equal(response.product.vendorId, null);
    const claimed = await f.product({ vendorId: vendor.id, url: 'https://acme.test/existing', brand: 'Acme' });
    const reused = await json(await catalog.POST(r({ name: 'Spoofed title', brand: 'Imposter',
      url: claimed.url, vendorId: designer.id })));
    assert.equal(reused.product.id, claimed.id); assert.equal(reused.product.vendorId, vendor.id);
    assert.equal(reused.product.brand, 'Acme'); assert.equal(reused.product.name, claimed.name);
    assert.deepEqual(await identities(), before);
  });

  await t.test('unknown attributed product tags immediately with designer attribution', async () => {
    const project = await f.project(designer.id), image = await f.image(project.id);
    const tag = await json(await h.route('tag-product-to-image').POST(r({ projectId: project.id,
      imageId: image.id, productId: unknown.id, x: 0.25, y: 0.75 })));
    const saved = await db.productTag.findUniqueOrThrow({ where: { id: tag.id } });
    assert.equal(saved.productId, unknown.id); assert.equal(saved.imageId, image.id);
    assert.equal((await db.project.findUniqueOrThrow({ where: { id: project.id } })).designerId, designer.id);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: unknown.id } })).vendorId, null);
  });

  await t.test('claim verification, review authorization and conditional ownership stay intact', async () => {
    const { canClaimOrganization } = require(resolve('src/lib/vendor/domain-verification.ts'));
    // Existing domain verifier denies the designer for an organization with a known domain.
    assert.equal((await canClaimOrganization(designer.email, org.id)).allowed, false);
    assert.equal((await canClaimOrganization(vendor.email, org.id)).allowed, true);
    const domainProduct = await json(await create.POST(r({ name: 'Domain-matched chair',
      vendorName: 'Acme', url: 'https://acme.test/new-chair' })));
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: domainProduct.productId } })).vendorId, null);
    const tagCount = await db.productTag.count();
    const { turnoverUnclaimedProducts } = require(resolve('src/lib/vendor/claimTurnover.ts'));
    const review = h.route('vendor/review-queue');
    await turnoverUnclaimedProducts(org.id, vendor.id);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: domainProduct.productId } })).vendorId, vendor.id);
    const candidate = await db.productClaimCandidate.findUniqueOrThrow({
      where: { productId_organizationId: { productId: brandOnly.id, organizationId: org.id } } });
    assert.equal(candidate.status, 'PENDING');
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: brandOnly.id } })).vendorId, null);
    assert.equal((await review.POST(r({ candidateId: candidate.id, action: 'confirm' }))).status, 403);
    await h.login(otherVendor);
    assert.equal((await review.POST(r({ candidateId: candidate.id, action: 'confirm' }))).status, 404);
    await h.login(vendor);
    await json(await review.POST(r({ candidateId: candidate.id, action: 'confirm' })));
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: brandOnly.id } })).vendorId, vendor.id);
    // A stale/replayed review cannot transfer a product assigned in the meantime.
    await db.product.update({ where: { id: brandOnly.id }, data: { vendorId: otherVendor.id } });
    await json(await review.POST(r({ candidateId: candidate.id, action: 'confirm' })), 409);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: brandOnly.id } })).vendorId, otherVendor.id);
    assert.equal(await db.productTag.count(), tagCount);
    assert.deepEqual(await identities(), before);
  });

  await t.test('invalid attribution shapes create neither products nor identities', async () => {
    await h.login(designer);
    const count = await db.product.count();
    for (const body of [{ name: 'Chair', vendorName: { connect: { id: vendor.id } } }, { name: '   ' }]) {
      await json(await create.POST(r(body)), 400);
    }
    assert.equal(await db.product.count(), count);
    assert.deepEqual(await identities(), before);
  });

  await t.test('anonymous creation is refused', async () => {
    h.anonymous();
    assert.equal((await create.POST(r({ name: 'Anonymous', vendorName: 'Acme' }))).status, 401);
  });
  assert.equal(h.unexpectedNetwork.length, 0);
});

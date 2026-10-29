const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const filename = path.resolve(file);
  const loaded = new Module(filename);
  loaded.require = (id) => {
    if (Object.hasOwn(dependencies, id)) return dependencies[id];
    throw new Error(`Unexpected dependency in ${file}: ${id}`);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  return loaded.exports;
}

const tiers = load('src/lib/pricing/tiers.ts');
const policy = load('src/lib/pricing/early-access.ts');
assert.equal(policy.DESIGNER_EARLY_ACCESS_ENABLED, true, 'First designer round stays free until explicitly changed');

async function checkPolicy(enabled) {
  let user = { role: 'DESIGNER', subscriptionTier: 'FREE', subscriptionExpiresAt: null };
  const prisma = {
    user: { findUnique: async () => user },
    project: { count: async () => 30 },
    organizationUser: { findFirst: async () => null },
  };
  const accessPolicy = { ...policy, DESIGNER_EARLY_ACCESS_ENABLED: enabled };
  const service = load('src/lib/pricing/subscription-service.ts', {
    '@/lib/prisma': { prisma }, './tiers': tiers, './early-access': accessPolicy,
  });
  const directory = load('src/lib/directory/eligibility.ts', {
    '@/lib/prisma': { prisma }, '@/lib/pricing/early-access': accessPolicy,
  });
  const scrape = load('src/lib/pricing/canUsePortfolioScrape.ts', {
    '@/lib/prisma': { prisma }, './early-access': accessPolicy,
    './founding-designer': { isFoundingDesigner: async () => false },
  });

  const subscription = await service.getUserSubscriptionWithUsage('designer');
  assert.equal(Boolean(subscription.status.isComplimentary), enabled);
  assert.equal(subscription.status.tier, 'FREE', 'Early access must not rewrite paid membership');
  assert.equal(subscription.limits.projects, enabled ? null : 1);
  assert.equal(subscription.usage.projects.limit, subscription.limits.projects);
  assert.equal(subscription.limits.designerSeats, enabled ? -1 : 1);
  assert.equal((await service.canCreateProject('designer')).allowed, enabled);
  assert.equal((await service.canInviteTeamMember('designer')).allowed, enabled);
  assert.equal((await service.canUseAIEditorial('designer')).allowed, enabled);
  assert.equal((await service.checkFeatureAccess('designer', 'shared_libraries')).hasAccess, enabled);
  assert.equal((await service.checkFeatureAccess('designer', 'does_not_exist')).hasAccess, false);
  assert.equal((await service.checkFeatureAccess('designer', 'api_integrations')).hasAccess, false);
  assert.equal(service.getUpgradePrompt('FREE', 'manual_upgrade') === null, enabled);
  assert.equal(await scrape.canUsePortfolioScrape('designer'), enabled);
  assert.equal(await scrape.canUsePortfolioScrape(''), false);
  assert.equal(scrape.canScrapeFromTier('FREE'), enabled);
  assert.equal(scrape.canScrapeFromTier(null), false);
  assert.equal(directory.isDesignerDirectoryEligible(user), enabled);
  assert.equal((await directory.getDesignerEligibilityStatus('designer')).requiresProUpgrade, !enabled);
  assert.equal(directory.isDesignerDirectoryEligible({ ...user, role: 'INDIVIDUAL' }), false);
  assert.equal(directory.isVendorDirectoryEligible({ type: 'VENDOR', status: 'UNCLAIMED' }), false);

  user = { ...user, subscriptionTier: 'PRO', subscriptionExpiresAt: new Date('2020-01-01') };
  assert.equal((await service.getSubscriptionStatus('designer')).isActive, enabled);
  assert.equal((await service.canUseAIEditorial('designer')).allowed, enabled);
  user = { ...user, subscriptionTier: 'ENTERPRISE', subscriptionExpiresAt: null };
  assert.equal((await service.checkFeatureAccess('designer', 'api_integrations')).hasAccess, true);
  user = null;
  assert.equal(Boolean((await service.getSubscriptionStatus('missing')).isComplimentary), false);
  assert.equal((await service.canInviteTeamMember('missing')).allowed, false);

  let session = null;
  const route = load('src/app/api/subscription/check-feature/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    'next-auth': { getServerSession: async () => session },
    '@/app/api/auth/[...nextauth]/options': { authOptions: {} },
    '@/lib/pricing': service,
  });
  const request = { nextUrl: new URL('https://folio.test/api/subscription/check-feature?feature=ai_editorial') };
  assert.equal((await route.GET(request)).status, 401, 'Payment waiver must not waive sign-in');
  user = { role: 'DESIGNER', subscriptionTier: 'FREE', subscriptionExpiresAt: null };
  session = { user: { id: 'designer' } };
  assert.equal((await route.GET(request)).body.hasAccess, enabled);
  console.log(`Designer subscription policy: ${enabled ? 'complimentary access' : 'paid-mode compatibility'} passed`);
}

(async () => {
  await checkPolicy(true);
  await checkPolicy(false);
  console.log('No database writes or live services used; auth, professional roles and vendor eligibility preserved.');
})().catch((error) => { console.error(error); process.exitCode = 1; });

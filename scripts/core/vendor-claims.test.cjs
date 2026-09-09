const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { readFileSync, existsSync } = require('node:fs');
const h = require('./harness.cjs');
const { memoryDatabase } = require('./memory-db.cjs');
const { factories } = require('./fixtures.cjs');
const hp = require.resolve('next/headers');
require.cache[hp] = { id: hp, filename: hp, loaded: true, exports: { cookies: () => ({ get: () => undefined }) } };
// Transaction boundary double: serialized callbacks + rollback snapshots. This
// tests the application's losing-write handling, NOT PostgreSQL lock behavior.
let db, serial = Promise.resolve();
const transactionModels = ['product', 'productClaimCandidate', 'organization', 'organizationUser', 'orgClaimInvite', 'vendorInvite', 'user'];
const prisma = new Proxy({}, { get: (_, key) => key === '$transaction' ? work => {
  const run = serial.then(async () => {
    const before = await Promise.all(transactionModels.map(m => db[m].findMany()));
    try { return await work(prisma); }
    catch (error) {
      for (let i = 0; i < transactionModels.length; i++) {
        const model = transactionModels[i]; await db[model].deleteMany();
        for (const data of before[i]) await db[model].create({ data });
      }
      throw error;
    }
  });
  serial = run.catch(() => {}); return run;
} : db[key] });
const pp = require.resolve(resolve('src/lib/prisma'));
require.cache[pp].exports = { prisma };
// These follow-up effects are unrelated to claim authority and have external
// scheduling/delivery; the session, membership and claim code remain real.
for (const [file, exports] of [
  ['src/lib/intelligence/shadow-merge', { mergeVendorShadow: async()=>{}, mergeRepShadow: async()=>{} }],
  ['src/lib/messaging/pending-actions', { deliverPendingActions: async()=>{} }],
]) { const path = require.resolve(resolve(file)); require.cache[path] = { id:path, filename:path, loaded:true, exports }; }
async function setup() {
  db = memoryDatabase(); h.useDatabase(db); const f = factories(db);
  const admin = await f.user({ role: 'ADMIN' });
  const vendor = await f.user({ role: 'VENDOR', email: 'rep@acme.co.uk' });
  const org = await f.organization({ type:'VENDOR', name:'Acme', website:'https://acme.co.uk', verifiedAt:new Date(), verifiedBy:admin.id });
  const membership = await f.membership(vendor.id, org.id, { role:'MEMBER' });
  await h.login(vendor); return { f, vendor, org, membership, admin };
}
const r = h.request;
const claim = () => require(resolve('src/lib/vendor/reviewProductClaim.ts'));
const turnover = () => require(resolve('src/lib/vendor/claimTurnover.ts')).turnoverUnclaimedProducts;
async function candidate(org, product, extra={}) { return db.productClaimCandidate.create({ data: { productId:product.id, organizationId:org.id, matchType:'BRAND', ...extra } }); }

test('retired preview and notify endpoints cannot read, mutate, or return fake success', async () => {
  await setup(); h.anonymous(); db.calls.length = 0;
  for (const path of ['vendor/claim-product','projects/[id]/notify-vendors']) {
    for (const payload of [{}, {previewTokenId:'valid-or-expired',vendorId:'spoof',vendorEmail:'attacker@test',productId:'other'}]) {
      const res = await h.route(path).POST(r(payload)); assert.equal(res.status,410); assert.equal((await res.json()).code,'ENDPOINT_RETIRED');
    }
  }
  assert.equal(db.calls.length,0);
  const React = require('react');
  const Page = require(resolve('src/app/vendor/preview/[token]/page.tsx')).default;
  // tsx uses classic JSX for this isolated test; Next uses its own JSX transform.
  const previousReact = global.React;
  global.React = React;
  let markup;
  try { markup = require('react-dom/server').renderToStaticMarkup(React.createElement(Page)); }
  finally { global.React = previousReact; }
  assert.match(markup, /Product preview claims have moved/);
  assert.match(markup, /href="\/auth\/org-setup"/);
  assert.match(markup, /href="\/vendor\/review"/);
  assert.equal(db.calls.length,0);
  const page = readFileSync('src/app/vendor/preview/[token]/page.tsx','utf8');
  assert.match(page,/\/auth\/org-setup/); assert.match(page,/\/vendor\/review/); assert.doesNotMatch(page,/prisma|params\.token|ClaimProductForm/);
  assert.equal(existsSync('src/lib/email/sendVendorProductPreviewEmail.ts'),false);
});
test('domain turnover uses exact approved website; brand waits; rejected decisions survive', async () => {
  const { f, org, vendor } = await setup();
  const good = await f.product({brand:'Acme',url:'https://www.acme.co.uk/chair',vendorId:null});
  const other = await f.product({brand:'Other',url:'https://evil.co.uk/chair',vendorId:null});
  const brand = await f.product({brand:'Acme',url:'https://unrelated.test/chair',vendorId:null});
  const rejected = await f.product({brand:'Acme',url:'https://acme.co.uk/rejected',vendorId:null});
  await candidate(org,rejected,{matchType:'DOMAIN',status:'REJECTED'});
  assert.deepEqual(await turnover()(org.id,vendor.id),{matched:1,candidates:1});
  assert.equal((await db.product.findUnique({where:{id:good.id}})).vendorId,vendor.id);
  for (const product of [other,brand,rejected]) assert.equal((await db.product.findUnique({where:{id:product.id}})).vendorId,null);
  assert.equal(await db.vendorProductClaim.count(),0);
});
test('claim authority rejects anonymous, unrelated, inactive, viewer and self-verified organizations', async () => {
  const {f,org,vendor,membership} = await setup(); const product=await f.product(); const c=await candidate(org,product);
  const route=h.route('vendor/review-queue'); h.anonymous(); assert.equal((await route.POST(r({candidateId:c.id,action:'confirm'}))).status,401);
  await h.login(vendor);
  for (const change of [{isActive:false},{isActive:true,role:'VIEWER'}]) {
    await db.organizationUser.update({where:{id:membership.id},data:change});
    assert.equal((await route.POST(r({candidateId:c.id,action:'confirm'}))).status,403);
    await assert.rejects(turnover()(org.id,vendor.id));
  }
  await db.organizationUser.update({where:{id:membership.id},data:{role:'MEMBER'}});
  await db.organization.update({where:{id:org.id},data:{verifiedBy:vendor.id}});
  assert.equal((await route.POST(r({candidateId:c.id,action:'confirm'}))).status,403);
  assert.equal((await db.product.findUnique({where:{id:product.id}})).vendorId,null);
});
test('review ignores spoofed identities; replay and rejected candidates return conflict', async () => {
  const {f,org,vendor}=await setup(); const product=await f.product({vendorId:null}); const c=await candidate(org,product);
  const route=h.route('vendor/review-queue');
  assert.equal((await route.POST(r({candidateId:c.id,action:'confirm',vendorId:'spoof',userId:'spoof',organizationId:'spoof',productId:'spoof'}))).status,200);
  assert.equal((await db.product.findUnique({where:{id:product.id}})).vendorId,vendor.id);
  for(const action of ['confirm','reject']) assert.equal((await route.POST(r({candidateId:c.id,action}))).status,409);
  const rejected=await candidate(org,await f.product({vendorId:null}),{status:'REJECTED'});
  assert.equal((await route.POST(r({candidateId:rejected.id,action:'confirm'}))).status,409);
});
test('competing organizations get one owner and one confirmed audit; loser rolls back', async () => {
  const {f,org,vendor,admin}=await setup(); const other=await f.user({role:'VENDOR'});
  const org2=await f.organization({type:'VENDOR',verifiedAt:new Date(),verifiedBy:admin.id}); await f.membership(other.id,org2.id);
  const product=await f.product({vendorId:null}); const c1=await candidate(org,product),c2=await candidate(org2,product);
  const outcomes=await Promise.allSettled([claim().reviewProductClaim(c1.id,org.id,vendor.id,'confirm'),claim().reviewProductClaim(c2.id,org2.id,other.id,'confirm')]);
  assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
  assert.equal((await db.product.findUnique({where:{id:product.id}})).vendorId,vendor.id);
  assert.equal((await db.productClaimCandidate.findUnique({where:{id:c2.id}})).status,'PENDING');
  assert.equal(await db.productClaimCandidate.count({where:{status:'CONFIRMED'}}),1);
});
test('vendor catalog creation uses session identity and active membership, never payload owner', async () => {
  const {f,vendor,membership}=await setup(); const actions=require(resolve('src/app/vendor/products/actions.ts'));
  const payload={name:'Vendor chair',brand:'Acme',vendorId:'spoof',userId:'spoof',organizationId:'spoof'};
  const result=await actions.publishProduct(payload); assert.equal(result.success,true);
  assert.equal((await db.product.findUnique({where:{id:result.slug}})).vendorId,vendor.id);
  await db.organizationUser.update({where:{id:membership.id},data:{isActive:false}});
  assert.equal((await actions.publishProduct(payload)).success,false);
  await h.login(await f.user()); assert.equal((await actions.publishProduct(payload)).success,false);
  h.anonymous(); assert.equal((await actions.publishProduct(payload)).success,false);
  assert.equal(await db.product.count(),1);
});
test('organization domain hint fails closed without website and cannot derive authority from product URLs', async () => {
  const {f,org,vendor}=await setup(); await db.organization.update({where:{id:org.id},data:{website:null}});
  await f.product({vendorId:vendor.id,url:'https://acme.co.uk/source'});
  const {canClaimOrganization}=require(resolve('src/lib/vendor/domain-verification.ts'));
  assert.equal((await canClaimOrganization(vendor.email,org.id)).allowed,false);
});
test('vendor organization token requires membership, respects recipient, expiry, scope and replay', async () => {
  const {f,org,vendor}=await setup(); await db.organization.update({where:{id:org.id},data:{status:'UNCLAIMED'}});
  const token='cryptographic-fixture-token'; const invite=await db.orgClaimInvite.create({data:{organizationId:org.id,createdById:vendor.id,token,invitedEmail:vendor.email,expiresAt:new Date(Date.now()+60000)}});
  const route=h.route('auth/claim'); const stranger=await f.user(); await h.login(stranger);
  assert.equal((await route.POST(r({token}))).status,403);
  await f.membership(stranger.id,org.id,{role:'MEMBER'});
  assert.equal((await route.POST(r({token}))).status,403, 'Even an active member must match the scoped recipient');
  await h.login(vendor); assert.equal((await route.POST(r({token:'invalid-token'}))).status,404);
  await db.orgClaimInvite.update({where:{id:invite.id},data:{expiresAt:new Date(0)}}); assert.equal((await route.POST(r({token}))).status,400);
  await db.orgClaimInvite.update({where:{id:invite.id},data:{expiresAt:new Date(Date.now()+60000)}});
  assert.equal((await route.POST(r({token,organizationId:'spoof',userId:stranger.id}))).status,200);
  assert.equal((await route.POST(r({token}))).status,400);
  assert.equal((await db.orgClaimInvite.findUnique({where:{id:invite.id}})).claimedById,vendor.id);
  assert.equal(await db.product.count(),0); assert.equal(await db.vendorProductClaim.count(),0);
});
test('organization claim requires verified membership; replay cannot replace claimant', async () => {
  const {f,org,vendor}=await setup(); const route=h.route('vendor/claim');
  const stranger=await f.user({email:'stranger@acme.co.uk'}); await h.login(stranger);
  assert.equal((await route.POST(r({organizationId:org.id,userId:vendor.id}))).status,403);
  await h.login(vendor); await f.product({brand:'Acme',url:'https://acme.co.uk/new',vendorId:null});
  // Avoid only the unrelated five-second enrichment scheduling boundary.
  const original=global.setTimeout; global.setTimeout=()=>({unref(){}});
  try {
    const res=await route.POST(r({organizationId:org.id,vendorId:stranger.id})); const body=await res.json();
    assert.equal(res.status,200,JSON.stringify(body)); assert.equal(body.productsAssigned,1);
    assert.equal((await route.POST(r({organizationId:org.id}))).status,409);
  } finally { global.setTimeout=original; }
  assert.equal((await db.vendorInvite.findUnique({where:{organizationId:org.id}})).claimedByUserId,vendor.id);
});
test('legacy organization claim cannot make a stranger or inactive member vendor owner', async () => {
  const {f,org,vendor,membership}=await setup(); await db.organization.update({where:{id:org.id},data:{status:'UNCLAIMED'}});
  const route=h.route('orgs/[orgId]/claim'); const other=await f.user(); await h.login(other);
  assert.equal((await route.POST(r({userId:vendor.id}),{params:{orgId:org.id}})).status,403);
  await h.login(vendor); await db.organizationUser.update({where:{id:membership.id},data:{isActive:false,role:'OWNER'}});
  assert.equal((await route.POST(r({}),{params:{orgId:org.id}})).status,403);
  assert.equal((await db.organization.findUnique({where:{id:org.id}})).status,'UNCLAIMED');
});
test('organization creation binds membership to the session, not spoofed user or role', async () => {
  const {f,vendor}=await setup(); const other=await f.user(); const route=h.route('organizations');
  h.anonymous(); assert.equal((await route.POST(r({name:'Spoof',type:'VENDOR',userId:other.id}))).status,401);
  // Supply the nested-create database boundary unsupported by the shared double.
  const delegate=db.organization;
  db.organization=new Proxy(delegate,{get:(target,key)=>key==='create'?async args=>{
    const {users,...data}=args.data;const org=await target.create({data});
    await db.organizationUser.create({data:{...users.create,organizationId:org.id}});return org;
  }:target[key]});
  await h.login(vendor); const result=await route.POST(r({name:'New catalog',type:'VENDOR',userId:other.id,userRole:'ADMIN'}));
  assert.equal(result.status,200); const org=await result.json();
  const rows=await db.organizationUser.findMany({where:{organizationId:org.id}});
  assert.equal(rows.length,1); assert.equal(rows[0].userId,vendor.id); assert.equal(rows[0].role,'OWNER');
  assert.equal(org.verifiedAt,null);
});
test('claim invitation sender cannot retarget an existing recipient or another creator invite', async () => {
  const {f,org,vendor}=await setup(); const token='scoped-email-fixture-token';
  await db.orgClaimInvite.create({data:{organizationId:org.id,createdById:vendor.id,token,invitedEmail:vendor.email,expiresAt:new Date(Date.now()+60000)}});
  const route=h.route('orgs/[orgId]/claim-invite/email');
  assert.equal((await route.POST(r({token,recipientEmail:'other@acme.co.uk'}),{params:{orgId:org.id}})).status,409);
  const member=await f.user();await f.membership(member.id,org.id,{role:'MEMBER'});await h.login(member);
  assert.equal((await route.POST(r({token,recipientEmail:vendor.email}),{params:{orgId:org.id}})).status,403);
  assert.equal(h.unexpectedNetwork.length,0);
});
test('professional onboarding cannot join or reactivate a vendor by supplied organization ID', async () => {
  const {f,org,vendor,membership}=await setup();const route=h.route('onboarding/firm/enroll');
  const stranger=await f.user();await h.login(stranger);
  assert.equal((await route.POST(r({mode:'join',organizationId:org.id}))).status,403);
  await h.login(vendor);await db.organizationUser.update({where:{id:membership.id},data:{isActive:false}});
  assert.equal((await route.POST(r({mode:'join',organizationId:org.id}))).status,403);
  assert.equal((await db.organizationUser.findUnique({where:{id:membership.id}})).isActive,false);
  assert.equal(await db.organizationUser.count({where:{userId:stranger.id,organizationId:org.id}}),0);
});
test('turnover reports actual assignments and leaves losing candidate pending', async () => {
  const {f,org,vendor}=await setup();const owner=await f.user();const product=await f.product({vendorId:null,url:'https://acme.co.uk/race'});
  const delegate=db.product;let injected=false;
  db.product=new Proxy(delegate,{get:(target,key)=>key==='findMany'?async args=>{
    const rows=await target.findMany(args);
    if(!injected && args?.where?.vendorId===null){injected=true;await target.update({where:{id:product.id},data:{vendorId:owner.id}});}
    return rows;
  }:target[key]});
  assert.deepEqual(await turnover()(org.id,vendor.id),{matched:0,candidates:0});
  assert.equal((await db.product.findUnique({where:{id:product.id}})).vendorId,owner.id);
  assert.equal((await db.productClaimCandidate.findFirst({where:{productId:product.id}})).status,'PENDING');
});
test('competing confirm and reject cannot rewrite a completed candidate decision', async () => {
  const {f,org,vendor}=await setup();const product=await f.product({vendorId:null});const c=await candidate(org,product);
  const results=await Promise.allSettled(['confirm','reject'].map(action=>claim().reviewProductClaim(c.id,org.id,vendor.id,action)));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal((await db.productClaimCandidate.findUnique({where:{id:c.id}})).status,'CONFIRMED');
  assert.equal((await db.product.findUnique({where:{id:product.id}})).vendorId,vendor.id);
});
test('changing a vendor identity invalidates verification before more existing-product claims', async () => {
  const {f,org,vendor,membership}=await setup();await db.organizationUser.update({where:{id:membership.id},data:{role:'OWNER'}});
  const res=await h.route('orgs/[orgId]').PATCH(r({website:'https://other-brand.test'},'PATCH'),{params:{orgId:org.id}});
  assert.equal(res.status,200,JSON.stringify(await res.json()));
  assert.equal((await db.organization.findUnique({where:{id:org.id}})).verifiedBy,null);
  await assert.rejects(turnover()(org.id,vendor.id));
});
test('mounted discovery action uses server organization context and preserves brand-only review', async () => {
  const {f,org,vendor}=await setup();const product=await f.product({brand:org.name,vendorId:null});
  const route=h.route('vendor/review-queue');const res=await route.POST(r({action:'discover',organizationId:'spoof',vendorId:'spoof'}));
  assert.equal(res.status,200);assert.deepEqual(await res.json(),{matched:0,candidates:1});
  assert.equal((await db.productClaimCandidate.findFirst({where:{productId:product.id}})).organizationId,org.id);
  assert.equal((await db.product.findUnique({where:{id:product.id}})).vendorId,null);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const h = require('./harness.cjs');
const { memoryDatabase } = require('./memory-db.cjs');
const { factories } = require('./fixtures.cjs');
const { NextRequest } = require('next/server');
process.env.INTERVIEW_MEDIA_BUCKET = 'interview-media';
global.React = require('react');
function replace(name, exports) { const p = require.resolve(name.startsWith('src/') ? resolve(name) : name); require.cache[p] = { id:p, filename:p, loaded:true, exports }; }
replace('next/headers', { cookies: () => ({ get: () => undefined }) });
// Serialized transaction/rollback boundary double. Does not emulate PostgreSQL locks.
let db, serial = Promise.resolve(), fail = '', transcriptions = 0, extractions = 0, quoteOutput, afterUpload;
const models = ['interviewSession','mediaAsset','transcriptSegment','quoteHighlight','vendorBoostRequest'];
const prisma = new Proxy({}, { get: (_, model) => {
  if (model === '$transaction') return work => {
    const run = serial.then(async () => {
      const snapshots = await Promise.all(models.map(m => db[m].findMany()));
      try { return await work(prisma); } catch (err) {
        for (let i=0;i<models.length;i++) { await db[models[i]].deleteMany(); for (const data of snapshots[i]) await db[models[i]].create({data}); }
        throw err;
      }
    });
    serial = run.catch(() => {}); return run;
  };
  if (!models.includes(model)) return db[model];
  return new Proxy({}, { get: (_, op) => async args => {
    if (fail === model + '.' + op) throw Error('Fixture persistence failure');
    if (op === 'createMany') { for (const data of args.data) { assert.ok(data.id); if (model === 'quoteHighlight') assert.ok(data.updatedAt); await db[model].create({data}); } return {count:args.data.length}; }
    if (op === 'delete') { const found=await db[model].findUnique({where:args.where}); await db[model].deleteMany({where:args.where}); return found; }
    if (op === 'create') { assert.ok(args.data.id); assert.ok(args.data.updatedAt); }
    return db[model][op](args);
  } });
} });
replace('src/lib/prisma', { prisma });
const bytes = Buffer.from([0x1a,0x45,0xdf,0xa3,0x9f,0x42,0x82,0x84,0x77,0x65,0x62,0x6d,0,0,0]);
const objects = new Map(), calls = [];
replace('src/lib/supabaseAdmin', { supabaseAdmin:{ storage:{ from:bucket => {
  assert.equal(bucket,'interview-media');
  return {
    upload: async (key, data, options) => { calls.push({op:'upload',key,options}); if(fail==='storage')return {error:Error('fixture')}; assert.equal(options.upsert,false); objects.set(key,Buffer.from(data)); if(afterUpload)await afterUpload(); return {data:{path:key},error:null}; },
    remove: async keys => { calls.push({op:'remove',keys}); if(fail==='cleanup')return {error:Error('fixture')}; for(const key of keys)objects.delete(key); return {error:null}; },
    download: async key => { calls.push({op:'download',key}); return objects.has(key) ? {data:new Blob([objects.get(key)],{type:'audio/webm'}),error:null}:{data:null,error:Error('missing')}; },
    createSignedUrl: async (key,ttl) => { calls.push({op:'sign',key,ttl}); return {data:{signedUrl:'https://storage.test/private-fixture?token=bounded'},error:null}; },
    getPublicUrl: () => { throw Error('Public media URL forbidden'); },
  };
} } } });
replace('src/lib/interviews/providers', {
  transcribeRecording: async file => { transcriptions++; assert.equal(file.type,'audio/webm'); if(fail==='transcribe')throw Error('provider token must not leak'); return {text:'The oak softened the room.',duration:2,segments:[{start:0,end:2,text:'The oak softened the room.'}]}; },
  extractRecordingQuotes: async () => { extractions++; if(fail==='extract')throw Error('provider token must not leak'); return quoteOutput; },
});
async function setup(status='DRAFT') {
  db=memoryDatabase();h.useDatabase(db); const f=factories(db);
  const owner=await f.user(), other=await f.user(), vendor=await f.user({role:'VENDOR'}), project=await f.project(owner.id), product=await f.product();
  const interview=await db.interviewSession.create({data:{id:randomUUID(),createdByUserId:owner.id,projectId:project.id,productId:product.id,status,mode:'AUDIO',updatedAt:new Date()}});
  fail=''; transcriptions=0;extractions=0;afterUpload=null;objects.clear();calls.length=0;
  quoteOutput=[{startMs:0,endMs:2000,quoteText:'The oak softened the room.',useCase:'PRODUCT_PAGE_INSIGHT',score:0.9}];
  process.env.INTERVIEW_MEDIA_BUCKET='interview-media';
  await h.login(owner); return {f,owner,other,vendor,project,product,interview};
}
function req(data=bytes,type='audio/webm') { const body=new FormData();body.set('file',new Blob([data],{type}),'evil.mp4'); return new NextRequest('http://folio.test/api/interviews/upload',{method:'POST',body}); }
const params = id => ({params:{id}});
const state = id => db.interviewSession.findUnique({where:{id}});
const upload = id => h.route('interviews/[id]/upload').POST(req(),params(id));
const processInterview = id => h.route('interviews/[id]/process').POST(h.request({productId:'spoof'}),params(id));
async function uploaded(ctx) { assert.equal((await upload(ctx.interview.id)).status,200); return state(ctx.interview.id); }
async function extracted(ctx) { await uploaded(ctx);assert.equal((await processInterview(ctx.interview.id)).status,200);return db.quoteHighlight.findFirst(); }

test('client format accepts intended WebM/Opus only; missing/unsupported capability fails explicitly',()=>{
  const {supportsInterviewRecording,RECORDER_MIME}=require(resolve('src/lib/interviews/format'));
  assert.equal(supportsInterviewRecording(undefined),false);assert.equal(supportsInterviewRecording({}),false);
  assert.equal(supportsInterviewRecording({isTypeSupported:()=>false}),false);
  assert.equal(supportsInterviewRecording({isTypeSupported:m=>m===RECORDER_MIME}),true);
});
test('owner upload has unique private canonical linkage, explicit fields and no public URL',async()=>{
  const c=await setup();const res=await upload(c.interview.id);assert.equal(res.status,200);
  const saved=await state(c.interview.id);assert.equal(saved.status,'UPLOADED');
  const asset=await db.mediaAsset.findUnique({where:{id:saved.recordingAssetId}});
  assert.match(asset.storageKey,new RegExp('^interviews/'+saved.id+'/[0-9a-f-]{36}\\.webm$'));
  assert.equal(asset.metadata.bucket,'interview-media');assert.match(asset.url,/^storage:\/\//);assert.ok(asset.updatedAt);
  assert.equal((await res.json()).url,undefined);assert.equal(objects.size,1);
});
test('anonymous, other designer, vendor, swapped session are denied before storage',async()=>{
  const c=await setup();h.anonymous();assert.equal((await upload(c.interview.id)).status,401);
  for(const user of [c.other,c.vendor]) {await h.login(user);assert.equal((await upload(c.interview.id)).status,403);}
  await h.login(c.owner);assert.equal((await upload(randomUUID())).status,404);assert.equal(calls.length,0);
});
test('MIME, empty, oversized and mismatched container rejected before storage; absent config fails closed',async()=>{
  const c=await setup();const post=h.route('interviews/[id]/upload').POST;
  for(const [data,type,status]of [[bytes,'audio/mp4',400],[bytes,'video/webm',400],['','audio/webm',400],['fake','audio/webm',400],[Buffer.alloc(4194305),'audio/webm',413]])assert.equal((await post(req(data,type),params(c.interview.id))).status,status);
  delete process.env.INTERVIEW_MEDIA_BUCKET;assert.equal((await upload(c.interview.id)).status,500);assert.equal(calls.length,0);
});
test('storage failure cannot create asset or report uploaded',async()=>{
  const c=await setup();fail='storage';assert.equal((await upload(c.interview.id)).status,502);
  assert.equal((await state(c.interview.id)).status,'DRAFT');assert.equal(await db.mediaAsset.count(),0);
});
test('DB create/link failures compensate new object and rollback both database rows',async()=>{
  for(const failure of ['mediaAsset.create','interviewSession.updateMany']){
    const c=await setup();fail=failure;assert.equal((await upload(c.interview.id)).status,409);
    assert.equal(objects.size,0);assert.ok(calls.some(c=>c.op==='remove'));assert.equal(await db.mediaAsset.count(),0);assert.equal((await state(c.interview.id)).status,'DRAFT');
  }
});
test('cleanup failure is safe orphan event, never uploaded success',async()=>{
  const c=await setup();afterUpload=async()=>{fail='cleanup';await db.interviewSession.update({where:{id:c.interview.id},data:{status:'ARCHIVED'}})};
  const logs=[];const warn=console.warn;console.warn=(...v)=>logs.push(v.join(' '));
  try{assert.equal((await upload(c.interview.id)).status,409);}finally{console.warn=warn;}
  assert.deepEqual(logs,['[interview-media] orphan-cleanup-failed']);assert.equal(await db.mediaAsset.count(),0);assert.equal(objects.size,1);
});
test('failed replacement preserves prior valid asset/object; successful replacement uses new identity',async()=>{
  const c=await setup();const first=await uploaded(c);const old=await db.mediaAsset.findUnique({where:{id:first.recordingAssetId}});
  fail='interviewSession.updateMany';assert.equal((await upload(c.interview.id)).status,409);
  assert.equal((await state(c.interview.id)).recordingAssetId,old.id);assert.ok(objects.has(old.storageKey));assert.equal(await db.mediaAsset.count(),1);
  fail='';assert.equal((await upload(c.interview.id)).status,200);const next=await state(c.interview.id);
  assert.notEqual(next.recordingAssetId,old.id);assert.equal(await db.mediaAsset.count(),1);assert.equal(objects.size,1);assert.equal(objects.has(old.storageKey),false);
});
test('simultaneous uploads select one winner and compensate loser; later states reject replacement',async()=>{
  const c=await setup();const results=await Promise.all([upload(c.interview.id),upload(c.interview.id)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(objects.size,1);assert.equal(await db.mediaAsset.count(),1);
  for(const status of ['TRANSCRIBING','TRANSCRIBED','EXTRACTING','EXTRACTED','CLIPPING','READY','PUBLISHED','ARCHIVED']){
    await db.interviewSession.update({where:{id:c.interview.id},data:{status}});assert.equal((await upload(c.interview.id)).status,409);
  }
});
test('signed reads authorize owner first, bind current session asset, use five minutes and no-store',async()=>{
  const c=await setup();await uploaded(c);const get=h.route('interviews/[id]/media').GET;
  h.anonymous();assert.equal((await get(h.request(),params(c.interview.id))).status,401);
  for(const user of [c.other,c.vendor]){await h.login(user);assert.equal((await get(h.request(),params(c.interview.id))).status,403);}
  assert.equal(calls.some(c=>c.op==='sign'),false);await h.login(c.owner);
  const response=await get(h.request(),params(c.interview.id));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal((await response.json()).expiresIn,300);assert.equal(calls.find(c=>c.op==='sign').ttl,300);
  const saved=await state(c.interview.id);await db.mediaAsset.update({where:{id:saved.recordingAssetId},data:{storageKey:'interviews/other/recording.webm'}});
  assert.equal((await get(h.request(),params(c.interview.id))).status,503);assert.equal(calls.filter(c=>c.op==='sign').length,1);
});
test('process rejects missing media and all unauthorized identities',async()=>{
  const c=await setup('UPLOADED');assert.equal((await processInterview(c.interview.id)).status,400);
  h.anonymous();assert.equal((await processInterview(c.interview.id)).status,401);
  for(const user of [c.other,c.vendor]){await h.login(user);assert.equal((await processInterview(c.interview.id)).status,403);}
  assert.equal(transcriptions,0);
});
test('transcription failure resets UPLOADED; retry succeeds with persisted transcript-backed quotes',async()=>{
  const c=await setup();await uploaded(c);fail='transcribe';
  const failed=await processInterview(c.interview.id);assert.equal(failed.status,502);assert.doesNotMatch(JSON.stringify(await failed.json()),/token/);
  assert.equal((await state(c.interview.id)).status,'UPLOADED');assert.equal(await db.transcriptSegment.count(),0);
  fail='';assert.equal((await processInterview(c.interview.id)).status,200);assert.equal(transcriptions,2);assert.equal(await db.transcriptSegment.count(),1);assert.equal(await db.quoteHighlight.count(),1);
  assert.equal((await db.quoteHighlight.findFirst()).interviewSessionId,c.interview.id);
});
test('extraction retry from TRANSCRIBED never retranscribes; invented quote skipped',async()=>{
  const c=await setup();await uploaded(c);fail='extract';
  assert.equal((await processInterview(c.interview.id)).status,502);assert.equal((await state(c.interview.id)).status,'TRANSCRIBED');
  assert.equal(await db.transcriptSegment.count(),1);fail='';
  quoteOutput.push({...quoteOutput[0],quoteText:'Invented designer speech.'});
  assert.equal((await processInterview(c.interview.id)).status,200);assert.equal(transcriptions,1);assert.equal(extractions,2);assert.equal(await db.quoteHighlight.count(),1);
  assert.equal((await processInterview(c.interview.id)).status,409);
});
test('all invented or mis-timed quotes fail extraction without erasing saved transcript',async()=>{
  const c=await setup();await uploaded(c);quoteOutput=[{...quoteOutput[0],endMs:1000},{...quoteOutput[0],quoteText:'A paraphrase.'}];
  assert.equal((await processInterview(c.interview.id)).status,502);assert.equal((await state(c.interview.id)).status,'TRANSCRIBED');assert.equal(await db.quoteHighlight.count(),0);assert.equal(await db.transcriptSegment.count(),1);
});
test('database stage failures rollback rows and preserve truthful retry stage',async()=>{
  for(const [failure,status,count]of [['transcriptSegment.createMany','UPLOADED',0],['quoteHighlight.createMany','TRANSCRIBED',1]]){
    const c=await setup();await uploaded(c);fail=failure;assert.equal((await processInterview(c.interview.id)).status,502);
    assert.equal((await state(c.interview.id)).status,status);assert.equal(await db.transcriptSegment.count(),count);assert.equal(await db.quoteHighlight.count(),0);
  }
});
test('competing process calls execute transcription once and cannot replay completed stages',async()=>{
  const c=await setup();await uploaded(c);const responses=await Promise.all([processInterview(c.interview.id),processInterview(c.interview.id)]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(transcriptions,1);assert.equal(extractions,1);
});
test('approval and publish enforce owner, source membership, provenance and legal transitions',async()=>{
  const c=await setup();const quote=await extracted(c);const approve=h.route('interviews/[id]/approve-highlights').POST,publish=h.route('interviews/[id]/publish').POST;
  await h.login(c.other);assert.equal((await approve(h.request({highlightIds:[quote.id]}),params(c.interview.id))).status,403);assert.equal((await publish(h.request({}),params(c.interview.id))).status,403);
  await h.login(c.owner);assert.equal((await publish(h.request({}),params(c.interview.id))).status,409);
  assert.equal((await approve(h.request({highlightIds:[randomUUID()]}),params(c.interview.id))).status,409);assert.equal((await state(c.interview.id)).status,'EXTRACTED');
  assert.equal((await approve(h.request({highlightIds:[quote.id],rejectIds:[quote.id]}),params(c.interview.id))).status,400);
  assert.equal((await approve(h.request({highlightIds:[quote.id]}),params(c.interview.id))).status,200);assert.equal((await state(c.interview.id)).status,'READY');
  assert.equal((await publish(h.request({vendorId:'spoof'}),params(c.interview.id))).status,200);
  assert.equal((await publish(h.request({}),params(c.interview.id))).status,409);
  assert.equal((await approve(h.request({highlightIds:[quote.id]}),params(c.interview.id))).status,409);
});
test('public insight query ignores approvedOnly=false and hides draft interview/project',async()=>{
  const c=await setup();const quote=await extracted(c);const get=h.route('products/[productId]/insights').GET;
  const query=()=>get(new NextRequest('http://folio.test/api/insights?approvedOnly=false'),{params:{productId:c.product.id}});
  h.anonymous();assert.equal((await (await query()).json()).insights.length,0);
  await db.quoteHighlight.update({where:{id:quote.id},data:{approvedByDesigner:true}});
  await db.interviewSession.update({where:{id:c.interview.id},data:{status:'PUBLISHED'}});
  assert.equal((await (await query()).json()).insights.length,0);
  await db.project.update({where:{id:c.project.id},data:{isPublic:true}});
  const json=await (await query()).json();assert.equal(json.insights.length,1);assert.doesNotMatch(JSON.stringify(json),/storageKey|storage:\/\/|signedUrl/);
  await db.quoteHighlight.update({where:{id:quote.id},data:{approvedByDesigner:false}});assert.equal((await (await query()).json()).insights.length,0);
});
test('review pages and status deny nonowners including sessions with vendor context',async()=>{
  const c=await setup();await extracted(c);await db.interviewSession.update({where:{id:c.interview.id},data:{vendorId:randomUUID()}});
  const pages=['src/app/designer/interviews/[id]/page.tsx','src/app/designer/interviews/[id]/approve/page.tsx'].map(p=>require(resolve(p)).default);
  for(const user of [c.other,c.vendor]){await h.login(user);for(const page of pages)await assert.rejects(()=>page(params(c.interview.id)),/NEXT_NOT_FOUND/);assert.equal((await h.route('interviews/[id]/status').GET(h.request(),params(c.interview.id))).status,403);}
});
test('retired upload protocols cannot sign or persist supplied object references',async()=>{
  await setup();h.anonymous();db.calls.length=0;
  for(const path of ['upload-url','confirm-upload'])assert.equal((await h.route('interviews/[id]/'+path).POST(h.request({storageKey:'other/key',url:'https://evil.test'}),params('other'))).status,410);
  assert.equal(db.calls.length,0);assert.equal(calls.length,0);
});
test('legacy persisted boost acceptance copies all server context atomically; request adapter remains blocked',async()=>{
  const c=await setup();const legacy=await db.vendor.create({data:{id:randomUUID(),name:'Historical vendor',updatedAt:new Date()}});
  const boost=await db.vendorBoostRequest.create({data:{id:randomUUID(),vendorId:legacy.id,projectId:c.project.id,productId:c.product.id,requestedDesignerId:c.owner.id,status:'PENDING',updatedAt:new Date()}});
  const accept=h.route('vendor-boost/[id]/accept').POST;
  await h.login(c.other);assert.equal((await accept(h.request({}),params(boost.id))).status,403);await h.login(c.owner);
  const response=await accept(h.request({projectId:'spoof',productId:'spoof',vendorId:'spoof'}),params(boost.id));assert.equal(response.status,200);
  const id=(await response.json()).interviewSession.id;const saved=await state(id);
  assert.equal(saved.projectId,boost.projectId);assert.equal(saved.productId,boost.productId);assert.equal(saved.vendorId,legacy.id);assert.equal(saved.vendorBoostRequestId,boost.id);
  assert.equal((await accept(h.request({}),params(boost.id))).status,409);
  const org=await c.f.organization({type:'VENDOR'});await c.f.membership(c.vendor.id,org.id);await h.login(c.vendor);
  assert.equal((await h.route('vendor-boost/request').POST(h.request({}))).status,503);
  assert.equal(await db.vendorBoostRequest.count(),1);
});
test('create refuses video, unauthorized project, invalid product and boost context substitution',async()=>{
  const c=await setup();const post=h.route('interviews/create').POST;
  assert.equal((await post(h.request({projectId:c.project.id,mode:'VIDEO'}))).status,400);
  await h.login(c.other);assert.equal((await post(h.request({projectId:c.project.id}))).status,403);
  await h.login(c.owner);assert.equal((await post(h.request({productId:randomUUID()}))).status,404);
  assert.equal((await post(h.request({projectId:c.project.id,vendorId:'spoof'}))).status,200);
  const rows=await db.interviewSession.findMany();assert.equal(rows[1].vendorId,null);assert.ok(rows[1].id);
});
test('canonical vendor-to-boost creation awaits approved User FK migration', {skip:'No trustworthy User/Organization -> historical Vendor adapter; Prisma approval required'},()=>{});


test('approval/publish/status reject anonymous and vendor role even if creator ID matches',async()=>{
  const c=await setup();const quote=await extracted(c);
  for(const endpoint of ['approve-highlights','publish','status']){
    const route=h.route('interviews/[id]/'+endpoint), call=()=>endpoint==='status'?route.GET(h.request(),params(c.interview.id)):route.POST(h.request({highlightIds:[quote.id]}),params(c.interview.id));
    h.anonymous();assert.equal((await call()).status,401);
    await db.user.update({where:{id:c.owner.id},data:{role:'VENDOR'}});await h.login({...c.owner,role:'VENDOR'});assert.equal((await call()).status,403);
  }
});
test('approval refuses corrupted quote provenance and rolls READY back to EXTRACTED',async()=>{
  const c=await setup();const quote=await extracted(c);
  await db.quoteHighlight.update({where:{id:quote.id},data:{quoteText:'Invented speech'}});
  const response=await h.route('interviews/[id]/approve-highlights').POST(h.request({highlightIds:[quote.id]}),params(c.interview.id));
  assert.equal(response.status,409);assert.equal((await state(c.interview.id)).status,'EXTRACTED');assert.equal((await db.quoteHighlight.findFirst()).approvedByDesigner,false);
});
test('project quote reader keeps access checks and ignores unapproved exposure override',async()=>{
  const c=await setup();const quote=await extracted(c);
  await db.quoteHighlight.update({where:{id:quote.id},data:{useCase:'EDITORIAL_PULLQUOTE'}});
  const get=()=>h.route('projects/[id]/interview-quotes').GET(new NextRequest('http://folio.test/api/quotes?approvedOnly=false'),params(c.project.id));
  h.anonymous();assert.equal((await get()).status,401);await h.login(c.other);assert.equal((await get()).status,403);
  await h.login(c.owner);assert.equal((await (await get()).json()).quotes.length,0);
  await db.quoteHighlight.update({where:{id:quote.id},data:{approvedByDesigner:true}});assert.equal((await (await get()).json()).quotes.length,0);
  await db.interviewSession.update({where:{id:c.interview.id},data:{status:'PUBLISHED'}});assert.equal((await (await get()).json()).quotes.length,1);
});
test('legacy boost acceptance rolls back on session failure and forbids expiry/replay/context override',async()=>{
  const c=await setup();
  const boost=await db.vendorBoostRequest.create({data:{id:randomUUID(),vendorId:randomUUID(),projectId:c.project.id,productId:c.product.id,requestedDesignerId:c.owner.id,status:'PENDING',updatedAt:new Date()}});
  const accept=()=>h.route('vendor-boost/[id]/accept').POST(h.request({}),params(boost.id));
  fail='interviewSession.create';assert.equal((await accept()).status,409);
  assert.equal((await db.vendorBoostRequest.findUnique({where:{id:boost.id}})).status,'PENDING');
  assert.equal(await db.interviewSession.count(),1);fail='';
  await db.vendorBoostRequest.update({where:{id:boost.id},data:{expiresAt:new Date(0)}});assert.equal((await accept()).status,409);
  await db.vendorBoostRequest.update({where:{id:boost.id},data:{expiresAt:null}});
  const response=await accept();assert.equal(response.status,200);
  const id=(await response.json()).interviewSession.id;
  const create=h.route('interviews/create').POST;
  assert.equal((await create(h.request({vendorBoostRequestId:boost.id,productId:randomUUID()}))).status,409);
  assert.equal((await create(h.request({vendorBoostRequestId:boost.id,projectId:randomUUID()}))).status,409);
  const resumed=await create(h.request({vendorBoostRequestId:boost.id}));assert.equal(resumed.status,200);assert.equal((await resumed.json()).interviewSession.id,id);assert.equal(await db.interviewSession.count(),2);
  assert.equal((await h.route('vendor-boost/[id]/decline').POST(h.request({}),params(boost.id))).status,409);
});
test('stage claim cannot write after ownership changes during external work',async()=>{
  const c=await setup();await uploaded(c);
  // Replace only the provider boundary for this call; route references the original export object.
  const provider=require(resolve('src/lib/interviews/providers'));
  const original=provider.transcribeRecording;
  provider.transcribeRecording=async file=>{await db.interviewSession.update({where:{id:c.interview.id},data:{createdByUserId:c.other.id}});return original(file);};
  try{assert.equal((await processInterview(c.interview.id)).status,502);}finally{provider.transcribeRecording=original;}
  assert.equal(await db.transcriptSegment.count(),0);assert.equal(await db.quoteHighlight.count(),0);
});
test('provider adapter parses real SDK-shaped responses without network or transcription substitution',async()=>{
  await setup();let prompt;
  replace('@anthropic-ai/sdk',class {messages={create:async input=>{prompt=input;return {content:[{type:'text',text:JSON.stringify(quoteOutput)}]};}}});
  replace('openai',class {audio={transcriptions:{create:async input=>{assert.equal(input.model,'whisper-1');return {text:'The oak softened the room.',duration:2,segments:[{start:0,end:2,text:'The oak softened the room.'}]};}}}});
  const path=require.resolve(resolve('src/lib/interviews/providers'));const previous=require.cache[path];delete require.cache[path];
  try{
    const provider=require(path);assert.equal((await provider.transcribeRecording(new File([bytes],'recording.webm',{type:'audio/webm'}))).segments.length,1);
    assert.deepEqual(await provider.extractRecordingQuotes({project:null,product:null},[{start:0,end:2000,text:'The oak softened the room.'}],['PRODUCT_PAGE_INSIGHT']),quoteOutput);
    assert.match(prompt.messages[0].content,/0ms-2000ms: The oak softened the room/);assert.match(prompt.messages[0].content,/verbatim/);
  }finally{require.cache[path]=previous;}
  assert.equal(h.unexpectedNetwork.length,0);
});

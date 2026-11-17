// Bulk orchestration uses the existing, separately tested portfolio publisher.
const assert=require('node:assert/strict'),path=require('node:path');
function replace(name,exports){const id=require.resolve(name.startsWith('src/')?path.resolve(name):name);require.cache[id]={id,filename:id,loaded:true,exports};}
replace('server-only',{});
const ids=['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
let permission=true,owner='owner',phase='complete',lease,failSecond=false,allowProjects=true,calls=[];
replace('src/lib/permissions.ts',{canPublishFromOrg:async()=>({ok:permission})});
replace('src/lib/authz/access.ts',{});
class WorkspaceImportError extends Error{constructor(message,status=400){super(message);this.status=status}}
replace('src/lib/workspace-import/store.ts',{WorkspaceImportError,ownedImport:async actor=>{if(actor!==owner)throw new WorkspaceImportError('Forbidden',403);return{run:{orgId:'studio',phase,lease,projects:ids.map(projectId=>({projectId}))}}}});
const photos=[{id:'11111111-1111-4111-8111-111111111111',url:'https://image.test/photo',name:'Living room',inclusion:'INCLUDED',roomId:null,updatedAt:new Date(0)},
  {id:'22222222-2222-4222-8222-222222222222',url:'https://image.test/spec',name:'finish-schedule.pdf',inclusion:'EXCLUDED',roomId:null,updatedAt:new Date(0)}];
const projects=ids.map(id=>({id,title:'House',updatedAt:new Date(0),portfolioPublishedAt:null,portfolioCoverImageId:null,post:{status:'DRAFT'},images:photos}));
replace('src/lib/prisma.ts',{prisma:{project:{findMany:async q=>{assert.equal(q.where.ownerId,'owner');assert.equal(q.where.designerOrgId,'studio');return allowProjects?projects.filter(p=>q.where.id.in.includes(p.id)):[]}}}});
const portfolio=require('../src/lib/publish/portfolio.ts');
replace('src/lib/publish/portfolio.ts',{...portfolio,publishPortfolio:async(actor,input)=>{assert.equal(actor,'owner');calls.push(input);if(failSecond&&input.projectId===ids[1])throw Error('Stale review');return{projectId:input.projectId}}});
const batch=require('../src/lib/workspace-import/publish.ts');
(async()=>{
  const review=await batch.readImportPublication('owner','import');assert.equal(review.projects.length,2);
  assert.equal(review.projects[0].photos.length,1,'Documents stay out of photo approval');
  assert.equal(review.projects[0].version,portfolio.portfolioReviewVersion(projects[0]));
  assert.equal(review.projects[0].photos[0].id,photos[0].id);assert.equal(review.projects[0].updatedAt,undefined);
  const input={projects:review.projects.map(p=>({projectId:p.projectId,title:p.title,version:p.version,coverImageId:photos[0].id,includedImageIds:[photos[0].id]}))};
  await assert.rejects(batch.publishImport('outsider','import',input),e=>e.status===403);
  permission=false;await assert.rejects(batch.publishImport('owner','import',input),e=>e.status===403);permission=true;
  phase='projects';await assert.rejects(batch.publishImport('owner','import',input),e=>e.status===409);phase='complete';
  lease={until:'2099-01-01T00:00:00.000Z'};await assert.rejects(batch.publishImport('owner','import',input),e=>e.status===409);lease=undefined;
  await assert.rejects(batch.publishImport('owner','import',{projects:[input.projects[0],input.projects[0]]}),e=>e.status===403);
  await assert.rejects(batch.publishImport('owner','import',{projects:[{...input.projects[0],projectId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}]}),e=>e.status===403);
  allowProjects=false;await assert.rejects(batch.publishImport('owner','import',input),e=>e.status===409);allowProjects=true;
  assert.equal(calls.length,0,'Reject the entire foreign or incomplete batch before publication begins');
  failSecond=true;let result=await batch.publishImport('owner','import',input);
  assert.deepEqual(result.results.map(r=>r.published),[true,false]);assert.deepEqual(calls,input.projects);
  failSecond=false;result=await batch.publishImport('owner','import',{projects:[input.projects[1]]});assert.equal(result.results[0].published,true);
  console.log('PASS imported-photo publication: ready import, active publisher, exact reviewed versions, scoped project set, partial results and retry delegation');
})().catch(e=>{console.error(e);process.exitCode=1});

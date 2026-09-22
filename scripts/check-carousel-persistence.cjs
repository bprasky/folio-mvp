const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const file='src/app/api/instagram-export/generate-images/route.ts';
let user='u1',published=true,owner='u1',record={id:'saved',projectId:'p1',designerId:'u1',config:{studioCardId:'project:p1',pitch:'A concrete decision',captionOptions:['Draft one','Draft two']},updatedAt:new Date('2026-09-01T00:00:00Z')},writes=[],renders=0,conflict=false,orgWrite=false;
const firstRecords=new Map();
const prisma={project:{findUnique:async()=>({id:'p1',ownerId:owner,designerId:owner,title:'Home',post:{status:published?'PUBLISHED':'DRAFT'},images:[{url:'https://fixture.test/a.jpg'}]})},instagramExport:{findFirst:async({where})=>{const item=firstRecords.get(where.id)||record;return item && ['id','projectId','designerId'].every(k=>item[k]===where[k])?item:null},updateMany:async(args)=>{writes.push(args);return {count:conflict?0:1}},create:async(args)=>{if(args.data.id&&firstRecords.has(args.data.id))throw Object.assign(Error('Unique'),{code:'P2002'});writes.push(args);if(args.data.id)firstRecords.set(args.data.id,{...args.data});return{id:args.data.id||'new'}}}};
const mocks={'crypto':require('crypto'),'next/cache':{revalidatePath(){}},'@/lib/publishing-studio/data':{StudioAccessError:class extends Error {},getStudioData:async()=>({projects:[{id:'p1',canCreateCampaign:true}],feed:firstRecords.size?[]:[{id:'project:p1',revision:'v1',kind:'suggestion',canPolish:true,projectIds:['p1']}]})},'@/lib/authz/access':{assertProjectWrite:async()=>{if(owner!==user&&!orgWrite)throw Error('Forbidden')}},'next/server':{NextResponse:{json:(body,opts)=>({body,status:opts?.status||200})}},'next-auth':{getServerSession:async()=>user?{user:{id:user}}:null},'@/app/api/auth/[...nextauth]/options':{},'@/lib/prisma':{prisma},'@/lib/instagram-export/generate-images':{generateAllSlides:async()=>{renders++;return[{slideIndex:0,type:'hero',buffer:Buffer.from('fixture')}]}}};
const loaded={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:loaded.exports,module:loaded,require:id=>{assert.ok(id in mocks,id);return mocks[id]},console,Date,Buffer});
const request={projectId:'p1',config:{headline:'Saved headline',selectedImageUrls:['https://fixture.test/a.jpg']},caption:'Saved caption',exportId:'saved',expectedUpdatedAt:record.updatedAt.toISOString(),saveOnly:true};
const call=body=>loaded.exports.POST({json:async()=>body});
async function main(){
 let result=await call(request);assert.equal(result.status,200);assert.equal(renders,0);assert.equal(writes[0].data.caption,'Saved caption');assert.equal(writes[0].data.config.studioCardId,'project:p1');assert.equal(writes[0].data.config.pitch,'A concrete decision');assert.equal(writes[0].data.config.captionOptions.length,2);assert.equal(writes[0].data.status,'draft');assert.equal(writes[0].where.id,'saved');assert.equal(result.body.export.id,'saved');
 writes=[];result=await call({...request,saveOnly:false});assert.equal(result.status,200);assert.equal(renders,1);assert.equal(writes.length,1);assert.equal(writes[0].where.id,'saved');assert.equal(writes[0].data.status,'generated');
 writes=[];result=await call({...request,exportId:undefined,expectedUpdatedAt:undefined});assert.equal(result.status,200);assert.equal(result.body.export.id,'new');assert.equal(writes[0].data.designerId,'u1');
 writes=[];result=await call({...request,exportId:undefined,config:{...request.config,studioCardId:'project:p1',studioRevision:'v1'}});assert.equal(result.status,200);assert.equal(writes[0].data.config.studioCardId,'project:p1');
 writes=[];result=await call({...request,exportId:undefined,config:{...request.config,studioCardId:'project:p1',studioRevision:'old'}});assert.equal(result.status,409);assert.equal(writes.length,0);
 const firstRequest={...request,exportId:undefined,config:{...request.config,studioCardId:'project:p1',studioRevision:'v1'}};
 const firstRecord=[...firstRecords.values()][0];
 writes=[];result=await call(firstRequest);assert.equal(result.status,200,'Lost-response retry recovers saved draft even after suggestion disappears');assert.equal(result.body.export.id,firstRecord.id);assert.equal(result.body.export.updatedAt,firstRecord.updatedAt.toISOString());assert.equal(writes.length,0);
 result=await call({...firstRequest,caption:'Competing edit'});assert.equal(result.status,409);assert.equal(firstRecord.caption,'Saved caption');assert.equal(writes.length,0);
 firstRecords.clear();writes=[];const simultaneous=await Promise.all([call(firstRequest),call({...firstRequest,caption:'Different concurrent draft'})]);assert.deepEqual(simultaneous.map(x=>x.status).sort(),[200,409]);assert.equal(firstRecords.size,1);assert.equal(writes.length,1);
 firstRecords.clear();writes=[];const repeated=await Promise.all([call(firstRequest),call(firstRequest)]);assert.deepEqual(repeated.map(x=>x.status),[200,200]);assert.equal(firstRecords.size,1);assert.equal(writes.length,1);
 const winner=[...firstRecords.values()][0];delete winner.config.firstSaveFingerprint;winner.caption='Later deliberate edit';writes=[];result=await call(firstRequest);assert.equal(result.status,409);assert.equal(winner.caption,'Later deliberate edit');assert.equal(writes.length,0);
 firstRecords.clear();
 result=await call({...request,config:{...request.config,slideCount:2,pitch:'Revised angle'}});assert.equal(result.status,200);assert.equal(writes.at(-1).data.config.pitch,'Revised angle');
 result=await call({...request,config:{...request.config,beats:[{}]}});assert.equal(result.status,400);
 writes=[];const previousRenders=renders;result=await call({...request,expectedUpdatedAt:'old',saveOnly:false});assert.equal(result.status,409);assert.equal(renders,previousRenders);assert.equal(writes.length,0);
 for(const overrides of [{projectId:'other'},{exportId:'other'}]){result=await call({...request,...overrides,saveOnly:false});assert.equal(result.status,404)}
 result=await call({...request,config:{...request.config,selectedImageUrls:['https://foreign.test/image']},saveOnly:false});assert.equal(result.status,400);assert.equal(renders,previousRenders);
 conflict=true;result=await call(request);assert.equal(result.status,409);conflict=false;
 owner='other';result=await call(request);assert.equal(result.status,403);orgWrite=true;result=await call(request);assert.equal(result.status,200);orgWrite=false;owner='u1';
 published=false;result=await call(request);assert.equal(result.status,404);published=true;
 user=null;result=await call(request);assert.equal(result.status,401);
 console.log('Carousel persistence API checks passed: save without render, caption, stable record, new insert, ownership/project, stale and racing writes, unpublished/auth/image gates.');
}
main().catch(error=>{console.error(error);process.exitCode=1});

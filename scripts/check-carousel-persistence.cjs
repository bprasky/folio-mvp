const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const file='src/app/api/instagram-export/generate-images/route.ts';
let user='u1',published=true,owner='u1',record={id:'saved',projectId:'p1',designerId:'u1',config:{studioCardId:'project:p1'},updatedAt:new Date('2026-09-01T00:00:00Z')},writes=[],renders=0,conflict=false,orgWrite=false;
const prisma={project:{findUnique:async()=>({id:'p1',ownerId:owner,designerId:owner,title:'Home',post:{status:published?'PUBLISHED':'DRAFT'},images:[{url:'https://fixture.test/a.jpg'}]})},instagramExport:{findFirst:async({where})=>record && ['id','projectId','designerId'].every(k=>record[k]===where[k])?record:null,updateMany:async(args)=>{writes.push(args);return {count:conflict?0:1}},create:async(args)=>{writes.push(args);return{id:'new'}}}};
const mocks={'@/lib/authz/access':{assertProjectWrite:async()=>{if(owner!==user&&!orgWrite)throw Error('Forbidden')}},'next/server':{NextResponse:{json:(body,opts)=>({body,status:opts?.status||200})}},'next-auth':{getServerSession:async()=>user?{user:{id:user}}:null},'@/app/api/auth/[...nextauth]/options':{},'@/lib/prisma':{prisma},'@/lib/instagram-export/generate-images':{generateAllSlides:async()=>{renders++;return[{slideIndex:0,type:'hero',buffer:Buffer.from('fixture')}]}}};
const loaded={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:loaded.exports,module:loaded,require:id=>{assert.ok(id in mocks,id);return mocks[id]},console,Date,Buffer});
const request={projectId:'p1',config:{headline:'Saved headline',selectedImageUrls:['https://fixture.test/a.jpg']},caption:'Saved caption',exportId:'saved',expectedUpdatedAt:record.updatedAt.toISOString(),saveOnly:true};
const call=body=>loaded.exports.POST({json:async()=>body});
async function main(){
 let result=await call(request);assert.equal(result.status,200);assert.equal(renders,0);assert.equal(writes[0].data.caption,'Saved caption');assert.equal(writes[0].data.config.studioCardId,'project:p1');assert.equal(writes[0].data.status,'draft');assert.equal(writes[0].where.id,'saved');assert.equal(result.body.export.id,'saved');
 writes=[];result=await call({...request,saveOnly:false});assert.equal(result.status,200);assert.equal(renders,1);assert.equal(writes.length,1);assert.equal(writes[0].where.id,'saved');assert.equal(writes[0].data.status,'generated');
 writes=[];result=await call({...request,exportId:undefined,expectedUpdatedAt:undefined});assert.equal(result.status,200);assert.equal(result.body.export.id,'new');assert.equal(writes[0].data.designerId,'u1');
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

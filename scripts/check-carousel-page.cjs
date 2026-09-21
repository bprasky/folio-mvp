const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
class StudioAccessError extends Error {}
let studioCalls = 0;
let studioError = null;
let savedConfig = {studioCardId:'suggestion:p1:r1',headline:'Edited headline',selectedImageUrls:['edited.jpg'],pitch:'Edited pitch'};
const project = {id:'p1',ownerId:'u1',designerId:'u1',title:'Home',post:{id:'post',status:'PUBLISHED',slug:'home'},images:[],rooms:[]};
const code = ts.transpileModule(fs.readFileSync('src/app/designer/projects/[id]/instagram/page.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod = {exports:{}};
vm.runInNewContext(code,{module:mod,exports:mod.exports,require(id){
  if(id==='@/lib/publishing-studio/feed')return {preparedConfig: card => ({studioCardId:card.id,selectedImageUrls:card.imageUrls})};
  if(id==='next-auth')return {getServerSession:async()=>({user:{id:'u1'}})};
  if(id==='next/navigation')return {notFound(){throw Error('404')},redirect(){throw Error('redirect')}};
  if(id==='@/lib/prisma')return {prisma:{project:{findUnique:async()=>project},user:{findUnique:async()=>null},instagramExport:{findFirst:async()=>({id:'e1',config:savedConfig,headline:'Edited headline',caption:'Edited caption',updatedAt:new Date('2026-09-01')})}}};
  if(id==='@/lib/authz/access')return {assertProjectWrite:async()=>{}};
  if(id.includes('auth/') && id.endsWith('/options'))return {authOptions:{}};
  if(id==='@/lib/publishing-studio/data')return {StudioAccessError,getStudioData:async()=>{studioCalls++;if(studioError)throw studioError;return {feed:[{id:'proposal:p1',revision:'v1',kind:'suggestion',canPolish:true,imageUrl:'preview.jpg',imageUrls:['preview.jpg'],projectIds:['p1'],title:'Exact headline',caption:'Exact caption'},{exportId:'other',pitch:'Wrong record'},{exportId:'e1',pitch:'Source pitch',rationale:'Grounded rationale',beats:['A source decision'],headlineOptions:['Source headline'],captionOptions:['Source caption']}]}}};
  if(id==='@/components/instagram-export/InstagramExportEditor')return {InstagramExportEditor:()=>null};
  return require(id);
}});
(async()=>{
 const render=()=>mod.exports.default({params:{id:'p1'},searchParams:{export:'e1'}});
 let result=await render();let draft=result.props.initialExport;
 assert.equal(draft.config.pitch,'Edited pitch');assert.equal(draft.headline,'Edited headline');assert.equal(draft.caption,'Edited caption');assert.equal(draft.config.selectedImageUrls[0],'edited.jpg');assert.equal(draft.config.rationale,'Grounded rationale');assert.equal(draft.config.captionOptions[0],'Source caption');assert.equal(savedConfig.rationale,undefined,'Enrichment does not mutate stored config');
 savedConfig=draft.config;await render();assert.equal(studioCalls,1,'Complete metadata avoids loading Studio');
 savedConfig={...savedConfig,headlineOptions:['x'.repeat(5001),'Intact headline'],captionOptions:Array.from({length:12},(_,i)=>'Caption '+i),beats:['x'.repeat(5001),'Intact beat',3]};
 result=await render();draft=result.props.initialExport;
 assert.equal(draft.config.headlineOptions.length,1);assert.equal(draft.config.headlineOptions[0],'Intact headline');assert.equal(draft.config.captionOptions.length,10);assert.equal(draft.config.beats.length,1);assert.equal(draft.config.beats[0],'Intact beat');
 savedConfig={};studioError=new StudioAccessError('Wrong workspace');result=await render();assert.equal(result.props.initialExport.caption,'Edited caption','Authorized direct project editor survives workspace mismatch without enrichment');
 studioError=null;
 const previewParams={proposal:'proposal:p1',revision:'v1'};
 result=await mod.exports.default({params:{id:'p1'},searchParams:previewParams});assert.equal(result.props.initialExport,null);assert.equal(result.props.initialPreview.headline,'Exact headline');assert.equal(result.props.initialPreview.caption,'Exact caption');assert.equal(result.props.initialPreview.config.selectedImageUrls[0],'preview.jpg');assert.equal(result.props.initialPreview.config.studioRevision,'v1');
 await assert.rejects(()=>mod.exports.default({params:{id:'p1'},searchParams:{...previewParams,revision:'stale'}}),/404/);
 await assert.rejects(()=>mod.exports.default({params:{id:'p1'},searchParams:{...previewParams,proposal:'foreign'}}),/404/);
 console.log('Carousel page checks passed: exact saved-card metadata enrichment, edits preserved, no mutation, complete drafts skip lookup, workspace mismatch safe.');
})().catch(error=>{console.error(error);process.exitCode=1});

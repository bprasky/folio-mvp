const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const cache={};let calls=0,response={content:[{type:'text',text:'Ready caption'}],stop_reason:'end_turn'},failure=null;
class Anthropic {constructor(){this.messages={create:async()=>{calls++;if(failure)throw failure;return response}}}}
const env={ANTHROPIC_API_KEY:'fixture'};
function load(file){if(cache[file])return cache[file];const exports={};const requireMock=id=>id==='@anthropic-ai/sdk'?{default:Anthropic}:id==='@/lib/ai/models'?{MODELS:{sonnet:'test'}}:id==='@/lib/ai/errors'?{userMessageFor:c=>c,statusFor:()=>503,isRetryable:c=>c==='LLM_CALL_FAILED'}:id.startsWith('./')?load('src/lib/instagram-export/'+id.slice(2)+'.ts'):require(id);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:requireMock,process:{env},console});cache[file]=exports;return exports;}
const g=load('src/lib/instagram-export/generation.ts'),s=load('src/lib/instagram-export/generation.schemas.ts');
(async()=>{
 assert.equal(await g.generateSocialText('fixture',500),'Ready caption');assert.equal(calls,1);
 env.ANTHROPIC_ENABLED='false';await assert.rejects(g.generateSocialText('fixture',500),e=>e.code==='LLM_DISABLED');assert.equal(calls,1);delete env.ANTHROPIC_ENABLED;
 failure={status:401};await assert.rejects(g.generateSocialText('fixture',500),e=>e.code==='LLM_AUTH_FAILED');failure=null;
 response.stop_reason='max_tokens';await assert.rejects(g.generateSocialText('fixture',500),e=>e.code==='LLM_TRUNCATED');response.stop_reason='end_turn';response.content=[];await assert.rejects(g.generateSocialText('fixture',500),e=>e.code==='LLM_EMPTY_RESPONSE');
 assert.throws(()=>g.parseSocialOptions('["one"]',s.HeadlineOptionsSchema),e=>e.code==='LLM_JSON_PARSE');
 assert.equal(g.parseSocialOptions('["a","b","c","d","e"]',s.HeadlineOptionsSchema).length,5);
 const blocks={lead:{deck:'Published lead'},credits:{text:'DO NOT USE'},galleryChapters:[{roomId:'room1',imageIds:['a'],body:['Selected room decision.']},{roomId:'room2',imageIds:['b'],body:['Other room.']},{imageIds:['c'],body:['Legacy room.']}]};
 assert.equal(g.extractTextFromBlocks(g.publishedRoomSource(blocks,'room1',['b'])),'Selected room decision.');
 assert.equal(g.extractTextFromBlocks(g.publishedRoomSource(blocks,'legacy',['c'])),'Legacy room.');assert.equal(g.publishedRoomSource(blocks,'foreign',[]),null);assert.ok(!g.extractTextFromBlocks(blocks).includes('DO NOT USE'));
 console.log('Social generation regression passed: configured key/default enable, explicit disable, auth/truncation/empty errors, exact output schema, structured prose, strict room source.');
})().catch(e=>{console.error(e);process.exitCode=1});

// Real transport service, provider request builder and turn state; isolated DB,
// canonical-engine and Tavus HTTP boundaries. Never loads credentials or calls a provider.
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');
const root=path.resolve(__dirname,'..');
let sessions,approved,workspace,sourceAllowed,saves,providerCalls,saveFailure,providerFailure,storageReady,failReceiptOnce,canonicalIndex;
const env={NODE_ENV:'test',FOLIO_LIVE_INTERVIEWS:'1',FOLIO_LIVE_ALLOWLIST:'owner,other',FOLIO_INTERVIEW_RECORDING:'1',FOLIO_LIVE_BASE_URL:'https://folio.test',NEXTAUTH_SECRET:'synthetic-session-secret',TAVUS_API_KEY:'synthetic-provider-key'};
const clone=structuredClone;const cache=new Map();
function snapshot(index=1){return {source:{kind:'project',id:'project'},interviewId:'canonical',version:String(index),status:'active',currentQuestion:{id:`q${index}`,text:`Question ${index}?`,sourceImageIds:[]},sourceRefs:[],state:{schemaVersion:1,skipped:[],receipts:{},native:{rooms:[{id:'room',imageIds:['image-one','image-two']}]}}};}
const mocks={
 'server-only':{},
 '@/lib/prisma':{prisma:{user:{findUnique:async()=>approved?{accountStatus:'APPROVED'}:{accountStatus:'PENDING'}}}},
 '@/lib/rateLimit':{checkRateLimit:async()=>({success:true})},
 '@/lib/publishing-studio/data':{resolvePublishingStudioContext:async()=>({id:workspace})},
 '@/lib/interview-media/storage':{assertCaptureStorageReady:async()=>{if(!storageReady)throw Error('private storage unavailable');}},
};
const store={
 createLiveSession:async(input)=>{
  const prior=[...sessions.values()].find(s=>s.actorId===input.actorId&&s.sourceId===input.sourceId&&(['starting','active','uncertain','ending'].includes(s.status)||s.payload.startRequestId===input.payload.startRequestId));
  if(prior)return{created:false,session:clone(prior)};
  const value={...clone(input),version:1,createdAt:new Date(),updatedAt:new Date()};sessions.set(value.id,value);return{created:true,session:clone(value)};
 },
 getLiveSession:async(id)=>clone(sessions.get(id)||null),
 getLatestLiveSession:async(actor,kind,id,exclude)=>clone([...sessions.values()].filter(s=>s.id!==exclude&&s.actorId===actor&&s.sourceType===kind&&s.sourceId===id).at(-1)||null),
 mutateLiveSession:async(id,fn)=>{const value=clone(sessions.get(id));const result=fn(value)||value;if(failReceiptOnce&&result.payload.turnState.turns.at(-1)?.status==='saved'){failReceiptOnce=false;throw Error('synthetic transport receipt failure');}result.version++;sessions.set(id,result);return clone(result);},
 findLiveSessionByCredential:async(hash)=>clone([...sessions.values()].find(s=>s.credentialHash===hash&&s.expiresAt>Date.now())||null),
 listLiveSessionsForCleanup:async()=>clone([...sessions.values()].filter(s=>['uncertain','ending'].includes(s.status)||s.expiresAt<Date.now())),
};
const adapters={
 authorizeLiveSource:async()=>{if(!sourceAllowed)throw Error('not allowed');},
 prepareLiveInterview:async()=>snapshot(canonicalIndex),
 executeLiveCommand:async(_actor,_source,previous,command)=>{
  if(saveFailure)throw Error('synthetic canonical failure');
  if(command.text.length>2000)throw Error('canonical limit');
  const replay=saves.find(s=>s.requestId===command.requestId);if(replay)return replay.next;
  if(Number(previous.version)!==canonicalIndex)throw Error('stale canonical version');
  canonicalIndex++;
  const next=snapshot(Number(previous.version)+1);saves.push({...command,next});return next;
 },
};
const providerState=new Map();
async function fakeFetch(url,options={}){
 const body=options.body?JSON.parse(options.body):undefined;providerCalls.push({url,method:options.method,body});
 if(providerFailure && url.endsWith('/conversations')&&options.method==='POST')throw Error('synthetic ambiguous network failure');
 if(url.endsWith('/pals')&&options.method==='POST')return Response.json({pal_id:'pal'});
 if(url.endsWith('/conversations')&&options.method==='POST'){const c={conversation_id:'conversation',pal_id:'pal',conversation_name:body.conversation_name,conversation_url:'https://tavus.daily.co/synthetic',meeting_token:'private-join',status:'active'};providerState.set('conversation',c);return Response.json(c);}
 if(url.endsWith('/conversation/end')){providerState.get('conversation').status='ended';return new Response(null,{status:204});}
 if(url.endsWith('/conversations/conversation'))return Response.json(providerState.get('conversation'));
 if(url.includes('/conversations?'))return Response.json({data:[...providerState.values()],total_count:providerState.size});
 if(options.method==='DELETE')return new Response(null,{status:204});
 throw Error(`Unexpected synthetic HTTP ${url}`);
}
function load(file){
 const resolved=path.resolve(root,file);if(cache.has(resolved))return cache.get(resolved).exports;
 const module={exports:{}};cache.set(resolved,module);
 const code=ts.transpileModule(fs.readFileSync(resolved,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const requireLocal=(name)=>{
  if(mocks[name])return mocks[name];
  const target=name.startsWith('@/')?path.join(root,'src',name.slice(2)):name.startsWith('.')?path.resolve(path.dirname(resolved),name):null;
  if(target?.endsWith('/adapters')||target?.endsWith('\\adapters'))return adapters;
  if(target?.endsWith('/store')||target?.endsWith('\\store'))return store;
  if(target)return load(path.relative(root,target+'.ts'));
  return require(name);
 };
 vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{process:{env},Buffer,URL,Response,Request,AbortSignal,structuredClone,Date,console,fetch:fakeFetch,setTimeout,clearTimeout})(requireLocal,module,module.exports);
 return module.exports;
}
const service=load('src/lib/live-interview/service.ts');const turns=load('src/lib/live-interview/turns.ts');const provider=load('src/lib/live-interview/provider.ts');const config=load('src/lib/live-interview/config.ts');
function reset(){sessions=new Map();approved=true;workspace='org';sourceAllowed=true;saves=[];providerCalls=[];saveFailure=false;providerFailure=false;storageReady=true;failReceiptOnce=false;canonicalIndex=1;providerState.clear();env.FOLIO_LIVE_INTERVIEWS='1';}
const start=()=>service.startLiveSession('owner',{source:{kind:'project',id:'project'},requestId:'synthetic-start-request',mode:'none',consentVersion:'2026-10-01',microphoneReady:true});
function event(seq,event_type,role,speech,interrupted=false,inference_id='inference'){return {message_type:'conversation',conversation_id:'conversation',seq,event_type,inference_id,properties:{role,...(speech===undefined?{}:{speech}),interrupted}};}
async function deliver(id,index,offset,raw='Yes.'){
 await service.receiveLiveEvent('owner',id,event(offset+1,'conversation.utterance','pal',`Question ${index}?`,false,`inference-${index}`));
 await service.receiveLiveEvent('owner',id,event(offset+2,'conversation.stopped_speaking','pal',undefined,false,`inference-${index}`));
 await service.receiveLiveEvent('owner',id,event(offset+3,'conversation.started_speaking','user'));
 await service.receiveLiveEvent('owner',id,event(offset+4,'conversation.utterance','user',raw));
}
const cases=[];const test=(name,fn)=>cases.push([name,fn]);
test('disabled beta, unauthorized source, unapproved account prevent paid calls',async()=>{
 env.FOLIO_LIVE_INTERVIEWS='0';await assert.rejects(start);env.FOLIO_LIVE_INTERVIEWS='1';sourceAllowed=false;await assert.rejects(start);sourceAllowed=true;approved=false;await assert.rejects(start);assert.equal(providerCalls.length,0);
});
test('explicit readiness and recording consent required; private storage checked before paid creation',async()=>{
 for(const patch of [{microphoneReady:false},{mode:'invalid'},{consentVersion:'old'}])await assert.rejects(()=>service.startLiveSession('owner',{source:{kind:'project',id:'project'},requestId:'synthetic-start-request',mode:'none',consentVersion:'2026-10-01',microphoneReady:true,...patch}));
 storageReady=false;await assert.rejects(()=>service.startLiveSession('owner',{source:{kind:'project',id:'project'},requestId:'synthetic-start-request',mode:'audio',consentVersion:'2026-10-01',microphoneReady:true}));assert.equal(providerCalls.length,0);
});
test('start reserves once, secret backend token excluded, join token encrypted, first question once',async()=>{
 const a=await start();const b=await start();assert.equal(a.id,b.id);assert.equal(providerCalls.filter(c=>c.url.endsWith('/conversations')).length,1);
 const pal=providerCalls.find(c=>c.url.endsWith('/pals')).body;assert.equal(pal.pipeline_mode,'full');assert.equal(pal.layers.llm.speculative_inference,false);assert.equal(pal.layers.perception.perception_model,'off');assert.equal(pal.greeting,'');assert.ok(pal.layers.llm.base_url.endsWith(`/${a.id}/v1`));
 assert.equal(providerCalls.at(-1).body.custom_greeting,'Question 1?');assert.equal(providerCalls.at(-1).body.require_auth,true);
 assert.ok(!JSON.stringify(a).includes(pal.layers.llm.api_key));assert.ok(!JSON.stringify(sessions.get(a.id)).includes('private-join'));
 assert.equal(await service.processBackendTurn(sessions.get(a.id),[]),'');
});
test('invalid, expired and cross-session credentials rejected; fresh workspace authorization',async()=>{
 const a=await start();const key=providerCalls.find(c=>c.url.endsWith('/pals')).body.layers.llm.api_key;
 await assert.rejects(()=>service.assertLiveBackendAuth(a.id,'Bearer wrong'));await assert.rejects(()=>service.assertLiveBackendAuth('other-session',`Bearer ${key}`));
 assert.equal((await service.assertLiveBackendAuth(a.id,`Bearer ${key}`)).id,a.id);workspace='other';await assert.rejects(()=>service.assertLiveBackendAuth(a.id,`Bearer ${key}`));workspace='org';sessions.get(a.id).expiresAt=new Date(0);await assert.rejects(()=>service.assertLiveBackendAuth(a.id,`Bearer ${key}`));
});
test('complete events corroborate a single ingestion; duplicate legacy events and provider retries replay',async()=>{
 const a=await start();await deliver(a.id,1,0);await service.receiveLiveEvent('owner',a.id,event(1,'conversation.utterance','replica','Question 1?'));
 assert.equal(await service.processBackendTurn(sessions.get(a.id),['Yes.']),'Question 2?');assert.equal(await service.processBackendTurn(sessions.get(a.id),['Yes.']),'Question 2?');assert.equal(saves.length,1);assert.equal(saves[0].questionId,'q1');assert.equal(sessions.get(a.id).payload.turnState.events.length,4);
});
test('identical speech on different questions is legitimate evidence',async()=>{
 const a=await start();await deliver(a.id,1,0);await service.processBackendTurn(sessions.get(a.id),['Yes.']);await deliver(a.id,2,10);await service.processBackendTurn(sessions.get(a.id),['Yes.','Yes.']);assert.equal(saves.length,2);assert.equal(saves[1].questionId,'q2');assert.notEqual(saves[0].requestId,saves[1].requestId);
});
test('old/history-changing retries never bind to the now-current question',async()=>{
 const a=await start();await deliver(a.id,1,0);await service.processBackendTurn(sessions.get(a.id),['Yes.']);await assert.rejects(()=>service.processBackendTurn(sessions.get(a.id),['No.']));assert.equal(saves.length,1);
});
test('reordered full and stopped events still distinguish delivered from interrupted',async()=>{
 const state={turns:[],speech:[],events:[]};turns.prepareSpeech(state,snapshot());turns.acceptSpeechEvent(state,event(2,'conversation.stopped_speaking','pal',undefined,false));turns.acceptSpeechEvent(state,event(1,'conversation.utterance','pal','Question 1?'));assert.equal(state.speech[0].delivered,true);
 const other={turns:[],speech:[],events:[]};turns.prepareSpeech(other,snapshot());turns.acceptSpeechEvent(other,event(2,'conversation.stopped_speaking','pal',undefined,true));turns.acceptSpeechEvent(other,event(1,'conversation.utterance','pal','Question 1?'));assert.equal(other.speech[0].delivered,false);
});
test('interruption continuing earlier answer retained for explicit attribution',async()=>{
 const a=await start();await deliver(a.id,1,0,'First answer.');await service.processBackendTurn(sessions.get(a.id),['First answer.']);
 await service.receiveLiveEvent('owner',a.id,event(11,'conversation.utterance','pal','Question 2?',true,'second'));
 await service.receiveLiveEvent('owner',a.id,event(12,'conversation.stopped_speaking','pal',undefined,true,'second'));
 await service.receiveLiveEvent('owner',a.id,event(13,'conversation.started_speaking','user'));
 await service.receiveLiveEvent('owner',a.id,event(14,'conversation.utterance','user','Also this.'));
 await service.processBackendTurn(sessions.get(a.id),['First answer.','Also this.']);assert.equal(saves.length,1);assert.equal(sessions.get(a.id).payload.turnState.turns[1].status,'needs_review');
 await service.recoverLiveTurn('owner',a.id,{turnPosition:2,target:'previous',text:'First answer. Also this.'});assert.equal(saves[1].action,'correct');assert.equal(saves[1].questionId,'q1');assert.equal(sessions.get(a.id).payload.turnState.turns[1].raw,'Also this.');
});
test('long speech remains complete when canonical limit rejects it; failed save retains source',async()=>{
 const a=await start();const raw='original '.repeat(400);await deliver(a.id,1,0,raw);await service.processBackendTurn(sessions.get(a.id),[raw]);const t=sessions.get(a.id).payload.turnState.turns[0];assert.equal(t.raw,raw);assert.equal(t.status,'needs_review');assert.equal(saves.length,0);
});
test('lost transport receipt after canonical commit recovers with the original receipt',async()=>{
 const a=await start();await deliver(a.id,1,0);failReceiptOnce=true;
 await service.processBackendTurn(sessions.get(a.id),['Yes.']);assert.equal(saves.length,1);const receipt=saves[0].requestId;
 const recovered=await service.recoverLiveTurn('owner',a.id,{turnPosition:1,target:'current',text:'Yes.'});
 assert.equal(recovered.turns[0].status,'saved');assert.equal(recovered.snapshot.currentQuestion.id,'q2');assert.equal(saves.length,1);assert.equal(sessions.get(a.id).payload.turnState.turns[0].receipt,receipt);
});
test('stale canonical version refresh preserves raw/asked evidence and requires explicit reattribution',async()=>{
 const a=await start();canonicalIndex=2;await deliver(a.id,1,0,'Preserve these exact words.');await service.processBackendTurn(sessions.get(a.id),['Preserve these exact words.']);
 assert.equal(saves.length,0);assert.equal(sessions.get(a.id).payload.turnState.turns[0].status,'needs_review');
 await assert.rejects(()=>service.refreshLiveReview('owner',a.id));await service.endLiveSession('owner',a.id,'switch_to_text');
 const refreshed=await service.refreshLiveReview('owner',a.id);assert.equal(refreshed.snapshot.currentQuestion.id,'q2');assert.equal(saves.length,0);assert.equal(refreshed.turns[0].asked,'Question 1?');
 const reviewed=await service.recoverLiveTurn('owner',a.id,{turnPosition:1,target:'current',text:'Preserve these exact words.'});assert.equal(reviewed.turns[0].status,'saved');assert.equal(saves[0].questionId,'q2');assert.equal(reviewed.turns[0].raw,'Preserve these exact words.');assert.equal(reviewed.turns[0].asked,'Question 1?');
});
test('explicit initial and live photo links persist once, reject foreign images, and do not follow browsing/next question',async()=>{
 const a=await service.startLiveSession('owner',{source:{kind:'project',id:'project'},requestId:'synthetic-start-request',mode:'none',consentVersion:'2026-10-01',microphoneReady:true,selectedImageId:'image-one'});
 await assert.rejects(()=>service.linkLiveImage('other',a.id,{questionId:'q1',selectedImageId:'image-two'}));
 await assert.rejects(()=>service.linkLiveImage('owner',a.id,{questionId:'q1',selectedImageId:'foreign'}));
 await deliver(a.id,1,0);await service.processBackendTurn(sessions.get(a.id),['Yes.']);assert.equal(saves[0].selectedImageId,'image-one');
 await deliver(a.id,2,10);await service.processBackendTurn(sessions.get(a.id),['Yes.','Yes.']);assert.equal(saves[1].selectedImageId,null);
 await service.linkLiveImage('owner',a.id,{questionId:'q3',selectedImageId:'image-two'});await deliver(a.id,3,20);await service.processBackendTurn(sessions.get(a.id),['Yes.','Yes.','Yes.']);assert.equal(saves[2].selectedImageId,'image-two');
});
test('partials are not accepted as final events',async()=>{
 assert.equal(turns.validEvent(event(1,'conversation.utterance.streaming','user','partial')),false);
});
test('pending reviewed speech is restored before another paid start; wrong-round duplicate start cannot join',async()=>{
 const a=await start();await assert.rejects(()=>service.startLiveSession('owner',{source:{kind:'project',id:'project',round:2},requestId:'new-round-request-id',mode:'none',consentVersion:'2026-10-01',microphoneReady:true}));
 saveFailure=true;await deliver(a.id,1,0);await service.processBackendTurn(sessions.get(a.id),['Yes.']);await service.endLiveSession('owner',a.id,'pause');
 const restored=await start();assert.equal(restored.id,a.id);assert.equal(restored.turns[0].status,'needs_review');assert.equal(providerCalls.filter(c=>c.url.endsWith('/conversations')&&c.method==='POST').length,1);
});
test('ambiguous provider create never blindly retries paid creation',async()=>{
 providerFailure=true;await assert.rejects(start);const value=[...sessions.values()][0];assert.equal(value.status,'uncertain');await start();assert.equal(providerCalls.filter(c=>c.url.endsWith('/conversations')).length,1);
});
test('end remains available with disabled flags and revoked source access, confirms provider end and PAL cleanup',async()=>{
 const a=await start();sourceAllowed=false;approved=false;env.FOLIO_LIVE_INTERVIEWS='0';await service.endLiveSession('owner',a.id,'switch_to_text');assert.equal(sessions.get(a.id).status,'ended');assert.ok(providerCalls.some(c=>c.url.endsWith('/conversation/end')));assert.ok(providerCalls.some(c=>c.method==='DELETE'&&c.url.endsWith('/pals/pal')));
});
test('SSE is OpenAI-compatible, terminated, and never embeds unescaped newlines',async()=>{
 const stream=turns.completionStream('test','Question?\nSecond line');assert.ok(stream.endsWith('data: [DONE]\n\n'));const chunks=stream.trim().split('\n\n').slice(0,-1).map(line=>JSON.parse(line.slice(6)));assert.equal(chunks[1].choices[0].delta.content,'Question?\nSecond line');assert.equal(chunks.at(-1).choices[0].finish_reason,'stop');
});
test('browser writes require same origin, not just cookies',async()=>{
 assert.throws(()=>config.assertLiveOrigin(new Request('https://folio.test/api/live-interviews',{method:'POST',headers:{origin:'https://evil.test'}})));
 config.assertLiveOrigin(new Request('https://folio.test/api/live-interviews',{method:'POST',headers:{origin:'https://folio.test'}}));
});
(async()=>{for(const[name,fn]of cases){reset();await fn();console.log('PASS',name);}console.log(`${cases.length} live transport checks passed; provider, canonical and DB boundaries mocked.`);})().catch(error=>{console.error(error);process.exitCode=1;});

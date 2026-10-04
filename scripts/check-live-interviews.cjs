// Real transport service, provider request builder and turn state; isolated DB,
// canonical-engine and Tavus HTTP boundaries. Never loads credentials or calls a provider.
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');
const root=path.resolve(__dirname,'..');
let sessions,approved,workspace,sourceAllowed,saves,providerCalls,saveFailure,providerFailure,storageReady,failReceiptOnce,canonicalIndex,afterConversationCreate,routeActor='owner';
const env={NODE_ENV:'test',FOLIO_LIVE_INTERVIEWS:'1',FOLIO_INTERVIEW_RECORDING:'1',FOLIO_LIVE_BASE_URL:'https://folio.test',NEXTAUTH_SECRET:'synthetic-session-secret',TAVUS_API_KEY:'synthetic-provider-key'};
const clone=structuredClone;const cache=new Map();
function snapshot(index=1){return {source:{kind:'project',id:'project'},interviewId:'canonical',version:String(index),status:'active',currentQuestion:{id:`q${index}`,text:`Question ${index}?`,sourceImageIds:[]},sourceRefs:[],state:{schemaVersion:1,skipped:[],receipts:{},native:{rooms:[{id:'room',imageIds:['image-one','image-two']}]}}};}
const mocks={
 'server-only':{},
 '@/lib/prisma':{prisma:{user:{findUnique:async()=>approved?{accountStatus:'APPROVED'}:{accountStatus:'PENDING'}}}},
 '@/lib/rateLimit':{checkRateLimit:async()=>({success:true})},
 '@/lib/publishing-studio/data':{resolvePublishingStudioContext:async()=>({id:workspace})},
 '@/lib/interview-media/storage':{assertCaptureStorageReady:async()=>{if(!storageReady)throw Error('private storage unavailable');}},
 '@/lib/live-interview/http':{
  assertLiveBrowserActor:async()=>{if(!routeActor)throw Error('Sign in required');return routeActor;},
  readLiveJson:request=>request.json(),liveResponse:value=>Response.json(value),liveFailure:error=>Response.json({error:error.message},{status:error.status||503}),
 },
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
  if(command.action==='guide'&&command.guideAction==='refresh')return {...previous,guide:{...previous.guide,photoCount:4}};
  if(command.text?.length>2000)throw Error('canonical limit');
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
 if(url.endsWith('/conversations')&&options.method==='POST'){const c={conversation_id:'conversation',pal_id:'pal',conversation_name:body.conversation_name,conversation_url:'https://tavus.daily.co/synthetic',meeting_token:'private-join',status:'active'};providerState.set('conversation',c);if(afterConversationCreate)await afterConversationCreate();return Response.json(c);}
 if(url.endsWith('/conversation/end')){providerState.get('conversation').status='ended';return new Response(null,{status:204});}
 if(url.endsWith('/conversations/conversation'))return Response.json(providerState.get('conversation'));
 if(url.includes('/conversations?'))return Response.json({data:[...providerState.values()],total_count:providerState.size});
 if(options.method==='DELETE')return new Response(null,{status:204});
 throw Error(`Unexpected synthetic HTTP ${url}`);
}
function load(file){
 const resolved=path.resolve(root,file);if(cache.has(resolved))return cache.get(resolved).exports;
 const compiled={exports:{}};cache.set(resolved,compiled);
 const code=ts.transpileModule(fs.readFileSync(resolved,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const requireLocal=(name)=>{
  if(mocks[name])return mocks[name];
  const target=name.startsWith('@/')?path.join(root,'src',name.slice(2)):name.startsWith('.')?path.resolve(path.dirname(resolved),name):null;
  if(target?.endsWith('/adapters')||target?.endsWith('\\adapters'))return adapters;
  if(target?.endsWith('/store')||target?.endsWith('\\store'))return store;
  if(target)return load(path.relative(root,target+'.ts'));
  return require(name);
 };
 vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{process:{env},Buffer,URL,Response,Request,AbortSignal,structuredClone,Date,console,fetch:fakeFetch,setTimeout,clearTimeout})(requireLocal,compiled,compiled.exports);
 return compiled.exports;
}
const service=load('src/lib/live-interview/service.ts');const turns=load('src/lib/live-interview/turns.ts');const provider=load('src/lib/live-interview/provider.ts');const config=load('src/lib/live-interview/config.ts');
function reset(){sessions=new Map();approved=true;workspace='org';sourceAllowed=true;saves=[];providerCalls=[];saveFailure=false;providerFailure=false;storageReady=true;failReceiptOnce=false;canonicalIndex=1;afterConversationCreate=null;routeActor='owner';providerState.clear();env.FOLIO_LIVE_INTERVIEWS='1';}
const start=()=>service.startLiveSession('owner',{source:{kind:'project',id:'project'},requestId:'synthetic-start-request',mode:'none',consentVersion:'2026-10-01',microphoneReady:true});
const startText=()=>service.startLiveSession('owner',{source:{kind:'project',id:'project'},requestId:'synthetic-text-start',mode:'none',consentVersion:'2026-10-01',inputMode:'text'});
const textInput=(session,text='Typed answer.',requestId='synthetic-typed-answer')=>({requestId,text,questionId:session.snapshot.currentQuestion.id,version:session.snapshot.version});
function event(seq,event_type,role,speech,interrupted=false,inference_id='inference'){return {message_type:'conversation',conversation_id:'conversation',seq,event_type,inference_id,properties:{role,...(speech===undefined?{}:{speech}),interrupted}};}
async function deliver(id,index,offset,raw='Yes.'){
 await service.receiveLiveEvent('owner',id,event(offset+1,'conversation.utterance','pal',`Question ${index}?`,false,`inference-${index}`));
 await service.receiveLiveEvent('owner',id,event(offset+2,'conversation.stopped_speaking','pal',undefined,false,`inference-${index}`));
 await service.receiveLiveEvent('owner',id,event(offset+3,'conversation.started_speaking','user'));
 await service.receiveLiveEvent('owner',id,event(offset+4,'conversation.utterance','user',raw));
}
const cases=[];const test=(name,fn)=>cases.push([name,fn]);

test('guide intake carries only same-owner same-workspace conversation history into the project',async()=>{
 const originalPrepare=adapters.prepareLiveInterview;
 const history=[{role:'user',text:'I would like to discuss restoration.'}];let prepared;
 adapters.prepareLiveInterview=async(actor,source,requestId,previous,step)=>{
  prepared={actor,source,previous,step};return {...snapshot(),source,state:{schemaVersion:1,skipped:[],receipts:{},native:{kind:'project_guide',phase:'guide',revision:1,recentTurns:history}},guide:{phase:'guide',workspaceStep:step}};
 };
 try{
  const input={source:{kind:'project_guide',id:'new:owner'},requestId:'intake-start-request',mode:'none',consentVersion:'2026-10-01',inputMode:'text',workspaceStep:'photos'};
  const intake=await service.startLiveSession('owner',input);await service.endLiveSession('owner',intake.id,'end');
  const row=sessions.get(intake.id);row.payload.snapshot.state.receipts.private='old-receipt';row.payload.snapshot.state.native.canonical={id:'must-not-copy'};
  const project=await service.startLiveSession('owner',{...input,source:{kind:'project_guide',id:'project'},requestId:'project-start-request',intakeSessionId:intake.id});
  assert.equal(prepared.step,'photos');assert.deepEqual(prepared.previous.native.recentTurns,history);assert.equal(prepared.previous.native.canonical,undefined);assert.equal(Object.keys(prepared.previous.receipts).length,0);
  await service.endLiveSession('owner',project.id,'end');
  const callsBefore=providerCalls.length;
  await assert.rejects(service.startLiveSession('other',{...input,source:{kind:'project_guide',id:'other-project'},requestId:'other-start-request',intakeSessionId:intake.id}),/not found/);
  workspace='different-workspace';
  await assert.rejects(service.startLiveSession('owner',{...input,source:{kind:'project_guide',id:'second-project'},requestId:'workspace-start-request',intakeSessionId:intake.id}),/cannot be carried/);
  assert.equal(providerCalls.length,callsBefore,'Invalid intake history must fail before provider creation.');
 }finally{adapters.prepareLiveInterview=originalPrepare;}
});
test('disabled beta, unauthorized source, unapproved account prevent paid calls',async()=>{
 env.FOLIO_LIVE_INTERVIEWS='0';await assert.rejects(start);env.FOLIO_LIVE_INTERVIEWS='1';sourceAllowed=false;await assert.rejects(start);sourceAllowed=true;approved=false;await assert.rejects(start);assert.equal(providerCalls.length,0);
});
test('explicit readiness and recording consent required; private storage checked before paid creation',async()=>{
 for(const patch of [{microphoneReady:false},{mode:'invalid'},{consentVersion:'old'}])await assert.rejects(()=>service.startLiveSession('owner',{source:{kind:'project',id:'project'},requestId:'synthetic-start-request',mode:'none',consentVersion:'2026-10-01',microphoneReady:true,...patch}));
 storageReady=false;await assert.rejects(()=>service.startLiveSession('owner',{source:{kind:'project',id:'project'},requestId:'synthetic-start-request',mode:'audio',consentVersion:'2026-10-01',microphoneReady:true}));assert.equal(providerCalls.length,0);
});

test('typed start needs consent and no recording but never needs a microphone or storage worker',async()=>{
 const base={source:{kind:'project',id:'project'},requestId:'synthetic-text-start',mode:'none',consentVersion:'2026-10-01',inputMode:'text'};
 for(const patch of [{mode:'audio'},{mode:'video'},{consentVersion:'old'},{inputMode:'invalid'}])await assert.rejects(()=>service.startLiveSession('owner',{...base,...patch}));
 assert.equal(providerCalls.length,0);
 storageReady=false;const a=await startText();assert(a.join);assert.equal(a.consent.mode,'none');assert.equal(saves.length,0);
});

test('typed draft scope is issued only after fresh availability authorization and separates actors and sources',async()=>{
 const source={kind:'project',id:'project'},a=await service.liveAvailability('owner',source);
 assert.match(a.draftScope,/^[a-f0-9]{64}$/);assert.equal((await service.liveAvailability('owner',source)).draftScope,a.draftScope);
 assert.notEqual((await service.liveAvailability('other',source)).draftScope,a.draftScope);
 assert.notEqual((await service.liveAvailability('owner',{...source,id:'other-project'})).draftScope,a.draftScope);
 sourceAllowed=false;await assert.rejects(()=>service.liveAvailability('owner',source));sourceAllowed=true;
 env.FOLIO_LIVE_INTERVIEWS='0';assert.equal((await service.liveAvailability('owner',source)).draftScope,undefined);
});

test('typed registration is explicit and idempotent; only exact provider callback writes canonical text',async()=>{
 const a=await startText(),input=textInput(a);
 const first=await service.prepareLiveText('owner',a.id,input);assert.equal(first.textRegistration.created,true);assert.equal(first.textRegistration.position,1);
 assert.equal(first.turns[0].requestId,input.requestId);assert.equal(first.turns[0].inputMode,'text');assert.equal(first.turns[0].version,a.snapshot.version);assert.equal(saves.length,0);
 assert.equal((await service.prepareLiveText('owner',a.id,input)).textRegistration.created,false,'same receipt never authorizes a blind resend');
 await assert.rejects(()=>service.controlLiveSession('owner',a.id,{action:'skip',questionId:'q1',requestId:'control-pending-text'}));
 assert.equal(await service.processBackendTurn(sessions.get(a.id),[input.text]),'Question 2?');
 assert.equal(await service.processBackendTurn(sessions.get(a.id),[input.text]),'Question 2?');
 assert.equal(saves.length,1);assert.equal(saves[0].inputModality,'text');assert.equal(saves[0].questionId,'q1');
 assert.equal(sessions.get(a.id).payload.turnState.events.length,0,'typed text never fabricates speech delivery');
 const replay=await service.prepareLiveText('owner',a.id,input);assert.equal(replay.textRegistration.created,false);assert.equal(replay.textRegistration.status,'saved');
});

test('prepare_text route keeps owner and same-origin boundaries and never writes a canonical answer',async()=>{
 const a=await startText(),input=textInput(a),route=load('src/app/api/live-interviews/[id]/route.ts');
 const invoke=origin=>route.POST(new Request(`https://folio.test/api/live-interviews/${a.id}`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action:'prepare_text',...input})}),{params:{id:a.id}});
 assert.equal((await invoke('https://evil.test')).status,403);
 routeActor='other';assert.equal((await invoke('https://folio.test')).status,404);routeActor='owner';
 const response=await invoke('https://folio.test');assert.equal(response.status,200);assert.equal((await response.json()).textRegistration.created,true);assert.equal(saves.length,0);
});

test('typed registration rejects stale input, reused receipts, pending speech and fresh permission failures',async()=>{
 const a=await startText(),input=textInput(a);
 for(const patch of [{text:' '},{text:'x'.repeat(2001)},{questionId:'stale'},{version:'stale'},{requestId:'bad'}])await assert.rejects(()=>service.prepareLiveText('owner',a.id,{...input,...patch}));
 await assert.rejects(()=>service.prepareLiveText('other',a.id,input));
 sourceAllowed=false;await assert.rejects(()=>service.prepareLiveText('owner',a.id,input));sourceAllowed=true;
 workspace='other';await assert.rejects(()=>service.prepareLiveText('owner',a.id,input));workspace='org';
 env.FOLIO_LIVE_INTERVIEWS='0';await assert.rejects(()=>service.prepareLiveText('owner',a.id,input));env.FOLIO_LIVE_INTERVIEWS='1';
 await deliver(a.id,1,0,'Unresolved spoken answer.');
 await assert.rejects(()=>service.prepareLiveText('owner',a.id,input),/spoken answer/);
 assert.equal(saves.length,0);assert.equal(sessions.get(a.id).payload.turnState.turns.length,0);
 await service.processBackendTurn(sessions.get(a.id),['Unresolved spoken answer.']);
 const current=await service.readLiveSession('owner',a.id),next=textInput(current);
 await service.prepareLiveText('owner',a.id,next);
 await assert.rejects(()=>service.prepareLiveText('owner',a.id,{...next,text:'Changed text.'}),/receipt/);
 await assert.rejects(()=>service.prepareLiveText('owner',a.id,{...next,requestId:'different-pending-text'}),/pending answer/);
});

test('typed callbacks reject mismatched/reordered history while preserving the exact registered answer',async()=>{
 const a=await startText(),input=textInput(a);await service.prepareLiveText('owner',a.id,input);
 await assert.rejects(()=>service.processBackendTurn(sessions.get(a.id),['Different text.']));
 await assert.rejects(()=>service.processBackendTurn(sessions.get(a.id),[input.text,'Unexpected later turn.']));
 assert.equal(saves.length,0);assert.equal(sessions.get(a.id).payload.turnState.turns[0].raw,input.text);
 await service.processBackendTurn(sessions.get(a.id),[input.text]);assert.equal(saves.length,1);
});

test('typed and voice answers share natural progression and keep their own source modality',async()=>{
 const a=await startText();await service.prepareLiveText('owner',a.id,textInput(a,'Repeated words.'));
 await service.processBackendTurn(sessions.get(a.id),['Repeated words.']);
 await deliver(a.id,2,10,'Spoken answer.');await service.processBackendTurn(sessions.get(a.id),['Repeated words.','Spoken answer.']);
 const current=await service.readLiveSession('owner',a.id);await service.prepareLiveText('owner',a.id,textInput(current,'Repeated words.','synthetic-typed-third'));
 await service.processBackendTurn(sessions.get(a.id),['Repeated words.','Spoken answer.','Repeated words.']);
 assert.deepEqual(saves.map(save=>save.inputModality||'voice'),['text','voice','text']);assert.deepEqual(saves.map(save=>save.questionId),['q1','q2','q3']);
 assert.equal(new Set(saves.map(save=>save.requestId)).size,3);
});

test('a typed user-utterance echo cannot supply evidence for a later voice answer with identical words',async()=>{
 const a=await startText();
 await service.receiveLiveEvent('owner',a.id,event(1,'conversation.utterance','pal','Question 1?',false,'first-question'));
 await service.receiveLiveEvent('owner',a.id,event(2,'conversation.stopped_speaking','pal',undefined,false,'first-question'));
 await service.prepareLiveText('owner',a.id,textInput(a,'Same words.'));
 await service.receiveLiveEvent('owner',a.id,event(3,'conversation.utterance','user','Same words.'));
 await service.processBackendTurn(sessions.get(a.id),['Same words.']);
 await deliver(a.id,2,10,'Same words.');
 const interrupted=clone(sessions.get(a.id).payload.turnState);interrupted.speech.at(-1).delivered=false;
 assert.equal(turns.finalSpeechForTurn(interrupted,{position:2,raw:'Same words.'}),undefined,'an older delivered question cannot substitute for the current interrupted question');
 await service.processBackendTurn(sessions.get(a.id),['Same words.','Same words.']);
 assert.equal(saves.length,2);assert.equal(saves[1].questionId,'q2');assert.equal(saves[1].inputModality,undefined);
 assert.equal(sessions.get(a.id).payload.turnState.turns[1].eventSeq,14,'voice binds only to the utterance after its own delivered question');
});

test('ending or expiring before a typed callback retains review and prevents another paid start',async()=>{
 const a=await startText(),input=textInput(a);await service.prepareLiveText('owner',a.id,input);
 const ended=await service.endLiveSession('owner',a.id,'end');assert.equal(ended.turns[0].status,'needs_review');assert.equal(ended.turns[0].raw,input.text);
 const resumed=await startText();assert.equal(resumed.id,a.id);assert.equal(resumed.turns[0].requestId,input.requestId);assert.equal(resumed.join,undefined);
 assert.equal(providerCalls.filter(call=>call.url.endsWith('/conversations')&&call.method==='POST').length,1);
 await service.recoverLiveTurn('owner',a.id,{turnPosition:1,target:'current',text:input.text});assert.equal(saves[0].inputModality,'text');assert.equal(saves[0].text,input.text);
 reset();const expired=await startText();await service.prepareLiveText('owner',expired.id,textInput(expired));sessions.get(expired.id).expiresAt=new Date(0);
 assert.equal((await service.readLiveSession('owner',expired.id)).turns[0].status,'needs_review');
});

test('a crashed typed save retains its receipt and blocks new calls until the save lease can be reviewed',async()=>{
 const a=await startText(),input=textInput(a);await service.prepareLiveText('owner',a.id,input);
 const turn=sessions.get(a.id).payload.turnState.turns[0];turn.status='saving';turn.leaseUntil=Date.now()+120_000;
 await service.endLiveSession('owner',a.id,'end');const pending=await startText();assert.equal(pending.id,a.id);assert.equal(pending.turns[0].status,'saving');
 sessions.get(a.id).payload.turnState.turns[0].leaseUntil=0;
 const review=await service.readLiveSession('owner',a.id);assert.equal(review.turns[0].status,'needs_review');assert.equal(review.turns[0].requestId,input.requestId);
 assert.equal(providerCalls.filter(call=>call.url.endsWith('/conversations')&&call.method==='POST').length,1);
});

test('typed canonical drift and a lost transport receipt retain recoverable text without duplicate canonical saves',async()=>{
 const a=await startText(),input=textInput(a);await service.prepareLiveText('owner',a.id,input);canonicalIndex=2;
 await service.processBackendTurn(sessions.get(a.id),[input.text]);assert.equal(saves.length,0);assert.equal(sessions.get(a.id).payload.turnState.turns[0].status,'needs_review');
 reset();const b=await startText(),second=textInput(b);await service.prepareLiveText('owner',b.id,second);failReceiptOnce=true;
 await service.processBackendTurn(sessions.get(b.id),[second.text]);assert.equal(saves.length,1);
 await service.recoverLiveTurn('owner',b.id,{turnPosition:1,target:'current',text:second.text});assert.equal(saves.length,1);assert.equal(saves[0].inputModality,'text');
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
 await assert.rejects(()=>service.startLiveSession('owner',{source:{kind:'project_guide',id:'project'},requestId:'synthetic-start-request',mode:'none',consentVersion:'2026-10-01',microphoneReady:true}),/existing live session/);
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
function guideSession(id,phase='guide') {
 const row=sessions.get(id);row.sourceType='project_guide';row.payload.source={kind:'project_guide',id:'project'};
 row.payload.snapshot.source=row.payload.source;row.payload.snapshot.guide={phase};
 if(phase==='interview')row.payload.snapshot.state.native={kind:'project_guide',canonical:row.payload.snapshot.state.native};
 return clone(row);
}
test('guide recording is offered for existing projects but never starts as part of automatic entry',async()=>{
 const source={kind:'project_guide',id:'project'};
 assert.equal((await service.liveAvailability('owner',source)).recordingEnabled,true);
 assert.equal((await service.liveAvailability('owner',{kind:'project_guide',id:'new:owner'})).recordingEnabled,false);
 await assert.rejects(service.startLiveSession('owner',{source,requestId:'guide-recording-request',mode:'audio',microphoneReady:true,consentVersion:'2026-10-01'}),error=>error.status===403);
 assert.equal(providerCalls.length,0);assert.equal(sessions.size,0);assert.equal(saves.length,0);
});
test('explicit in-call consent enables creator capture without another provider call or answer write',async()=>{
 const a=await start();guideSession(a.id);const count=providerCalls.length;
 const next=await service.consentLiveRecording('owner',a.id,{mode:'video',consent:true,consentVersion:'2026-10-01'});
 assert.equal(next.consent.mode,'video');assert.equal(sessions.get(a.id).canonicalId,'project');
 assert.equal(providerCalls.length,count);assert.equal(saves.length,0);
 await service.controlLiveSession('owner',a.id,{action:'guide',guideAction:'refresh',requestId:'consent-refresh-request'});
 assert.equal(sessions.get(a.id).canonicalId,'project','media identity survives guide/interview state changes');
});
test('recording consent rejects missing permission, another actor, disabled capture, Create+ and ended calls',async()=>{
 const a=await start();guideSession(a.id);const input={mode:'audio',consent:true,consentVersion:'2026-10-01'};
 await assert.rejects(service.consentLiveRecording('owner',a.id,{...input,consent:false}),e=>e.status===400);
 await assert.rejects(service.consentLiveRecording('other',a.id,input),e=>e.status===404);
 env.FOLIO_INTERVIEW_RECORDING='0';await assert.rejects(service.consentLiveRecording('owner',a.id,input),e=>e.status===403);env.FOLIO_INTERVIEW_RECORDING='1';
 sessions.get(a.id).payload.source.id='new:owner';await assert.rejects(service.consentLiveRecording('owner',a.id,input),e=>e.status===403);sessions.get(a.id).payload.source.id='project';
 storageReady=false;await assert.rejects(service.consentLiveRecording('owner',a.id,input));storageReady=true;
 await service.endLiveSession('owner',a.id,'end');await assert.rejects(service.consentLiveRecording('owner',a.id,input),/Reconnect/);
 assert.equal(sessions.get(a.id).payload.consent.mode,'none');
});
test('late cancelled startup cannot resurrect a call whose provider cleanup already completed',async()=>{
 afterConversationCreate=async()=>{const id=[...sessions.keys()][0];await service.endLiveSession('owner',id,'end');assert.equal(sessions.get(id).status,'ended');};
 await assert.rejects(start,/cancelled/);const session=[...sessions.values()][0];
 assert.equal(session.status,'ended');assert.equal(session.payload.cleanupStage,'complete');assert.equal(session.payload.notice,undefined);
});
test('repeated End is idempotent even after provider resources disappear',async()=>{
 const a=await start();await service.endLiveSession('owner',a.id,'end');providerState.clear();const calls=providerCalls.length;
 await service.endLiveSession('owner',a.id,'end');await service.endLiveSession('owner',a.id,'end');
 assert.equal(sessions.get(a.id).status,'ended');assert.equal(providerCalls.length,calls);
});
test('cleanup repairs a historical ending reservation with completed provider cleanup',async()=>{
 const a=await start();await service.endLiveSession('owner',a.id,'end');const row=sessions.get(a.id);row.status='ending';row.payload.notice='Stale startup notice';providerState.clear();const calls=providerCalls.length;
 await service.reconcileLiveSession(a.id);assert.equal(sessions.get(a.id).status,'ended');assert.equal(sessions.get(a.id).payload.notice,undefined);assert.equal(providerCalls.length,calls);
});
test('a complete guide reply can interrupt its welcome without being treated as an unheard editorial question',async()=>{
 const a=await start();guideSession(a.id);
 await service.receiveLiveEvent('owner',a.id,event(1,'conversation.utterance','pal','Question 1?',true));
 await service.receiveLiveEvent('owner',a.id,event(2,'conversation.stopped_speaking','pal',undefined,true));
 await service.receiveLiveEvent('owner',a.id,event(3,'conversation.started_speaking','user'));
 await service.receiveLiveEvent('owner',a.id,event(4,'conversation.utterance','user','How do I upload photos?'));
 const response=await service.processBackendTurn(clone(sessions.get(a.id)),['How do I upload photos?']);
 assert.equal(response,'Question 2?');assert.equal(sessions.get(a.id).payload.turnState.turns[0].snapshot.guide.phase,'guide');
 assert.equal(sessions.get(a.id).payload.turnState.turns[0].status,'saved');
});
test('guide refresh and skip refuse pending user speech before the provider callback arrives',async()=>{
 const a=await start();guideSession(a.id,'interview');
 await service.receiveLiveEvent('owner',a.id,event(1,'conversation.started_speaking','user'));
 for(const command of [{action:'guide',guideAction:'refresh'},{action:'skip',questionId:'q1'}])
  await assert.rejects(service.controlLiveSession('owner',a.id,{...command,requestId:'guide-control-request'}),/spoken reply/);
 assert.equal(saves.length,0);
});
test('metadata-only guide refresh updates client facts without creating duplicate speech slots',async()=>{
 const a=await start();guideSession(a.id,'interview');
 const before=clone(sessions.get(a.id).payload.turnState.speech);
 const command={action:'guide',guideAction:'refresh',requestId:'guide-refresh-noop'};
 const refreshed=await service.controlLiveSession('owner',a.id,command);await service.controlLiveSession('owner',a.id,command);
 assert.equal(refreshed.snapshot.guide.photoCount,4);assert.equal(refreshed.snapshot.version,'1');
 assert.deepEqual(sessions.get(a.id).payload.turnState.speech,before);assert.equal(saves.length,0);
});
test('guide interview image binding unwraps canonical scope while setup phase cannot bind a photograph',async()=>{
 const a=await start();guideSession(a.id);
 await assert.rejects(service.linkLiveImage('owner',a.id,{questionId:'q1',selectedImageId:'image-one'}));
 guideSession(a.id,'interview');
 await service.linkLiveImage('owner',a.id,{questionId:'q1',selectedImageId:'image-one'});
 assert.equal(sessions.get(a.id).payload.imageBinding.imageId,'image-one');
 await assert.rejects(service.linkLiveImage('owner',a.id,{questionId:'q1',selectedImageId:'foreign'}));
});
test('retained guide speech cannot be manually reassigned to canonical interview evidence',async()=>{
 const a=await start();guideSession(a.id);
 const row=sessions.get(a.id),old=clone(row.payload.snapshot);
 row.payload.turnState.turns.push({position:1,raw:'Where do I upload?',historyHash:provider.backendHash(JSON.stringify(['Where do I upload?'])),status:'needs_review',receipt:'setup-retained',snapshot:old});
 guideSession(a.id,'interview');
 await assert.rejects(service.recoverLiveTurn('owner',a.id,{turnPosition:1,target:'current',text:'Where do I upload?'}),/cannot be reassigned/);
 assert.equal(saves.length,0);assert.equal(sessions.get(a.id).payload.turnState.turns[0].status,'needs_review');
});
(async()=>{for(const[name,fn]of cases){reset();await fn();console.log('PASS',name);}console.log(`${cases.length} live transport checks passed; provider, canonical and DB boundaries mocked.`);})().catch(error=>{console.error(error);process.exitCode=1;});

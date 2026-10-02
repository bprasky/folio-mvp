import 'server-only';
import { randomBytes, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rateLimit';
import { resolvePublishingStudioContext } from '@/lib/publishing-studio/data';
import { assertCaptureStorageReady } from '@/lib/interview-media/storage';
import { authorizeLiveSource, executeLiveCommand, prepareLiveInterview } from './adapters';
import { PROJECT_GUIDE_STEPS, type ProjectGuideStep, type LiveAdapterCommand, type LiveAdapterSnapshot, type LiveSource } from './adapter-types';
import type { GuidedSession } from '@/lib/interview/guided/types';
import { CAPTURE_CONSENT_VERSION, CAPTURE_DISCLOSURE, LiveError, liveConfig, liveEnabled, recordingEnabled, type CaptureMode } from './config';
import { backendHash, createConversation, createPal, deletePal, endConversation, findConversations, findPals, getConversation, openJoin, ProviderError, sealJoin } from './provider';
import { createLiveSession, findLiveSessionByCredential, getLatestLiveSession, getLiveSession, listLiveSessionsForCleanup, mutateLiveSession, type LiveSession } from './store';
import { acceptSpeechEvent, finalSpeechForTurn, prepareSpeech, questionForFinal, spokenQuestion, validEvent, type LiveTurn, type TurnState } from './turns';

type Payload = {
  source: LiveSource; snapshot?: LiveAdapterSnapshot; workspaceId: string | null;
  startRequestId: string; consent: {version: string; at: string; mode: CaptureMode; disclosure: string};
  turnState: TurnState; sealedJoin?: string; notice?: string; cleanupStage?: string;
  commandLease?: number; commandReceipt?: string; endReason?: string;
  imageBinding?: {questionId:string; imageId:string};
};
const payload = (session: LiveSession) => session.payload as Payload;
const active = (session: LiveSession) => session.status === 'active' && session.expiresAt.getTime() > Date.now();
export function parseLiveSource(value: unknown): LiveSource {
  if (!value || typeof value !== 'object') throw new LiveError('Choose an interview source.', 400);
  const source = value as LiveSource;
  if (!['project','project_guide','spotlight','expertise','story','designer_bio','org_bio','collaboration'].includes(source.kind)
    || typeof source.id !== 'string' || !source.id || source.id.length > 160
    || (source.round !== undefined && ![1,2,3].includes(source.round))) throw new LiveError('Invalid interview source.', 400);
  return {kind:source.kind,id:source.id,...(source.round ? {round:source.round} : {})};
}
async function authorizeActor(actorId: string, source: LiveSource, expectedWorkspace?: string | null) {
  const actor = await prisma.user.findUnique({where:{id:actorId},select:{accountStatus:true}});
  if (actor?.accountStatus !== 'APPROVED') throw new LiveError('An approved Folio account is required.', 403);
  await authorizeLiveSource(actorId, source);
  const workspace = await resolvePublishingStudioContext(actorId);
  if (expectedWorkspace !== undefined && expectedWorkspace !== workspace.id)
    throw new LiveError('Return to the workspace where this interview started.', 403);
  return workspace;
}
export async function liveAvailability(actorId: string, source: LiveSource) {
  if (!liveEnabled(actorId)) return {enabled:false, recordingEnabled:false};
  await authorizeActor(actorId, source);
  liveConfig();
  return {enabled:true,recordingEnabled:!source.id.startsWith('new:') && recordingEnabled(),consentVersion:CAPTURE_CONSENT_VERSION,disclosure:CAPTURE_DISCLOSURE,
    draftScope:backendHash(JSON.stringify([actorId,source]))};
}
function clientState(session: LiveSession, includeJoin = false) {
  const p = payload(session); const snapshot = p.snapshot;
  return {id:session.id,status:session.status,expiresAt:session.expiresAt.toISOString(),
    snapshot:snapshot ? {source:snapshot.source,interviewId:snapshot.interviewId,version:snapshot.version,status:snapshot.status,
      currentQuestion:snapshot.currentQuestion,sourceRefs:snapshot.sourceRefs,notice:snapshot.notice,...(snapshot.guide?{guide:snapshot.guide}:{})} : undefined,
    turns:p.turnState.turns.map(({position,raw,status,response,questionId,asked,error,inputMode,requestId,snapshot:askedSnapshot})=>({position,raw,status,response,questionId,asked,error,inputMode,requestId,version:askedSnapshot?.version})),
    notice:p.notice,recordingEnabled:!p.source.id.startsWith('new:') && recordingEnabled(),consent:p.consent,
    ...(includeJoin && active(session) && p.sealedJoin ? {join:openJoin(p.sealedJoin)} : {})};
}
export async function readLiveSession(actorId: string, id: string) {
  let session = await ownedSession(actorId,id);
  await authorizeActor(actorId,payload(session).source,payload(session).workspaceId);
  session = await reviewExpiredText(session);
  return clientState(session);
}
async function ownedSession(actorId: string, id: string) {
  const session = await getLiveSession(id);
  if (!session || session.actorId !== actorId) throw new LiveError('Interview not found.',404);
  return session;
}
export async function startLiveSession(actorId: string, input: {source:unknown; requestId:string; mode:CaptureMode; consentVersion:string; microphoneReady?:boolean; inputMode?:'voice'|'text'; selectedImageId?:string|null; workspaceStep?:ProjectGuideStep; intakeSessionId?:string}) {
  if (!liveEnabled(actorId)) throw new LiveError('Live interviews are not available for this account.',403);
  const inputMode=input.inputMode ?? 'voice';
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId ?? '') || !['voice','text'].includes(inputMode)
    || (inputMode==='voice' && input.microphoneReady !== true) || (inputMode==='text' && input.mode!=='none')
    || !['none','audio','video'].includes(input.mode) || input.consentVersion !== CAPTURE_CONSENT_VERSION)
    throw new LiveError('Confirm the recording choice and microphone permission before starting.',400);
  const source = parseLiveSource(input.source);
  if (input.workspaceStep !== undefined && (source.kind !== 'project_guide' || !PROJECT_GUIDE_STEPS.includes(input.workspaceStep))) throw new LiveError('Choose a valid project step.',400);
  if (source.kind==='project_guide' && input.mode!=='none') throw new LiveError('Join your host, then choose recording with explicit consent.',403);
  const workspace = await authorizeActor(actorId,source); const config = liveConfig();
  if (!(await checkRateLimit(`live-start:${actorId}`,{max:12,windowMs:60_000})).success) throw new LiveError('Please wait before starting again.',429);
  if (input.mode !== 'none') {
    if (!recordingEnabled()) throw new LiveError('Recording is not available. Choose an interview without recording.',403);
    await assertCaptureStorageReady();
  }
  const previous=await getLatestLiveSession(actorId,source.kind,source.id,undefined,source.round||1);
  const latest=previous ? await reviewExpiredText(previous) : null;
  if(latest && payload(latest).turnState.turns.some(turn=>turn.status==='needs_review'))
    return {...clientState(latest),notice:'Review the retained answer from your previous live session before starting another call.'};
  if(latest && payload(latest).turnState.turns.some(turn=>turn.inputMode==='text' && turn.status!=='saved'))
    return {...clientState(latest),notice:'Your typed answer is retained. Wait for it to save, or end this call and review it before starting another.'};
  const id = randomUUID(); const credential = randomBytes(32).toString('base64url');
  const reservation = await createLiveSession({id,actorId,sourceType:source.kind,sourceId:source.id,canonicalId:source.id,
    status:'starting',credentialHash:backendHash(credential),expiresAt:new Date(Date.now()+config.duration*1000),providerIds:{},
    payload:{source,workspaceId:workspace.id,startRequestId:input.requestId,
      consent:{version:CAPTURE_CONSENT_VERSION,at:new Date().toISOString(),mode:input.mode,disclosure:CAPTURE_DISCLOSURE},
      turnState:{turns:[],speech:[],events:[]}} satisfies Payload},config);
  if (!reservation.created) {
    const prior=payload(reservation.session);
    if (prior.workspaceId !== workspace.id || prior.consent.mode !== input.mode || prior.source.kind!==source.kind || prior.source.id!==source.id || (prior.source.round||1)!==(source.round||1)) throw new LiveError('End the existing live session before changing recording, interview round or publishing identity.');
    return clientState(reservation.session,true);
  }
  try {
    const prior = await getLatestLiveSession(actorId,source.kind,source.id,id,source.round||1);
    let priorState = prior ? payload(prior).snapshot?.state : undefined;
    if (!priorState && source.kind === 'project_guide' && !source.id.startsWith('new:') && input.intakeSessionId) {
      const intake = await ownedSession(actorId,input.intakeSessionId);
      const intakePayload = payload(intake);
      if (intakePayload.source.kind !== 'project_guide' || intakePayload.source.id !== `new:${actorId}` || intakePayload.workspaceId !== workspace.id || intake.status !== 'ended')
        throw new LiveError('The opening conversation cannot be carried into this project.',409);
      // Only guide history follows intake. Never copy receipts or canonical answers.
      const native = intakePayload.snapshot?.state.native as import('./project-guide').ProjectGuideState | undefined;
      if (native?.kind === 'project_guide') priorState = { schemaVersion:1, skipped:[], receipts:{}, native:{kind:'project_guide', phase:'guide', revision:0, recentTurns:native.recentTurns} };
    }
    const snapshot = await prepareLiveInterview(actorId,source,`prepare-${id}`,priorState,input.workspaceStep);
    if (!snapshot.currentQuestion || snapshot.status === 'finished') throw new LiveError('This interview has no current question. Review it in the text workspace.');
    const imageId=validateImageBinding(source,snapshot,input.selectedImageId);
    await mutateLiveSession(id,s=>{const p=payload(s);p.snapshot=snapshot;s.canonicalId=source.kind==='project_guide'?source.id:snapshot.interviewId;prepareSpeech(p.turnState,snapshot);
      if(imageId)p.imageBinding={questionId:snapshot.currentQuestion!.id,imageId};});
    // Persist each completed provider step before starting the next, so cleanup can reconcile a crash.
    await mutateLiveSession(id,s=>{if(s.status!=='starting')throw new LiveError('Live start was cancelled.');payload(s).cleanupStage='creating_pal';});
    const palId = await createPal(id,credential);
    const prepared=await mutateLiveSession(id,s=>{s.providerIds.palId=palId;if(s.status==='starting')payload(s).cleanupStage='creating_conversation';},{cleanup:true});
    if(prepared.status!=='starting')throw new LiveError('Live start was cancelled.');
    const conversation=await createConversation(id,palId,spokenQuestion(snapshot));
    const session=await mutateLiveSession(id,s=>{
      s.providerIds.conversationId=conversation.conversation_id;
      if(s.status!=='starting')return;
      s.status='active';
      payload(s).sealedJoin=sealJoin({url:conversation.conversation_url,token:conversation.meeting_token!,conversationId:conversation.conversation_id});
      payload(s).cleanupStage='conversation_active';
    });
    if(!active(session)){await reconcileLiveSession(id);throw new LiveError('Live start was cancelled.');}
    return clientState(session,true);
  } catch(error) {
    const session = await getLiveSession(id);
    if (session) await mutateLiveSession(id,s=>{
      // Reset/navigation can finish shutdown while provider startup is still
      // returning. A late failure must not reserve that completed call again.
      if (s.status==='ended' || payload(s).cleanupStage==='complete') return;
      s.status=(error instanceof ProviderError && error.ambiguous) || !!s.providerIds.palId ? 'uncertain' : 'failed';
      payload(s).notice='Starting could not be confirmed. Saved interview progress is retained. Folio will reconcile this session before another call can start.';
    },{cleanup:true});
    // No provider-create retry. Cleanup reconciles potentially created paid conversations.
    throw error;
  }
}

/** Recording is a separate, explicit choice after the host has already joined.
 * Never reconnect (or create another paid conversation) to enable capture. */
export async function consentLiveRecording(actorId:string,id:string,input:{mode:CaptureMode;consentVersion:string;consent?:boolean}) {
  if (!liveEnabled(actorId) || !recordingEnabled()) throw new LiveError('Recording is not available yet.',403);
  if (!['audio','video'].includes(input.mode) || input.consent!==true || input.consentVersion!==CAPTURE_CONSENT_VERSION)
    throw new LiveError('Confirm private recording consent before recording.',400);
  const session=await ownedSession(actorId,id);const p=payload(session);
  await authorizeActor(actorId,p.source,p.workspaceId);
  if (p.source.kind!=='project_guide' || p.source.id.startsWith('new:')) throw new LiveError('Choose an existing project before recording.',403);
  await assertCaptureStorageReady();
  return clientState(await mutateLiveSession(id,s=>{
    if (!active(s)) throw new LiveError('Reconnect with your host before recording.');
    // Scope remains the project through guide/interview transitions; canonical
    // answer identity continues to live in the authoritative snapshot.
    s.canonicalId=payload(s).source.id;
    payload(s).consent={version:CAPTURE_CONSENT_VERSION,at:new Date().toISOString(),mode:input.mode,disclosure:CAPTURE_DISCLOSURE};
  }));
}

export async function receiveLiveEvent(actorId: string,id:string,event:unknown) {
  const session=await ownedSession(actorId,id);
  if (!active(session)) throw new LiveError('The live session has ended.');
  if (!validEvent(event) || (event.conversation_id && event.conversation_id !== session.providerIds.conversationId))
    throw new LiveError('Invalid conversation event.',400);
  if ((event.properties.speech?.length ?? 0)>100_000) throw new LiveError('Speech needs review in the text workspace.',413);
  const next=await mutateLiveSession(id,s=>{
    if (!active(s)) throw new LiveError('The session has ended.');
    const state=payload(s).turnState;
    if (state.events.length>=6000) throw new LiveError('Pause this session and resume to continue.',409);
    acceptSpeechEvent(state,event);
  });
  return clientState(next);
}

export async function assertLiveBackendAuth(id:string,authorization:string|null) {
  const match=/^Bearer ([A-Za-z0-9_-]{40,100})$/.exec(authorization??'');
  if (!match) throw new LiveError('Unauthorized.',401);
  const session=await findLiveSessionByCredential(backendHash(match[1]));
  if (!session || session.id!==id || !active(session)) throw new LiveError('Unauthorized.',401);
  if (!liveEnabled(session.actorId)) throw new LiveError('Live interviewing is paused.',403);
  await authorizeActor(session.actorId,payload(session).source,payload(session).workspaceId);
  if (!(await checkRateLimit(`live-turn:${id}`,{max:80,windowMs:60_000})).success) throw new LiveError('Please wait.',429);
  return session;
}
export function parseUserHistory(body:unknown) {
  const value=body as {stream?:boolean;messages?:Array<{role:string;content:unknown}>};
  if (value?.stream!==true || !Array.isArray(value.messages) || value.messages.length>1000) throw new LiveError('Streaming chat messages are required.',400);
  const users=value.messages.filter(m=>m.role==='user').map(m=>{
    if(typeof m.content!=='string') throw new LiveError('Text speech content is required.',400);
    return m.content;
  });
  return users;
}
const REVIEW_RESPONSE='Your words are retained. Please review the highlighted answer in Folio before we continue.';

function textNeedsReview(turn:LiveTurn) {
  return turn.inputMode==='text' && (turn.status==='awaiting_final' || (turn.status==='saving' && (turn.leaseUntil??0)<=Date.now()));
}
function retainPendingText(session:LiveSession) {
  for(const turn of payload(session).turnState?.turns??[])if(textNeedsReview(turn)) {
    turn.status='needs_review';turn.response=REVIEW_RESPONSE;
    turn.error='Your typed answer is retained. Review it before continuing.';delete turn.leaseUntil;
  }
}
async function reviewExpiredText(session:LiveSession) {
  if(active(session) || !payload(session).turnState.turns.some(textNeedsReview))return session;
  return mutateLiveSession(session.id,s=>{if(!active(s))retainPendingText(s);},{cleanup:true});
}

/** Register explicit text before sending conversation.respond; only the backend may ingest it. */
export async function prepareLiveText(actorId:string,id:string,input:{requestId:string;text:string;questionId:string;version:string}) {
  if(!liveEnabled(actorId))throw new LiveError('Live interviews are not available for this account.',403);
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId??'') || typeof input.text!=='string' || !input.text.trim()
    || input.text.length>2000 || typeof input.questionId!=='string' || typeof input.version!=='string')
    throw new LiveError('Enter an answer of up to 2,000 characters for the current question.',400);
  const session=await ownedSession(actorId,id);const p=payload(session);
  await authorizeActor(actorId,p.source,p.workspaceId);
  let created=false;
  const current=await mutateLiveSession(id,s=>{
    const state=payload(s);const turns=state.turnState.turns;
    const prior=turns.find(t=>t.requestId===input.requestId);
    if(prior) {
      if(prior.raw!==input.text || prior.snapshot?.currentQuestion?.id!==input.questionId || prior.snapshot?.version!==input.version)
        throw new LiveError('This typed answer receipt was already used. Review the retained answer.',409);
      return;
    }
    const snapshot=state.snapshot;
    if(!active(s))throw new LiveError('The live session has ended.');
    if((state.commandLease??0)>Date.now() || turns.some(t=>t.status!=='saved'))throw new LiveError('Wait for the pending answer or control to finish before typing another answer.');
    if(!snapshot?.currentQuestion || snapshot.currentQuestion.id!==input.questionId || snapshot.version!==input.version)
      throw new LiveError('The interview question changed. Review your typed answer before sending.',409);
    // Speech already observed by Folio must finish its own backend turn first.
    const boundary=Math.max(-1,...turns.map(t=>t.eventSeq??-1),...state.turnState.speech.filter(speech=>speech.delivered).map(speech=>speech.stoppedSeq??-1));
    if(state.turnState.events.some(event=>event.seq>boundary && event.properties.role==='user'
      && ['conversation.started_speaking','conversation.utterance'].includes(event.event_type)))
      throw new LiveError('Wait for the spoken answer to finish saving before typing.',409);
    if(turns.length>=250)throw new LiveError('Pause and resume this interview to continue.');
    const position=turns.length+1;
    turns.push({position,raw:input.text,historyHash:backendHash(JSON.stringify([...turns.map(t=>t.raw),input.text])),
      status:'awaiting_final',receipt:`live-${s.id}-${position}`,inputMode:'text',requestId:input.requestId,
      questionId:input.questionId,asked:snapshot.currentQuestion.text,snapshot:structuredClone(snapshot),
      selectedImageId:state.imageBinding?.questionId===input.questionId?state.imageBinding.imageId:null});
    created=true;
  });
  const turn=payload(current).turnState.turns.find(t=>t.requestId===input.requestId)!;
  return {...clientState(current),textRegistration:{requestId:input.requestId,position:turn.position,status:turn.status,created}};
}

/** The ONLY live answer ingestion boundary. Browser events never call executeLiveCommand(answer). */
export async function processBackendTurn(session:LiveSession,users:string[]) {
  const startedAt=Date.now();
  if(!users.length) return ''; // custom_greeting owns the first question, exactly once.
  const position=users.length; const raw=users[position-1];
  const digest=backendHash(JSON.stringify(users));
  let current=await mutateLiveSession(session.id,s=>{
    if(!active(s)) throw new LiveError('The session has ended.');
    const p=payload(s); const turns=p.turnState.turns;
    if((p.commandLease??0)>Date.now())throw new LiveError('An interview control is still saving. Retry this turn.');
    if(turns.some(t=>t.position<position && t.raw!==users[t.position-1])) throw new LiveError('Conversation history changed. Review the preserved answers.');
    const old=turns.find(t=>t.position===position);
    if(old && old.historyHash!==digest) throw new LiveError('A replay changed the earlier speech. Review the preserved answer.');
    if(old) return;
    if(position!==turns.length+1 || turns.some(t=>t.status!=='saved')) throw new LiveError('Review or save the preceding answer first.');
    if(turns.length>=250) throw new LiveError('Pause and resume this interview to continue.');
    turns.push({position,raw,historyHash:digest,status:'awaiting_final',receipt:`live-${s.id}-${position}`,
      ...(p.snapshot?.guide && p.snapshot.guide.phase!=='interview'?{snapshot:structuredClone(p.snapshot)}:{})});
  });
  let turn=payload(current).turnState.turns[position-1];
  if(turn.response) return turn.response;
  // Backend input finality is not promised by PAL docs. Wait for the full utterance event.
  const until=Date.now()+12_000;
  while(turn.inputMode!=='text' && !finalSpeechForTurn(payload(current).turnState,turn) && Date.now()<until) {
    await new Promise(resolve=>setTimeout(resolve,150));
    const refreshed=await getLiveSession(session.id);
    if(!refreshed || !active(refreshed)) throw new LiveError('The session has ended.');
    current=refreshed;turn=payload(current).turnState.turns[position-1];
    if(turn.response)return turn.response;
  }
  console.info('[live-turn-latency]',{stage:'finality',elapsedMs:Date.now()-startedAt,sourceKind:payload(current).source.kind,inputMode:turn.inputMode||'voice'});
  current=await mutateLiveSession(session.id,s=>{
    if(!active(s))throw new LiveError('The session has ended.');
    const p=payload(s);const t=p.turnState.turns[position-1];
    if(t.response)return;
    if(t.status==='saving' && (t.leaseUntil??0)>Date.now()) throw new LiveError('This answer is being saved. Retry the same turn.',409);
    if(t.inputMode==='text') {
      if(t.raw!==raw || t.historyHash!==digest || !t.snapshot || t.snapshot.version!==p.snapshot?.version
        || t.questionId!==p.snapshot?.currentQuestion?.id) {
        t.status='needs_review';t.error='The question changed before your typed answer was saved.';t.response=REVIEW_RESPONSE;return;
      }
      t.status='saving';t.leaseUntil=Date.now()+120_000;return;
    }
    const final=finalSpeechForTurn(p.turnState,t);
    // Setup replies may interrupt the welcome. They are bound to the immutable
    // guide phase captured at receipt and can never become editorial answers.
    const guideSnapshot=t.snapshot?.guide && t.snapshot.guide.phase!=='interview' && t.snapshot.version===p.snapshot?.version?t.snapshot:undefined;
    const asked=final && (guideSnapshot?.currentQuestion?{question:guideSnapshot.currentQuestion,snapshot:guideSnapshot}:questionForFinal(p.turnState,final));
    t.eventSeq=final?.seq;t.questionId=asked?.question.id;t.asked=asked?.question.text;t.snapshot=asked?.snapshot;
    t.selectedImageId=p.imageBinding?.questionId===t.questionId?p.imageBinding.imageId:null;
    if(!final || !asked || asked.question.id!==p.snapshot?.currentQuestion?.id) {
      t.status='needs_review';t.error=!final?'Full speech delivery was not confirmed.':'The question was interrupted or the answer may continue an earlier turn.';
      t.response=REVIEW_RESPONSE;return;
    }
    t.status='saving';t.leaseUntil=Date.now()+120_000;
  });
  turn=payload(current).turnState.turns[position-1];
  if(turn.response)return turn.response;
  const response=await saveTurn(current,turn,'answer',turn.raw);
  console.info('[live-turn-latency]',{stage:'backend',elapsedMs:Date.now()-startedAt,sourceKind:payload(current).source.kind});
  return response;
}

async function saveTurn(session:LiveSession,turn:LiveTurn,action:'answer'|'correct',text:string) {
  const startedAt=Date.now();
  const p=payload(session);const snapshot=p.snapshot;
  if(!snapshot)throw new LiveError('Interview state is unavailable.');
  try {
    const next=await executeLiveCommand(session.actorId,p.source,snapshot,{action,requestId:turn.receipt,questionId:turn.questionId,text,selectedImageId:turn.selectedImageId,
      ...(turn.inputMode==='text'?{inputModality:'text' as const}:{})});
    const response=spokenQuestion(next) || (next.status==='needs_review' ? 'Your answer is saved. Please retry the next question in Folio.' : 'Your interview progress is saved. You can review it in Folio.');
    await mutateLiveSession(session.id,s=>{
      const state=payload(s);const t=state.turnState.turns.find(t=>t.position===turn.position)!;
      t.status='saved';t.response=response;t.error=undefined;t.leaseUntil=undefined;
      state.snapshot=next;
      s.canonicalId=p.source.kind==='project_guide'?p.source.id:next.interviewId;
      delete state.imageBinding;
      if(active(s))prepareSpeech(state.turnState,next);
    },{cleanup:true});
    console.info('[live-turn-latency]',{stage:'save',elapsedMs:Date.now()-startedAt,sourceKind:p.source.kind,phase:snapshot.guide?.phase||'interview',outcome:'saved'});
    return response;
  }catch(error){
    await mutateLiveSession(session.id,s=>{
      const t=payload(s).turnState.turns.find(t=>t.position===turn.position)!;
      t.status='needs_review';t.leaseUntil=undefined;t.error='The canonical save or next question needs review. Your full original speech is retained.';
      t.response=REVIEW_RESPONSE;
    },{cleanup:true});
    console.info('[live-turn-latency]',{stage:'save',elapsedMs:Date.now()-startedAt,sourceKind:p.source.kind,phase:snapshot.guide?.phase||'interview',outcome:'needs_review'});
    return REVIEW_RESPONSE;
  }
}
function validateImageBinding(source:LiveSource,snapshot:LiveAdapterSnapshot,imageId:unknown):string|null {
  if(imageId===undefined || imageId===null)return null;
  if((source.kind!=='project' && !(source.kind==='project_guide' && snapshot.guide?.phase==='interview')) || typeof imageId!=='string' || imageId.length>200)throw new LiveError('Choose a photograph from this project.',422);
  const native=(source.kind==='project_guide'?(snapshot.state.native as {canonical:GuidedSession}).canonical:snapshot.state.native) as GuidedSession;const q=snapshot.currentQuestion;
  const allowed=q?.roomId==null?native.rooms.flatMap(room=>room.imageIds):native.rooms.find(room=>room.id===q.roomId)?.imageIds??[];
  if(!allowed.includes(imageId))throw new LiveError('Choose a photograph from the current question’s room.',422);
  return imageId;
}
export async function linkLiveImage(actorId:string,id:string,input:{questionId:string;selectedImageId:string|null}) {
  const session=await ownedSession(actorId,id);const p=payload(session);await authorizeActor(actorId,p.source,p.workspaceId);
  return clientState(await mutateLiveSession(id,s=>{
    const state=payload(s);
    if(!active(s)||state.snapshot?.currentQuestion?.id!==input.questionId||state.turnState.turns.some(t=>t.status!=='saved'))throw new LiveError('Wait for the current answer to save before linking a photo.');
    const imageId=validateImageBinding(state.source,state.snapshot,input.selectedImageId);
    state.imageBinding=imageId?{questionId:input.questionId,imageId}:undefined;
  }));
}
/** Explicit refresh never saves retained speech or silently changes its attribution. */
export async function refreshLiveReview(actorId:string,id:string) {
  const session=await ownedSession(actorId,id);const p=payload(session);await authorizeActor(actorId,p.source,p.workspaceId);
  await mutateLiveSession(id,s=>{
    const state=payload(s);
    if(active(s)||(state.commandLease??0)>Date.now()||state.turnState.turns.some(t=>t.status==='saving'))throw new LiveError('End the live call and wait for saving before refreshing review.');
    state.commandLease=Date.now()+120_000;
  });
  try {
    const snapshot=p.source.kind==='project_guide' && p.snapshot
      ? await (await import('./project-guide')).refreshProjectGuideReview(actorId,p.source,p.snapshot,`review-refresh-${randomUUID()}`)
      : await prepareLiveInterview(actorId,p.source,`review-refresh-${randomUUID()}`,p.snapshot?.state);
    return clientState(await mutateLiveSession(id,s=>{payload(s).snapshot=snapshot;delete payload(s).imageBinding;}));
  } finally {await mutateLiveSession(id,s=>{payload(s).commandLease=undefined;},{cleanup:true});}
}
export async function recoverLiveTurn(actorId:string,id:string,input:{turnPosition:number;target:'current'|'previous';text:string}) {
  const session=await ownedSession(actorId,id);const p=payload(session);
  await authorizeActor(actorId,p.source,p.workspaceId);
  if(typeof input.text!=='string' || !input.text.trim() || !['current','previous'].includes(input.target))throw new LiveError('Review the full answer before saving.',400);
  const current=await mutateLiveSession(id,s=>{
    const state=payload(s);const t=state.turnState.turns.find(t=>t.position===input.turnPosition);
    if(!t || t.status!=='needs_review')throw new LiveError('This answer is not awaiting review.');
    if((state.commandLease??0)>Date.now()||state.turnState.turns.some(other=>other.status==='saving'))throw new LiveError('An answer is still saving.');
    const previous=state.turnState.turns.filter(other=>other.position<t.position && other.status==='saved').at(-1);
    if(state.source.kind==='project_guide' && ((t.snapshot?.guide?.phase==='interview')!==(state.snapshot?.guide?.phase==='interview')
      || (input.target==='previous' && (previous?.snapshot?.guide?.phase==='interview')!==(t.snapshot?.guide?.phase==='interview'))))throw new LiveError('Setup conversation cannot be reassigned as an interview answer.');
    const questionId=input.target==='previous'?previous?.questionId:state.snapshot?.currentQuestion?.id;
    if(!questionId)throw new LiveError('No question is available for that attribution.');
    const saveAction=input.target==='previous'?'correct':'answer';
    const unchangedRetry=input.text===(t.reviewedText??t.raw) && questionId===t.questionId && (t.saveAction??'answer')===saveAction;
    if(questionId!==t.questionId)t.selectedImageId=null;
    t.questionId=questionId;t.reviewedText=input.text;t.status='saving';t.response=undefined;t.leaseUntil=Date.now()+120_000;
    t.saveAction=saveAction;
    // A canonical commit can succeed before the transport receipt write fails.
    // Replaying unchanged speech MUST retain that original canonical receipt.
    if(!unchangedRetry)t.receipt=`live-review-${s.id}-${t.position}-${backendHash(JSON.stringify([input.target,questionId,input.text])).slice(0,16)}`;
  });
  const turn=payload(current).turnState.turns.find(t=>t.position===input.turnPosition)!;
  await saveTurn(current,turn,input.target==='previous'?'correct':'answer',input.text);
  return clientState((await getLiveSession(id))!);
}
export async function controlLiveSession(actorId:string,id:string,command:LiveAdapterCommand) {
  const session=await ownedSession(actorId,id);const p=payload(session);
  await authorizeActor(actorId,p.source,p.workspaceId);
  if(!command || !['skip','reuse','retry','finish','correct','guide'].includes(command.action))throw new LiveError('Use the spoken answer flow for new answers.',400);
  if(command.action==='guide' && (p.source.kind!=='project_guide' || !['refresh','return_guide','start_interview','resume_interview','start_over','add_more','open_upload','open_rooms','open_tagging','none'].includes(command.guideAction??'')))throw new LiveError('Choose a valid project guide action.',400);
  if(command.workspaceStep !== undefined && (p.source.kind !== 'project_guide' || command.action !== 'guide' || !PROJECT_GUIDE_STEPS.includes(command.workspaceStep)))throw new LiveError('Choose a valid project step.',400);
  if(!/^[a-zA-Z0-9-]{8,100}$/.test(command.requestId??''))throw new LiveError('A control receipt is required.',400);
  await mutateLiveSession(id,s=>{
    const state=payload(s);
    if((state.commandLease??0)>Date.now() || state.turnState.turns.some(t=>t.status!=='saved'))throw new LiveError('Save or review the pending speech before using interview controls.');
    if(p.source.kind==='project_guide') {
      const boundary=Math.max(-1,...state.turnState.turns.map(t=>t.eventSeq??-1),...state.turnState.speech.filter(speech=>speech.delivered).map(speech=>speech.stoppedSeq??-1));
      if(state.turnState.events.some(event=>event.seq>boundary && event.properties.role==='user' && ['conversation.started_speaking','conversation.utterance'].includes(event.event_type)))throw new LiveError('Wait for your spoken reply to finish before changing guide steps.');
    }
    state.commandLease=Date.now()+120_000;state.commandReceipt=command.requestId;
  });
  try{
    const snapshot=await executeLiveCommand(actorId,p.source,p.snapshot!,command);
    return clientState(await mutateLiveSession(id,s=>{const state=payload(s);const changed=state.snapshot?.version!==snapshot.version;state.snapshot=snapshot;s.canonicalId=p.source.kind==='project_guide'?p.source.id:snapshot.interviewId;state.commandLease=undefined;if(changed)prepareSpeech(state.turnState,snapshot);}));
  }finally{await mutateLiveSession(id,s=>{payload(s).commandLease=undefined;},{cleanup:true});}
}

/** End is allowed after flags, permissions, or account status change: it only reduces access/cost. */
export async function endLiveSession(actorId:string,id:string,reason:string) {
  await ownedSession(actorId,id);
  await mutateLiveSession(id,s=>{
    if(s.status==='ended' || payload(s).cleanupStage==='complete') {
      s.status='ended';delete payload(s).notice;delete payload(s).sealedJoin;return;
    }
    s.status='ending';payload(s).endReason=reason;delete payload(s).sealedJoin;retainPendingText(s);
  },{cleanup:true});
  await reconcileLiveSession(id);
  return clientState((await getLiveSession(id))!);
}
export async function reconcileLiveSession(id:string) {
  const session=await getLiveSession(id);if(!session)return;
  // Repair reservations left by older late-start/end races. "complete" is
  // written only after authenticated provider shutdown and PAL deletion.
  if(payload(session).cleanupStage==='complete') {
    if(session.status!=='ended' || payload(session).notice) await mutateLiveSession(id,s=>{
      if(payload(s).cleanupStage!=='complete')return;
      s.status='ended';s.expiresAt=new Date();delete payload(s).notice;delete payload(s).sealedJoin;retainPendingText(s);
    },{cleanup:true});
    return;
  }
  if(session.status==='ended' || active(session))return;
  try{
    const p=payload(session);
    const conversations=session.providerIds.conversationId
      ? [await getConversation(session.providerIds.conversationId)]
      : p.cleanupStage==='creating_conversation' ? await findConversations(id) : [];
    // An empty list after a timeout is not proof that an in-flight create failed.
    // Retain its reservation through the bounded call lifetime unless a resource is found.
    if(!session.providerIds.conversationId && p.cleanupStage==='creating_conversation' && !conversations.length && session.expiresAt.getTime()>Date.now())
      throw new LiveError('An uncertain provider create is still being reconciled.');
    for(const c of conversations)if(c.status!=='ended')await endConversation(c.conversation_id);
    // Confirm ended through an authenticated read before deleting an ephemeral PAL.
    for(const c of conversations)if((await getConversation(c.conversation_id)).status!=='ended')throw new LiveError('Provider shutdown is pending.');
    const pals=session.providerIds.palId?[session.providerIds.palId]:p.cleanupStage==='creating_pal'?await findPals(id):[];
    if(p.cleanupStage==='creating_pal' && !pals.length && session.expiresAt.getTime()>Date.now())
      throw new LiveError('An uncertain PAL create is still being reconciled.');
    for(const pal of pals){try{await deletePal(pal);}catch(e){if(!(e instanceof ProviderError && e.status===404))throw e;}}
    await mutateLiveSession(id,s=>{s.status='ended';s.expiresAt=new Date();payload(s).cleanupStage='complete';delete payload(s).notice;delete payload(s).sealedJoin;retainPendingText(s);},{cleanup:true});
  }catch{
    await mutateLiveSession(id,s=>{
      // Another cleanup invocation may have completed while this provider request failed.
      if(s.status==='ended' || payload(s).cleanupStage==='complete')return;
      s.status='uncertain';payload(s).notice='Provider cleanup is pending. This session is reserved until reconciliation succeeds.';
    },{cleanup:true});
  }
}
export async function cleanupLiveSessions(limit = 100) {
  const sessions=await listLiveSessionsForCleanup(limit);
  for(const session of sessions)await reconcileLiveSession(session.id);
  return {checked:sessions.length};
}

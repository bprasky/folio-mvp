import 'server-only';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { canCreateFirmProject } from '@/lib/orgPermissions';
import { assertLegacyInterviewAllowed } from '@/lib/spotlight/legacyBoundary';
import { computePublishReadiness, isDocumentImage } from '@/lib/publish/computePublishReadiness';
import { getGuidedSession, runGuidedCommand } from '@/lib/interview/guided/service';
import { acceptedTurns, commandDigest } from '@/lib/interview/guided/controller';
import { loadInterviewAnswers } from '@/lib/posting/loadInterviewAnswers';
import type { GuidedSession } from '@/lib/interview/guided/types';
import { LiveError, recordingEnabled } from './config';
import { planProjectGuide } from './project-guide-planner';
import type { LiveAdapterCommand, LiveAdapterSnapshot, LiveAdapterState, LiveSource, ProjectGuideAction, ProjectGuideMetadata } from './adapter-types';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export interface ProjectGuideState {
  kind: 'project_guide'; phase: ProjectGuideMetadata['phase']; revision: number;
  canonical?: GuidedSession;
  offeredDetail?: ProjectGuideMetadata['offeredDetail'];
  recentTurns: Array<{ role: 'user' | 'assistant'; text: string }>;
}
export async function authorizeProjectGuide(actorId: string, sourceId: string) {
  if (!sourceId.startsWith('new:')) {
    assertLegacyInterviewAllowed(sourceId);
    await assertProjectWrite(actorId, sourceId);
    return;
  }
  if (sourceId !== `new:${actorId}`) throw new LiveError('This project guide belongs to another account.', 403);
  const user = await prisma.user.findUnique({ where: { id: actorId }, select: { operatingAsOrgId: true } });
  const membership = user?.operatingAsOrgId ? await prisma.organizationUser.findFirst({
    where: { userId: actorId, organizationId: user.operatingAsOrgId, isActive: true },
    select: { role: true, organization: { select: { type: true } } },
  }) : null;
  if (!membership || !canCreateFirmProject(membership.role, membership.organization.type))
    throw new LiveError('Choose a firm with project creation access to continue.', 403);
}

/** Author-only facts, re-read from persisted rows. Pending import candidates and
 * browser upload progress cannot be presented as saved project photographs. */
export async function readProjectGuideContext(actorId: string, source: LiveSource) {
  await authorizeProjectGuide(actorId, source.id);
  if (source.id.startsWith('new:')) return { projectId: null, projectName: 'Your new project', photoCount: 0, taggedPhotoCount: 0,
    reviewedPhotoCount: 0, unreviewedPhotoCount: 0, sortedPhotoCount: 0, answeredCount: 0, remainingQuestionCount: null,
    stage: 'upload' as const, allowedActions: ['open_upload'] as ProjectGuideAction[], canonical: null, legacyInterview: false, version: 'new' };
  const [project, canonical] = await Promise.all([
    prisma.project.findUnique({ where: { id: source.id }, select: {
      id: true, title: true, rooms: { select: { id: true } },
      images: { select: { id: true, name: true, roomId: true, inclusion: true, noProducts: true, _count: { select: { tags: true } } } },
    } }),
    getGuidedSession(source.id, actorId),
  ]);
  if (!project) throw new LiveError('Project not found.', 404);
  const rooms = new Set(project.rooms.map(room => room.id));
  const photos = project.images.filter(image => !isDocumentImage(image.name));
  const included = photos.filter(image => image.inclusion === 'INCLUDED');
  const readiness = computePublishReadiness({ photos: photos.map(image => ({ ...image, roomId: image.roomId && rooms.has(image.roomId) ? image.roomId : null, tagCount: image._count.tags })), roomCount: rooms.size, storyComplete: false });
  const legacyAnswers = canonical ? [] : await loadInterviewAnswers(source.id);
  const legacyInterview = !canonical && legacyAnswers.length > 0;
  const answeredCount = canonical ? acceptedTurns(canonical).length : legacyAnswers.length;
  const remainingQuestionCount = canonical?.roomsPrepared ? canonical.plan.filter(question => ['active', 'pending'].includes(question.status)).length : null;
  const complete = !!canonical && (canonical.status === 'finished' || (canonical.status === 'ready' && remainingQuestionCount === 0));
  const stage: ProjectGuideMetadata['stage'] = complete ? 'interview_complete' : legacyInterview || (canonical && canonical.turns.length > 0) ? 'interview_resume' : !included.length ? 'upload'
    : !readiness.gates.rooms.complete || !readiness.gates.tags.complete ? 'tagging' : 'interview_new';
  const allowedActions: ProjectGuideAction[] = ['open_upload', 'open_tagging'];
  if (included.length || legacyInterview) allowedActions.push(complete ? 'add_more' : canonical || legacyInterview ? 'resume_interview' : 'start_interview');
  if (canonical || legacyInterview) allowedActions.push('start_over');
  return { projectId: project.id, projectName: project.title || 'Your project', photoCount: included.length,
    taggedPhotoCount: included.filter(image => image._count.tags > 0).length,
    reviewedPhotoCount: included.length - readiness.gates.tags.remaining,
    unreviewedPhotoCount: readiness.gates.tags.remaining,
    sortedPhotoCount: included.filter(image => !!image.roomId && rooms.has(image.roomId)).length,
    answeredCount, remainingQuestionCount, stage, allowedActions, canonical, legacyInterview,
    version: hash([photos.map(image => [image.id, image.inclusion, image.roomId, image.noProducts, image._count.tags]), Array.from(rooms), canonical?.id, canonical?.version]) };
}
type Context = Awaited<ReturnType<typeof readProjectGuideContext>>;
function plannerInput(context: Context, userText: string, recentTurns: ProjectGuideState['recentTurns']) {
  return { stage: context.stage, projectId: context.projectId || undefined, projectName: context.projectName,
    photoCount: context.photoCount, taggedPhotoCount: context.taggedPhotoCount, unreviewedPhotoCount: context.unreviewedPhotoCount,
    sortedPhotoCount: context.sortedPhotoCount, answeredCount: context.answeredCount, remainingQuestionCount: context.remainingQuestionCount,
    allowedActions: context.allowedActions, recordingAvailable: !!context.projectId && recordingEnabled(), userText, recentTurns };
}
function metadata(context: Context, phase: ProjectGuideMetadata['phase'], action: ProjectGuideAction, actionId: string): ProjectGuideMetadata {
  return { projectId: context.projectId, projectName: context.projectName, stage: context.stage,
    photoCount: context.photoCount, taggedPhotoCount: context.taggedPhotoCount, reviewedPhotoCount: context.reviewedPhotoCount,
    unreviewedPhotoCount: context.unreviewedPhotoCount, sortedPhotoCount: context.sortedPhotoCount,
    answeredCount: context.answeredCount, remainingQuestionCount: context.remainingQuestionCount,
    allowedActions: context.allowedActions, legacyInterview: context.legacyInterview, phase, action, actionId };
}
function nativeState(state?: LiveAdapterState): ProjectGuideState {
  const value = state?.native as ProjectGuideState | undefined;
  return value?.kind === 'project_guide' ? structuredClone(value) : { kind: 'project_guide', phase: 'guide', revision: 0, recentTurns: [] };
}
function buildSnapshot(source: LiveSource, context: Context, state: LiveAdapterState, native: ProjectGuideState,
  text: string, action: ProjectGuideAction, receipt: string): LiveAdapterSnapshot {
  if (native.phase !== 'interview') native.canonical = context.canonical || undefined;
  const canonical = native.phase === 'interview' ? native.canonical : undefined;
  const question = canonical?.plan.find(q => q.id === canonical.activeQuestionId);
  if (!question || native.offeredDetail?.questionId !== question.id || question.category !== 'additional_detail') delete native.offeredDetail;
  if (canonical) context = { ...context, canonical, answeredCount: acceptedTurns(canonical).length,
    remainingQuestionCount: canonical.roomsPrepared ? canonical.plan.filter(q => ['active', 'pending'].includes(q.status)).length : null, stage: 'interview_resume' };
  return { source, interviewId: canonical?.id || `guide:${source.id}`, version: `${native.revision}:${context.version}:${canonical?.version ?? 0}`,
    status: canonical?.status === 'deciding' ? 'needs_review' : canonical?.status || 'active',
    currentQuestion: question ? { id: question.id, text: question.text, reaction: question.reaction, sourceImageIds: question.sourceImageIds, roomId: question.roomId }
      : canonical ? null : { id: `guide-${receipt}`, text, sourceImageIds: [] },
    sourceRefs: context.projectId ? [{ kind: 'project', id: context.projectId, projectId: context.projectId, version: context.version, publicEligible: false }] : [],
    state: { ...state, native }, guide: { ...metadata(context, native.phase, action, receipt), ...(native.offeredDetail ? { offeredDetail: native.offeredDetail } : {}) }, notice: canonical?.notice || undefined };
}
export async function prepareProjectGuide(actorId: string, source: LiveSource, requestId: string, previous?: LiveAdapterState) {
  const context = await readProjectGuideContext(actorId, source);
  const state = previous ? structuredClone(previous) : { schemaVersion: 1 as const, skipped: [], receipts: {} };
  const native = nativeState(state);
  // Every new call opens with context and the creator's choice. It never starts
  // or resumes the canonical interview merely because a Story page was opened.
  native.phase = context.stage === 'interview_complete' ? 'complete' : 'guide'; native.revision++;
  const response = await planProjectGuide(plannerInput(context, '', native.recentTurns));
  native.recentTurns = [...native.recentTurns, { role: 'assistant' as const, text: response.reply }].slice(-8);
  return buildSnapshot(source, context, state, native, response.reply, 'none', requestId);
}
export async function refreshProjectGuideReview(actorId: string, source: LiveSource, previous: LiveAdapterSnapshot, requestId: string) {
  const context = await readProjectGuideContext(actorId, source); const native = nativeState(previous.state);
  if (native.phase !== 'interview') return prepareProjectGuide(actorId, source, requestId, previous.state);
  if (!context.canonical) throw new LiveError('The saved interview is unavailable.');
  native.canonical = context.canonical; native.revision++;
  return buildSnapshot(source, context, previous.state, native, '', 'none', requestId);
}
export async function executeProjectGuide(actorId: string, source: LiveSource, previous: LiveAdapterSnapshot, command: LiveAdapterCommand) {
  const context = await readProjectGuideContext(actorId, source);
  const state = structuredClone(previous.state); const native = nativeState(state);
  const digest = hash(command);
  if (state.receipts[command.requestId]) {
    if (state.receipts[command.requestId] !== digest) throw new LiveError('That guide request was already used for different content.');
    return previous;
  }
  let action: ProjectGuideAction = 'none'; let reply = ''; let offeredText: string | undefined;
  // The canonical transition may have committed before the live snapshot write.
  // Reconstruct only the transition allowed by the original guide snapshot and
  // verify its exact command digest before recovering that durable result.
  if (native.phase !== 'interview' && context.canonical?.requestIds.includes(command.requestId)) {
    const prior = native.canonical;
    const requested = previous.guide?.allowedActions.filter(candidate => ['start_interview', 'resume_interview', 'add_more'].includes(candidate)
      && (command.action === 'answer' || (command.action === 'guide' && command.guideAction === candidate))) || [];
    const recoveredAction = requested.find(candidate => commandDigest({
      action: !prior ? 'start' : candidate === 'add_more' && !prior.plan.some(q => ['active', 'pending'].includes(q.status)) ? 'add_detail' : 'resume',
      requestId: command.requestId, version: prior?.version || 0, sessionId: prior?.id, conversationStyle: 'podcast', guideCommandDigest: digest,
    }) === context.canonical!.requestDigests?.[command.requestId]);
    if (!recoveredAction) throw new LiveError('That guide request was already used for different content.');
    native.canonical = context.canonical; native.phase = 'interview'; native.revision++; state.receipts[command.requestId] = digest;
    if (recoveredAction === 'add_more' && command.action === 'answer' && previous.guide?.stage === 'interview_complete') {
      const response = await planProjectGuide(plannerInput({ ...context, ...previous.guide, canonical: prior || null }, command.text || '', native.recentTurns));
      if (response.detailText && command.text?.includes(response.detailText) && native.canonical.activeQuestionId)
        native.offeredDetail = { text: response.detailText, questionId: native.canonical.activeQuestionId };
    }
    return buildSnapshot(source, context, state, native, '', recoveredAction, command.requestId);
  }
  if (native.phase === 'interview' && command.action !== 'guide') {
    if (!native.canonical || !context.projectId) throw new LiveError('The interview needs to be resumed.');
    const canonical = await runGuidedCommand(context.projectId, actorId, { action: command.action === 'reuse' ? 'confirm' : command.action,
      requestId: command.requestId, version: native.canonical.version, sessionId: native.canonical.id,
      questionId: command.questionId, text: command.text, inputModality: command.inputModality || 'voice',
      selectedImageId: command.selectedImageId, confirmPartial: command.confirmPartial });
    native.canonical = canonical; native.revision++;
    state.receipts[command.requestId] = digest;
    if (canonical.status !== 'ready' && canonical.status !== 'finished') return buildSnapshot(source, context, state, native, '', 'none', command.requestId);
    native.phase = 'complete';
    const refreshed = await readProjectGuideContext(actorId, source);
    const response = await planProjectGuide(plannerInput(refreshed, '', []));
    native.recentTurns = [...native.recentTurns, { role: 'assistant' as const, text: response.reply }].slice(-8);
    return buildSnapshot(source, refreshed, state, native, response.reply, 'none', command.requestId);
  }
  if (command.action === 'guide') {
    if (!command.guideAction) throw new LiveError('Choose a guide action.', 400);
    if (command.guideAction === 'refresh' && native.phase === 'interview') {
      // Refresh saved setup facts beside an active interview without changing
      // its question/version, native evidence, or delivered-speech attribution.
      // The transport/UI use the unchanged version to avoid preparing or echoing
      // another question; the metadata still reaches the progress sidebar.
      state.receipts[command.requestId] = digest;
      return { ...previous, state,
        sourceRefs: previous.sourceRefs.map(ref => ref.kind === 'project' && ref.id === context.projectId ? { ...ref, version: context.version } : ref),
        guide: { ...metadata(context, 'interview', 'none', command.requestId), ...(previous.guide?.offeredDetail ? { offeredDetail: previous.guide.offeredDetail } : {}) } };
    }
    action = ['refresh', 'return_guide'].includes(command.guideAction) ? 'none' : command.guideAction as ProjectGuideAction;
  } else {
    if (command.action !== 'answer') throw new LiveError('Choose a guide action before editing interview answers.', 400);
    const response = await planProjectGuide(plannerInput(context, command.text || '', native.recentTurns));
    action = response.action; reply = response.reply;
    if (context.stage === 'interview_complete' && action === 'add_more' && response.detailText && (command.text || '').includes(response.detailText)) offeredText = response.detailText;
    native.recentTurns = [...native.recentTurns, { role: 'user' as const, text: command.text || '' }, { role: 'assistant' as const, text: reply }].slice(-8);
  }
  if (action !== 'none' && !context.allowedActions.includes(action)) throw new LiveError('That step is not available for the saved project yet.');
  if (['start_interview', 'resume_interview', 'add_more'].includes(action)) {
    if (!context.projectId) throw new LiveError('Create the project before beginning its interview.');
    if (context.legacyInterview) {
      native.phase = 'guide'; native.revision++; state.receipts[command.requestId] = digest;
      return buildSnapshot(source, context, state, native, 'Your earlier interview is saved. Let’s open it so you can continue without replacing those answers.', 'resume_interview', command.requestId);
    }
    const current = context.canonical;
    const canonicalAction = !current ? 'start' : action === 'add_more' && !current.plan.some(q => ['active','pending'].includes(q.status)) ? 'add_detail' : 'resume';
    if (!current && process.env.NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW !== '1') throw new LiveError('New guided interviews are not enabled.', 404);
    native.canonical = await runGuidedCommand(context.projectId, actorId, { action: canonicalAction, requestId: command.requestId,
      version: current?.version || 0, sessionId: current?.id, conversationStyle: 'podcast', guideCommandDigest: digest });
    native.phase = 'interview';
    if (canonicalAction === 'add_detail' && offeredText && native.canonical.activeQuestionId) {
      native.offeredDetail = { text: offeredText, questionId: native.canonical.activeQuestionId };
    }
  } else {
    native.phase = context.stage === 'interview_complete' ? 'complete' : 'guide';
    if (!reply) {
      reply = (await planProjectGuide(plannerInput(context, '', native.recentTurns))).reply;
      native.recentTurns = [...native.recentTurns, { role: 'assistant' as const, text: reply }].slice(-8);
    }
  }
  native.revision++; state.receipts[command.requestId] = digest;
  return buildSnapshot(source, context, state, native, reply, action, command.requestId);
}

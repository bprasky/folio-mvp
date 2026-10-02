import 'server-only';
import { createHash } from 'crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { canPublishFromOrg } from '@/lib/permissions';
import { assertProjectWrite } from '@/lib/authz/access';
import { assertLegacyInterviewAllowed } from '@/lib/spotlight/legacyBoundary';
import { getGuidedSession, runGuidedCommand } from '@/lib/interview/guided/service';
import type { GuidedSession } from '@/lib/interview/guided/types';
import { runSpotlight } from '@/lib/spotlight/service';
import { readExpertise, changeExpertise, publicExpertise, type ExpertiseSnapshot } from '@/lib/publishing-studio/expertise/service';
import { readStory, changeStory, publicStory } from '@/lib/publishing-studio/story-service';
import { bioAnswerVersion, readBioInterview, prepareBioQuestions, saveBioAnswer } from '@/lib/designer-bio/interview-service';
import { orgInterviewVersion, readOrgInterview, saveOrgInterviewAnswer } from '@/lib/org-onboarding/interview-service';
import { ORG_ABOUT_QUESTIONS } from '@/lib/org-onboarding/conversational-interview-questions';
import { collaborationVersion, readCollaborationInterview, prepareCollaborationQuestions, saveCollaborationResponses } from '@/lib/collaboration/interview-service';
import type { LiveAdapterCommand, LiveAdapterSnapshot, LiveAdapterState, LiveQuestion, LiveSource, LiveSourceRef, ProjectGuideStep } from './adapter-types';
export type { LiveAdapterCommand, LiveAdapterSnapshot, LiveAdapterState, LiveQuestion, LiveSource, LiveSourceRef, ProjectGuideStep } from './adapter-types';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const freshState = (): LiveAdapterState => ({ schemaVersion: 1, skipped: [], receipts: {} });
export class LiveAdapterError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}
const fail = (code: string, message: string, status = 409): never => { throw new LiveAdapterError(code, message, status); };

/** Called on start AND every accepted turn; browser identity is never inherited by a machine request. */
export async function authorizeLiveSource(actorId: string, source: LiveSource) {
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { accountStatus: true } });
  if (!actor || actor.accountStatus !== 'APPROVED') fail('FORBIDDEN', 'Approved account access is required.', 403);
  if (!source.id || source.id.length > 200) fail('INVALID_SOURCE', 'Choose an existing interview.', 422);
  switch (source.kind) {
    case 'project_guide': await (await import('./project-guide')).authorizeProjectGuide(actorId, source.id); break;
    case 'project': assertLegacyInterviewAllowed(source.id); await assertProjectWrite(actorId, source.id); break;
    case 'spotlight': await runSpotlight(source.id, actorId, { action: 'resume' }); break;
    case 'expertise': await readExpertise(actorId, source.id); break;
    case 'story': await readStory(actorId, source.id); break;
    case 'designer_bio': if (source.id !== actorId) fail('FORBIDDEN', 'Your bio belongs to your account.', 403); await readBioInterview(actorId); break;
    case 'org_bio': await readOrgInterview(actorId, source.id); break;
    case 'collaboration': await readCollaborationInterview(actorId, source.id, source.round || 1); break;
    default: fail('INVALID_SOURCE', 'This interview type is not supported.', 422);
  }
}

function snapshot(source: LiveSource, version: string, questions: LiveQuestion[], answered: string[], state: LiveAdapterState,
  sourceRefs: LiveSourceRef[] = []): LiveAdapterSnapshot {
  const currentQuestion = questions.find(q => !answered.includes(q.id) && !state.skipped.includes(q.id)) || null;
  return { source, interviewId: `${source.kind}:${source.id}:${source.round || 1}`, version,
    status: state.status || (currentQuestion ? 'active' : 'ready'), currentQuestion, state: { ...state, questions },
    sourceRefs: [{ kind: 'interview', id: source.id, version, publicEligible: false }, ...sourceRefs] };
}

function guidedSnapshot(source: LiveSource, native: GuidedSession, state: LiveAdapterState): LiveAdapterSnapshot {
  const currentQuestion = native.plan.find(q => q.id === native.activeQuestionId);
  return { source, interviewId: native.id, version: String(native.version),
    status: native.status === 'deciding' ? 'needs_review' : native.status,
    currentQuestion: currentQuestion ? { id: currentQuestion.id, text: currentQuestion.text, reaction: currentQuestion.reaction, sourceImageIds: currentQuestion.sourceImageIds, roomId: currentQuestion.roomId } : null,
    sourceRefs: [{ kind: 'project', id: source.id, projectId: source.id, version: native.contextFingerprint, publicEligible: false },
      ...native.turns.filter(t => !t.supersededBy && t.kind !== 'skip').map(t => ({ kind: 'answer' as const, id: t.id, version: hash([t.questionText, t.text]), projectId: source.id, publicEligible: false }))],
    state: { ...state, native }, notice: native.notice || undefined };
}

type SpotlightState = Awaited<ReturnType<typeof runSpotlight>>;
type OrdinaryQuestion = SpotlightState['ordinary'][number] & { text?: string; version?: number };
function spotlightSnapshot(source: LiveSource, native: SpotlightState, state: LiveAdapterState) {
  const questions: LiveQuestion[] = native.questions.filter(q => q.eligible).map(q => {
    const context = q.contextSnapshot && typeof q.contextSnapshot === 'object' && !Array.isArray(q.contextSnapshot) ? q.contextSnapshot : {};
    const images = context.linkedImageIds;
    return { id: q.id, text: q.wording, roomId: native.spotlights.find(s => s.id === q.spotlightId)?.roomId,
      sourceImageIds: Array.isArray(images) ? images.filter((id): id is string => typeof id === 'string') : [] };
  });
  const ordinary = native.ordinary as OrdinaryQuestion[];
  questions.push(...ordinary.map(q => ({ id: q.id, text: q.wording, roomId: q.roomId, sourceImageIds: [] })));
  return snapshot(source, hash([native.questions.map(q => [q.id, q.questionVersion, q.stateVersion, q.currentAnswerNumber, q.selectionVersion, q.eligible]), native.ordinary]),
    questions, [...native.questions.filter(q => q.currentAnswer).map(q => q.id), ...ordinary.filter(q => typeof q.text === 'string' && q.text.trim()).map(q => q.id)], { ...state, native });
}

function expertiseSnapshot(source: LiveSource, native: ExpertiseSnapshot, state: LiveAdapterState) {
  const q = native.session.nextQuestion;
  const result = snapshot(source, String(native.version), q ? [{ id: q.id, text: q.text,
    sourceImageIds: native.opportunity.evidence.filter(e => q.evidenceIds.includes(e.id) && e.assetId).map(e => e.assetId!) }] : [], [], { ...state, native },
    native.opportunity.evidence.map(e => ({ kind: e.assetId ? 'image' : 'answer', id: e.assetId || e.id, version: e.revision, projectId: e.projectId, publicEligible: e.visibility === 'public' })));
  if (!q && native.session.status !== 'ready') { result.status = 'needs_review'; result.notice = 'Your answer is saved. Continue to prepare the next question.'; }
  return result;
}

/** Only call after an explicit start; preparation may call existing question generators. */
export async function prepareLiveInterview(actorId: string, source: LiveSource, requestId: string, priorState?: LiveAdapterState, workspaceStep?: ProjectGuideStep): Promise<LiveAdapterSnapshot> {
  await authorizeLiveSource(actorId, source);
  const state = priorState ? structuredClone(priorState) : freshState();
  if (source.kind === 'project_guide') return (await import('./project-guide')).prepareProjectGuide(actorId, source, requestId, priorState, workspaceStep);
  if (source.kind === 'project') {
    let native = await getGuidedSession(source.id, actorId);
    if (!native && process.env.NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW !== '1') fail('PILOT_DISABLED', 'New guided interviews are not enabled.', 404);
    native = await runGuidedCommand(source.id, actorId, { action: !native ? 'start' : native.status === 'paused' ? 'resume' : 'start', requestId, version: native?.version || 0, sessionId: native?.id });
    return guidedSnapshot(source, native, state);
  }
  if (source.kind === 'spotlight') return spotlightSnapshot(source, await runSpotlight(source.id, actorId, { action: 'schedule' }), state);
  if (source.kind === 'expertise') return expertiseSnapshot(source, await readExpertise(actorId, source.id), state);
  if (source.kind === 'story') {
    const native = await readStory(actorId, source.id);
    return snapshot(source, String(native.revision), native.definition.questions.map(q => ({ id: q.id, text: q.prompt, sourceImageIds: [] })),
      native.answers.filter(a => a.text.trim()).map(a => a.questionId), { ...state, native });
  }
  if (source.kind === 'designer_bio') {
    const native = await readBioInterview(actorId);
    const questions = state.questions || (await prepareBioQuestions(actorId, source.round === 2 ? 'followup' : 'base')).map(q => ({ id: q.id, text: q.question, sourceImageIds: [] }));
    return snapshot(source, bioAnswerVersion(native.answers), questions, native.answers.filter(a => a.answer.trim()).map(a => a.id), { ...state, questions });
  }
  if (source.kind === 'org_bio') {
    const native = await readOrgInterview(actorId, source.id);
    const answers = (native?.conversationalAnswers || {}) as Record<string, string>;
    const questions = state.questions || ORG_ABOUT_QUESTIONS.filter(q => !native?.questionCoverage.some(c => c.questionId === q.id && c.depth === 'FULL')).map(q => {
      const coverage = native?.questionCoverage.find(c => c.questionId === q.id);
      return { id: q.id, text: coverage?.depth === 'PARTIAL' && coverage.extractedAnswer
        ? `You mentioned: "${coverage.extractedAnswer}" — can you go a bit deeper on that?` : q.question, sourceImageIds: [] };
    });
    return snapshot(source, orgInterviewVersion(answers), questions, Object.keys(answers).filter(id => answers[id]?.trim()), { ...state, questions });
  }
  const questions = state.questions || (await prepareCollaborationQuestions(actorId, source.id, source.round || 1)).map(q => ({ id: q.id, text: q.prompt, sourceImageIds: [] }));
  // Round-two/three preparation persists wording. Bind the first answer to that
  // resulting canonical version, not the row read before preparation.
  const native = await readCollaborationInterview(actorId, source.id, source.round || 1);
  return snapshot(source, collaborationVersion(native.data), questions, (native.data.responses || []).map(a => a.questionId), { ...state, questions });
}

/** Exactly one ingestion path; lifecycle persists this returned snapshot beside its stable turn receipt. */
export async function executeLiveCommand(actorId: string, source: LiveSource, previous: LiveAdapterSnapshot, command: LiveAdapterCommand): Promise<LiveAdapterSnapshot> {
  await authorizeLiveSource(actorId, source);
  if (JSON.stringify(source) !== JSON.stringify(previous.source)) fail('SOURCE_MISMATCH', 'This turn belongs to another interview.');
  const state = structuredClone(previous.state);
  const digest = hash(command);
  if (state.receipts[command.requestId]) {
    if (state.receipts[command.requestId] !== digest) fail('RECEIPT_REUSED', 'This turn was already used for different speech.');
    return previous;
  }
  const evidence = ['answer', 'correct', 'reuse'].includes(command.action);
  if (evidence && (!command.text?.trim() && command.action !== 'reuse')) fail('EMPTY_ANSWER', 'Speak an answer or use an interview control.', 422);
  if (['answer', 'skip', 'reuse'].includes(command.action) && (!previous.currentQuestion || command.questionId !== previous.currentQuestion.id))
    fail('QUESTION_CHANGED', 'The question changed. Review your preserved transcription before saving.');
  if (source.kind === 'project_guide') {
    const result = await (await import('./project-guide')).executeProjectGuide(actorId, source, previous, command);
    if (!source.id.startsWith('new:')) revalidatePath(`/project/${source.id}`);
    return result;
  }
  if (command.action === 'guide') throw new LiveAdapterError('GUIDE_UNAVAILABLE', 'This interview does not support project guidance.', 400);
  if (source.kind === 'project') {
    const native = previous.state.native as GuidedSession;
    const result = await runGuidedCommand(source.id, actorId, { action: command.action === 'reuse' ? 'confirm' : command.action,
      requestId: command.requestId, version: Number(previous.version), sessionId: native.id,
      questionId: command.questionId, text: command.text, inputModality: command.inputModality || 'voice', confirmPartial: command.confirmPartial,
      selectedImageId: command.selectedImageId });
    state.receipts[command.requestId] = digest;
    revalidatePath(`/project/${source.id}`); revalidatePath('/designer/projects');
    return guidedSnapshot(source, result, state);
  }
  // Lifecycle controls do not fabricate evidence or claim canonical editorial completion.
  if (command.action === 'pause' || command.action === 'finish') {
    if (command.action === 'finish' && previous.currentQuestion && !command.confirmPartial) fail('PARTIAL_CONFIRMATION_REQUIRED', 'Confirm finishing with unanswered questions.');
    state.status = command.action === 'pause' ? 'paused' : 'finished';
    state.receipts[command.requestId] = digest;
    return { ...previous, status: state.status, state };
  }
  delete state.status;
  if (command.action === 'reuse') fail('REUSE_REQUIRES_REVIEW', 'Use the existing text workspace to select and confirm the exact saved answer.', 422);
  if (source.kind === 'expertise') {
    const result = await changeExpertise(actorId, source.id, { action: ['resume', 'retry'].includes(command.action) ? 'continue' : command.action,
      expectedVersion: Number(previous.version), text: command.text, requestId: command.requestId });
    state.receipts[command.requestId] = digest;
    revalidatePath('/designer/studio');
    return expertiseSnapshot(source, result, state);
  }
  if (command.action === 'skip') state.skipped = Array.from(new Set([...state.skipped, command.questionId!]));
  else if (evidence) {
    const question = command.action === 'correct'
      ? state.questions?.find(q => q.id === command.questionId) || previous.currentQuestion
      : previous.currentQuestion;
    if (!question || question.id !== command.questionId) fail('QUESTION_CHANGED', 'Select the saved question you want to correct.');
    if (source.kind === 'spotlight') {
      const native = previous.state.native as SpotlightState;
      const q = native.questions.find(q => q.id === command.questionId);
      const ordinary = (native.ordinary as OrdinaryQuestion[]).find(q => q.id === command.questionId);
      if (ordinary) {
        const result = await runSpotlight(source.id, actorId, { action: 'ordinary', questionId: ordinary.id,
          text: command.text!, expectedVersion: ordinary.version || 0, requestKey: command.requestId });
        state.receipts[command.requestId] = digest;
        revalidatePath(`/project/${source.id}`);
        return spotlightSnapshot(source, result, state);
      }
      if (!q?.eligible) fail('QUESTION_UNAVAILABLE', 'This Spotlight question is no longer eligible.');
      const result = await runSpotlight(source.id, actorId, { action: 'accept', questionId: q!.id, questionVersion: q!.questionVersion,
        currentAnswerNumber: q!.currentAnswerNumber, stateVersion: q!.stateVersion, selectionVersion: q!.selectionVersion,
        text: command.text!, requestKey: command.requestId, inputModality: 'VOICE' });
      state.receipts[command.requestId] = digest;
      revalidatePath(`/project/${source.id}`);
      return spotlightSnapshot(source, result, state);
    }
    if (source.kind === 'story') {
      const native = previous.state.native as Awaited<ReturnType<typeof readStory>>;
      const q = native.definition.questions.find(q => q.id === command.questionId);
      if (!q) fail('QUESTION_CHANGED', 'This question is no longer in the interview.');
      const current = await readStory(actorId, source.id);
      // Retry after a lost receipt acknowledges this exact answer without moving it to another question.
      if (String(current.revision) !== previous.version && !current.answers.some(a => a.questionId === command.questionId && a.text === command.text)) fail('STALE_VERSION', 'This interview changed. Review your saved text.');
      if (String(current.revision) === previous.version) await changeStory(actorId, source.id, { action: 'save', revision: Number(previous.version), reviewed: false,
        answers: [...native.answers.filter(a => a.questionId !== command.questionId), { questionId: command.questionId!, text: command.text! }] });
      revalidatePath('/designer/studio');
    } else if (source.kind === 'designer_bio') {
      await saveBioAnswer(actorId, { id: question!.id, question: question!.text, answer: command.text!, round: source.round === 2 ? 'followup' : 'base' }, previous.version);
      revalidatePath('/designer/studio/about-me');
    } else if (source.kind === 'org_bio') {
      await saveOrgInterviewAnswer(actorId, source.id, question!.id, command.text!, previous.version);
      revalidatePath(`/org/${source.id}/settings/about-interview`);
    } else if (source.kind === 'collaboration') {
      const current = await readCollaborationInterview(actorId, source.id, source.round || 1);
      await saveCollaborationResponses(actorId, source.id, source.round || 1,
        [...(current.data.responses || []).filter(a => a.questionId !== command.questionId), { questionId: command.questionId!, answer: command.text! }], previous.version);
      revalidatePath(`/collaboration/stories/${source.id}`);
    }
  }
  state.receipts[command.requestId] = digest;
  return prepareLiveInterview(actorId, source, command.requestId, state);
}

/** Delivery rechecks the actual public source. A recording consent is never a publication grant. */
export async function resolveMediaSource(actorId: string, input: { sourceType: string; sourceId: string; canonicalId?: string }, purpose: 'preview' | 'export') {
  const source = { kind: input.sourceType, id: input.sourceId } as LiveSource;
  if (source.kind === 'project_guide' && source.id.startsWith('new:')) fail('GUIDE_MEDIA_UNAVAILABLE', 'Choose an existing project before recording media.', 403);
  await authorizeLiveSource(actorId, source);
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { name: true } });
  let version = ''; let recordingScopeVersion = hash([source.kind, source.id]); let destination: string | null = null;
  let images: Array<{ id: string; url: string; credit?: string }> = [];
  if (source.kind === 'project' || source.kind === 'project_guide' || source.kind === 'spotlight') {
    const project = await prisma.project.findUnique({ where: { id: source.id }, select: { isPublic: true, status: true, designerOrgId: true,
      post: { select: { id: true, slug: true, status: true, publishedAt: true, expandedBlocks: true, provenance: true, credits: true } },
      images: { where: { inclusion: 'INCLUDED' }, select: { id: true, url: true, roomId: true }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] } } });
    if (!project) fail('SOURCE_UNAVAILABLE', 'This project is unavailable.', 404);
    if (project!.isPublic && project!.status !== 'archived' && project!.post?.status === 'PUBLISHED' && project!.post.publishedAt) destination = `/project/${source.id}`;
    if (destination && project!.designerOrgId && !(await canPublishFromOrg(actorId, project!.designerOrgId)).ok) destination = null;
    images = project!.images;
    const spotlight = source.kind === 'spotlight' ? await runSpotlight(source.id, actorId, { action: 'resume' }) : null;
    // Only a separately approved exact media piece can use this destination; the
    // private interview/revisions themselves are never exposed or published here.
    if (spotlight && (!spotlight.questions.some(q => q.eligible && q.currentAnswer) || spotlight.spotlights.some(s => s.needsResolution))) destination = null;
    version = hash([project!.post, images, spotlight]);
    recordingScopeVersion = hash([source.kind, source.id, images, spotlight?.spotlights.map(s => [s.id, s.isSelected, s.selectionVersion, s.eligible, s.roomId]), spotlight?.tags]);
  } else if (source.kind === 'expertise') {
    const saved = await readExpertise(actorId, source.id);
    const row = await prisma.editorialStory.findUnique({ where: { id: source.id }, select: { slug: true } });
    const published = row && await publicExpertise(row.slug);
    if (published && saved.status === 'published') destination = `/expertise/${row!.slug}`;
    images = (purpose === 'export' ? published?.article.media || [] : saved.article?.media || saved.opportunity.evidence.filter(e => e.assetId && e.imageUrl).map(e => ({ assetId: e.assetId!, url: e.imageUrl!, photographer: e.photographer })))
      .map(image => ({ id: image.assetId, url: image.url, credit: image.photographer }));
    version = hash([saved.version, saved.revisionNumber, saved.session, saved.opportunity.evidence, saved.article]);
    recordingScopeVersion = hash([source.kind, source.id, saved.opportunity.evidence]);
  } else if (source.kind === 'story') {
    const saved = await readStory(actorId, source.id);
    const row = await prisma.editorialStory.findUnique({ where: { id: source.id }, select: { slug: true } });
    if (row && saved.status === 'published' && saved.publishedUrl && await publicStory(row.slug)) destination = saved.publishedUrl;
    if (saved.projectImageUrl) images = [{ id: `story-cover:${source.id}`, url: saved.projectImageUrl }];
    version = hash([saved.revision, saved.answers, saved.draft, saved.definition, images]);
    recordingScopeVersion = hash([source.kind, source.id, saved.definition, images]);
  } else if (source.kind === 'designer_bio') {
    const { bio, answers } = await readBioInterview(actorId);
    if (bio?.status === 'published' && bio.folioBio?.trim()) destination = `/profile/${actorId}?tab=about`;
    if (bio?.primaryPhotoUrl) images = [{ id: `portrait:${actorId}`, url: bio.primaryPhotoUrl }];
    version = hash([answers, bio?.folioBio, images]);
    recordingScopeVersion = hash([source.kind, source.id, images]);
  } else if (source.kind === 'org_bio') {
    const interview = await readOrgInterview(actorId, source.id);
    const org = await prisma.organization.findUnique({ where: { id: source.id }, select: { description: true, logo: true } });
    if (interview?.generatedAt && org?.description?.trim() && (await canPublishFromOrg(actorId, source.id)).ok) destination = `/org/${source.id}?tab=about`;
    if (org?.logo) images = [{ id: `organization-logo:${source.id}`, url: org.logo }];
    // The exact media-plan approval is a new piece's publication permission,
    // not permission to expose every raw organization interview answer.
    version = hash([interview?.conversationalAnswers, interview?.fullBio, interview?.generatedAt, org]);
    recordingScopeVersion = hash([source.kind, source.id, images]);
  } else {
    const { story, role } = await readCollaborationInterview(actorId, source.id, 1);
    // Actor-owned recordings contain this participant's perspective only. Shared
    // finalContent/hero images and the joint magazine destination require the
    // existing two-party publication flow; none is imported into this source.
    let publicIdentity: unknown = null;
    if (role === 'designer') {
      if (story.taggedProjectId) {
        let authorized = false;
        try { await assertProjectWrite(actorId, story.taggedProjectId); authorized = true; }
        catch (error) { if (!(error instanceof Error) || !['Forbidden', 'NotFound'].includes(error.message)) throw error; }
        const project = authorized ? await prisma.project.findUnique({ where: { id: story.taggedProjectId }, select: {
          isPublic: true, status: true, designerOrgId: true,
          post: { select: { status: true, publishedAt: true } },
          images: { where: { inclusion: 'INCLUDED' }, select: { id: true, url: true }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] },
        } }) : null;
        if (project?.isPublic && project.status !== 'archived' && project.post?.status === 'PUBLISHED' && project.post.publishedAt
          && (!project.designerOrgId || (await canPublishFromOrg(actorId, project.designerOrgId)).ok)) {
          destination = `/project/${story.taggedProjectId}`;
          images = project.images;
          publicIdentity = [story.taggedProjectId, project.designerOrgId, project.post];
        }
      }
      if (!destination) {
        const { bio } = await readBioInterview(actorId);
        if (bio?.status === 'published' && bio.folioBio?.trim()) destination = `/profile/${actorId}?tab=about`;
        if (bio?.primaryPhotoUrl) images = [{ id: `portrait:${actorId}`, url: bio.primaryPhotoUrl }];
        publicIdentity = [actorId, bio?.status, bio?.folioBio];
      }
    } else {
      const org = await prisma.organization.findUnique({ where: { id: story.vendorOrgId }, select: { name: true, description: true, logo: true } });
      if (org?.description?.trim() && (await canPublishFromOrg(actorId, story.vendorOrgId)).ok) destination = `/org/${story.vendorOrgId}?tab=about`;
      if (org?.logo) images = [{ id: `organization-logo:${story.vendorOrgId}`, url: org.logo }];
      publicIdentity = [story.vendorOrgId, org];
    }
    const ownRounds = role === 'designer' ? [story.designerRound1, story.designerRound2, story.designerRound3] : [story.vendorRound1, story.vendorRound2, story.vendorRound3];
    const identity = [source.kind, source.id, actorId, role, story.vendorOrgId, story.designerUserId, destination];
    version = hash([identity, ownRounds, publicIdentity, images]);
    recordingScopeVersion = hash([identity, images]);
  }
  if (purpose === 'export' && !destination) fail('PUBLIC_SOURCE_REQUIRED', 'Publish and review an eligible source before exporting this media.', 403);
  return { version, recordingScopeVersion, destination, images, speakerName: actor?.name || 'Creator' };
}

import { createHash, randomUUID } from 'crypto';
import { InterviewAnswerSchema, type InterviewAnswer } from '@/lib/posting/interviewSchemas';
import { isArrivalSafe } from '@/lib/interview/prompts/validateQuestion';
import { GUIDED_ANSWER_LIMIT, PROJECT_CATEGORIES, type GuidedCommand, type GuidedNextProposal, type GuidedPreparation, type GuidedQuestion, type GuidedSession, type GuidedTurn } from './types';

export class GuidedConflict extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}

export function commandDigest(command: GuidedCommand) {
  return createHash('sha256').update(JSON.stringify({
    action: command.action, version: command.version, questionId: command.questionId ?? null,
    text: command.text ?? null, inputModality: command.inputModality ?? 'text',
    selectedImageId: command.selectedImageId ?? null, recordingId: command.recordingId ?? null,
    roomId: command.roomId ?? null, roomSpecified: command.roomId !== undefined,
    confirmPartial: command.confirmPartial ?? false,
  })).digest('hex');
}

export function isRequestReplay(session: GuidedSession, command: GuidedCommand) {
  if (!session.requestIds.includes(command.requestId)) return false;
  if (session.requestDigests?.[command.requestId] !== commandDigest(command))
    throw new GuidedConflict('REQUEST_ID_REUSED', 'This request ID already saved different content. Reload the interview and send your preserved text as a new request.');
  return true;
}

export function currentQuestion(session: GuidedSession) {
  return session.plan.find(q => q.id === session.activeQuestionId);
}

export function acceptedTurns(session: GuidedSession) {
  return session.turns.filter(t => t.kind !== 'skip' && !t.supersededBy && session.plan.some(q => q.id === t.questionId && q.status === 'answered'));
}

export function validatePlan(questions: GuidedQuestion[], session: Pick<GuidedSession, 'rooms' | 'turns'>) {
  const ids = new Set<string>();
  for (const q of questions) {
    if (!q.id || ids.has(q.id) || !q.text?.trim() || q.text.length > 600 || !isArrivalSafe(q.text))
      throw new GuidedConflict('INVALID_PLAN', 'The prepared questions need to be retried.', 422);
    ids.add(q.id);
    const room = q.roomId === null ? null : session.rooms.find(r => r.id === q.roomId);
    if (q.roomId !== null && !room) throw new GuidedConflict('INVALID_ROOM', 'A question belongs to an unavailable room.', 422);
    if (q.sourceImageIds.some(id => !(room ? room.imageIds : session.rooms.flatMap(r => r.imageIds)).includes(id)))
      throw new GuidedConflict('INVALID_SOURCE', 'A question references an unavailable photograph.', 422);
    if (q.sourceAnswerIds.some(id => !session.turns.some(t => t.id === id && t.kind !== 'skip' && !t.supersededBy)))
      throw new GuidedConflict('INVALID_ANSWER_SOURCE', 'A question references an unavailable answer.', 422);
  }
}

export function createGuidedSession(projectId: string, preparation: GuidedPreparation, requestId: string, startCommand?: GuidedCommand): GuidedSession {
  const now = new Date().toISOString();
  validatePlan(preparation.questions, { rooms: preparation.rooms, turns: [] });
  for (const category of PROJECT_CATEGORIES) {
    if (!preparation.questions.some(q => q.category === category && q.roomId === null && q.kind === 'prepared'))
      throw new GuidedConflict('INCOMPLETE_PLAN', 'The prepared project questions are incomplete.', 422);
  }
  const session: GuidedSession = {
    id: randomUUID(), schemaVersion: 1, projectId, version: 1, status: 'active', phase: 'project',
    plan: preparation.questions.map(q => ({ ...q, status: 'pending' })), rooms: preparation.rooms,
    turns: [], activeQuestionId: null, roomsPrepared: false, contextFingerprint: preparation.contextFingerprint,
    minimumTotalAnswers: preparation.minimumTotalAnswers, pendingDecisionTurnId: null,
    requestIds: [requestId], requestDigests: { [requestId]: commandDigest(startCommand ?? { action: 'start', requestId, version: 0 }) }, notice: null, createdAt: now, updatedAt: now,
  };
  activateNext(session);
  return session;
}

function activateNext(session: GuidedSession) {
  const next = session.plan.find(q => q.status === 'pending' && (session.roomsPrepared || q.roomId === null));
  session.activeQuestionId = next?.id ?? null;
  if (next) { next.status = 'active'; session.phase = next.roomId ? 'rooms' : 'project'; session.status = 'active'; }
  else if (session.roomsPrepared) { session.phase = 'review'; session.status = 'ready'; }
  else { session.status = 'deciding'; }
}

export function projectPhaseComplete(session: GuidedSession) {
  return session.plan.filter(q => q.roomId === null).every(q => ['answered', 'skipped', 'invalidated'].includes(q.status));
}

export function appendRoomPlan(session: GuidedSession, questions: GuidedQuestion[]) {
  validatePlan(questions, session);
  const existingIds = new Set(session.plan.map(q => q.id));
  if (questions.some(q => existingIds.has(q.id) || q.roomId === null || q.kind !== 'prepared'))
    throw new GuidedConflict('INVALID_ROOM_PLAN', 'The room question plan could not be prepared.', 422);
  for (const room of session.rooms) {
    if (questions.filter(q => q.roomId === room.id).length < room.baseQuestions)
      throw new GuidedConflict('INCOMPLETE_ROOM_PLAN', `The questions for ${room.name} are incomplete.`, 422);
  }
  session.plan.push(...questions.map(q => ({ ...q, status: 'pending' as const })));
  session.roomsPrepared = true;
  session.pendingDecisionTurnId = null;
  activateNext(session);
}

export function followUpAllowed(session: GuidedSession, parent: GuidedQuestion) {
  if (parent.kind !== 'prepared' || session.plan.some(q => q.parentQuestionId === parent.id)) return false;
  const allowance = parent.roomId ? session.rooms.find(r => r.id === parent.roomId)?.maxFollowUps ?? 0 : 2;
  return session.plan.filter(q => q.roomId === parent.roomId && q.kind !== 'prepared').length < allowance;
}

/** Only validated adapter text is accepted; the model cannot move the cursor or declare coverage. */
export function applyDecision(session: GuidedSession, proposal: GuidedNextProposal) {
  const turn = session.turns.find(t => t.id === session.pendingDecisionTurnId);
  const parent = turn && session.plan.find(q => q.id === turn.questionId);
  if (proposal.kind !== 'advance' && turn && parent && !turn.supersededBy && followUpAllowed(session, parent)) {
    if (!proposal.purpose?.trim() || proposal.purpose.length > 300 || !proposal.sourceAnswerIds.includes(turn.id))
      throw new GuidedConflict('INVALID_FOLLOWUP', 'The follow-up needs to be retried.', 422);
    const followup: GuidedQuestion = {
      id: randomUUID(), text: proposal.text, category: parent.category, roomId: parent.roomId,
      sourceImageIds: [...parent.sourceImageIds], sourceAnswerIds: proposal.sourceAnswerIds,
      status: 'active', kind: proposal.kind, parentQuestionId: parent.id, parentAnswerId: turn.id, purpose: proposal.purpose,
    };
    validatePlan([followup], session);
    // Put the follow-up immediately after its parent without changing any prepared obligation.
    session.plan.splice(session.plan.indexOf(parent) + 1, 0, followup);
    session.activeQuestionId = followup.id;
    session.status = 'active';
    session.pendingDecisionTurnId = null;
    return;
  }
  session.pendingDecisionTurnId = null;
  activateNext(session);
}

export function roomProgress(session: GuidedSession) {
  return Object.fromEntries(session.rooms.map(room => {
    const questions = session.plan.filter(q => q.roomId === room.id && q.status !== 'invalidated');
    const answeredCount = questions.filter(q => q.status === 'answered').length;
    const pending = questions.some(q => q.status === 'active' || q.status === 'pending');
    return [room.id, {
      status: !questions.length ? 'not_started' : pending ? (answeredCount ? 'in_progress' : 'not_started') : answeredCount ? 'complete' : 'skipped',
      answeredCount, totalQuestions: questions.length, baseQuestions: room.baseQuestions,
    }];
  }));
}

export function completionState(session: GuidedSession) {
  const answers = acceptedTurns(session);
  const complete = session.roomsPrepared && !session.plan.some(q => q.status === 'active' || q.status === 'pending') &&
    answers.length >= session.minimumTotalAnswers && answers.some(t => session.plan.find(q => q.id === t.questionId)?.kind === 'prepared');
  // The existing modal explicitly permits generation with partial material after confirmation.
  return { complete, canFinishPartial: answers.some(t => session.plan.find(q => q.id === t.questionId)?.kind === 'prepared') };
}

/** Accepts evidence only. The service commits this before making any model request. */
export function acceptCommand(original: GuidedSession, command: GuidedCommand): GuidedSession {
  if (isRequestReplay(original, command)) return original;
  if (command.version !== original.version) throw new GuidedConflict('STALE_VERSION', 'This interview changed in another tab. Your text is still here; reload the saved interview.');
  const session = structuredClone(original);
  session.notice = null;
  const q = currentQuestion(session);
  if (command.action === 'section') {
    if (command.roomId === undefined || !['active', 'ready'].includes(session.status) || (command.roomId !== null && !session.roomsPrepared))
      throw new GuidedConflict('SECTION_UNAVAILABLE', 'Finish preparing the current section before changing sections.');
    const target = session.plan.find(p => p.roomId === command.roomId && ['pending', 'active'].includes(p.status));
    if (!target) throw new GuidedConflict('SECTION_UNAVAILABLE', 'That section has no remaining prepared questions.');
    if (q?.status === 'active') q.status = 'pending';
    target.status = 'active';
    session.activeQuestionId = target.id;
    session.phase = target.roomId === null ? 'project' : 'rooms';
    session.status = 'active';
    session.pendingDecisionTurnId = null;
  } else if (command.action === 'skip_room') {
    if (!q?.roomId || session.status !== 'active' || (command.roomId !== undefined && command.roomId !== q.roomId))
      throw new GuidedConflict('ROOM_UNAVAILABLE', 'Open a room question before skipping that room.');
    for (const pending of session.plan.filter(p => p.roomId === q.roomId && ['pending', 'active'].includes(p.status))) {
      session.turns.push({ id: randomUUID(), requestId: command.requestId, questionId: pending.id,
        questionText: pending.text, text: '', roomId: pending.roomId, sourceImageIds: [...pending.sourceImageIds],
        selectedImageId: null, inputModality: 'text', kind: 'skip', createdAt: new Date().toISOString() });
      pending.status = 'skipped';
    }
    session.activeQuestionId = null;
    session.pendingDecisionTurnId = null;
    activateNext(session);
  } else if (command.action === 'pause') { session.status = 'paused'; }
  else if (command.action === 'resume') {
    session.status = session.pendingDecisionTurnId || (!session.activeQuestionId && !session.roomsPrepared) ? 'deciding' : session.activeQuestionId ? 'active' : 'ready';
  } else if (command.action === 'retry') {
    if (session.status === 'paused') throw new GuidedConflict('PAUSED', 'Resume the interview before continuing.');
  } else if (command.action === 'finish') {
    const completion = completionState(session);
    if (!completion.complete && (!command.confirmPartial || !completion.canFinishPartial))
      throw new GuidedConflict('PARTIAL_CONFIRMATION_REQUIRED', 'Answer at least one prepared question and confirm the shorter coverage before finishing.', 422);
    session.status = 'finished';
    session.notice = completion.complete ? null : 'Some questions remain unanswered. Your draft will have shorter coverage; you can resume to add more.';
  } else if (command.action === 'answer' || command.action === 'skip' || command.action === 'correct') {
    const correction = command.action === 'correct';
    const target = correction ? session.plan.find(p => p.id === command.questionId && p.status === 'answered') : q;
    if (!target || target.id !== command.questionId || (!correction && session.status !== 'active'))
      throw new GuidedConflict('STALE_QUESTION', 'The active question has changed. Your answer has not been discarded.');
    const allowedImageIds = target.roomId === null
      ? session.rooms.flatMap(room => room.imageIds)
      : session.rooms.find(room => room.id === target.roomId)?.imageIds ?? [];
    if (command.selectedImageId && !allowedImageIds.includes(command.selectedImageId))
      throw new GuidedConflict('IMAGE_SCOPE', 'Choose a photograph from the question’s room, or send without attaching a photograph.', 422);
    const isSkip = command.action === 'skip';
    const text = command.text ?? '';
    if (!isSkip && (!text.trim() || text.length > GUIDED_ANSWER_LIMIT))
      throw new GuidedConflict('ANSWER_LENGTH', `Answers must contain 1–${GUIDED_ANSWER_LIMIT} characters. Your full text is preserved in the composer.`, 422);
    const prior = correction ? [...session.turns].reverse().find(t => t.questionId === target.id && !t.supersededBy && t.kind !== 'skip') : undefined;
    const turn: GuidedTurn = {
      id: randomUUID(), requestId: command.requestId, questionId: target.id, questionText: target.text,
      text, roomId: target.roomId, sourceImageIds: [...target.sourceImageIds],
      selectedImageId: command.selectedImageId ?? null, inputModality: command.inputModality ?? 'text',
      kind: isSkip ? 'skip' : correction ? 'correction' : 'answer', createdAt: new Date().toISOString(),
      ...(prior ? { supersedes: prior.id } : {}),
      ...(command.recordingId ? { recordingId: command.recordingId } : {}),
    };
    if (prior) {
      prior.supersededBy = turn.id;
      // Follow-up evidence tied to the replaced premise is retained in history,
      // but cannot remain accepted without designer confirmation.
      for (const dependent of session.plan.filter(p => p.kind !== 'prepared' && (p.parentAnswerId === prior.id || p.sourceAnswerIds.includes(prior.id)))) {
        dependent.status = 'invalidated'; dependent.invalidationReason = 'The parent answer was corrected.';
      }
      // Prepared wording is constrained to room/project-level questions without
      // factual premises. Keep that actual wording and replace its accepted
      // context references; adaptive questions using the old premise are above.
      for (const pending of session.plan.filter(p => ['pending', 'active'].includes(p.status) && p.sourceAnswerIds.includes(prior.id))) {
        pending.wordingHistory = [...(pending.wordingHistory ?? []), { text: pending.text, correctedAnswerId: prior.id }];
        pending.sourceAnswerIds = pending.sourceAnswerIds.map(id => id === prior.id ? turn.id : id);
      }
    }
    session.turns.push(turn);
    target.status = isSkip ? 'skipped' : 'answered';
    if (correction) {
      if (q?.status === 'invalidated') { session.activeQuestionId = null; activateNext(session); }
      session.notice = 'Your correction is saved. The original exchange remains in the interview history.';
    } else {
      session.activeQuestionId = null;
      session.pendingDecisionTurnId = isSkip ? null : turn.id;
      session.status = 'deciding';
      if (isSkip) activateNext(session);
    }
  }
  session.requestIds.push(command.requestId);
  session.requestDigests = { ...session.requestDigests, [command.requestId]: commandDigest(command) };
  session.version++;
  session.updatedAt = new Date().toISOString();
  return session;
}

export function canonicalGuidedAnswers(session: GuidedSession): InterviewAnswer[] {
  return acceptedTurns(session).map(turn => {
    const q = session.plan.find(p => p.id === turn.questionId)!;
    const sections: Record<string, 'why' | 'what' | 'how'> = { CLIENT_BRIEF: 'why', SCOPE_PARAMETERS: 'what', DESIGN_DIRECTION: 'how', SIGNATURE_IDENTITY: 'what', SURPRISE_PIVOT: 'how' };
    return InterviewAnswerSchema.parse({
      questionId: q.id, prompt: turn.questionText, answer: turn.text, section: sections[q.category] ?? 'what',
      role: 'DESIGNER', roomId: q.roomId, inputModality: turn.inputModality,
      isFollowUp: q.kind !== 'prepared', questionSource: q.kind === 'prepared' ? 'base_question' : 'follow_up',
      linkedImageId: turn.selectedImageId,
      linkedProductId: null, parentQuestionId: q.parentQuestionId ?? null,
    });
  });
}

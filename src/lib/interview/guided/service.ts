import { assertProjectWrite } from '@/lib/authz/access';
import { assertLegacyInterviewAllowed } from '@/lib/spotlight/legacyBoundary';
import { acceptCommand, appendRoomPlan, applyDecision, createGuidedSession, followUpAllowed, GuidedConflict, isRequestReplay, projectPhaseComplete } from './controller';
import { guidedTurnWantsToMoveOn, proposeGuidedNext } from './decision';
import { adaptGuidedRoomQuestions, prepareGuidedProjectPlan, prepareGuidedRoomPlan, readGuidedContext } from './preparation';
import { commitGuidedSession, ensureGuidedPost, loadGuidedPost, savedGuidedSession } from './store';
import type { GuidedCommand, GuidedSession } from './types';

/** Source changes never silently reuse pending wording or move an answer's room. */
async function refreshContext(session: GuidedSession, actorId: string) {
  const context = await readGuidedContext(session.projectId);
  if (context.contextFingerprint === session.contextFingerprint) return null;
  const next = structuredClone(session);
  for (const q of next.plan.filter(q => ['pending', 'active'].includes(q.status))) {
    q.preparationHistory = [...(q.preparationHistory ?? []), { text: q.text, sourceImageIds: [...q.sourceImageIds], sourceAnswerIds: [...q.sourceAnswerIds], reason: 'Project sources or room assignments changed.' }];
    const room = context.rooms.find(room => room.id === q.roomId);
    if (q.roomId && (!room || q.kind !== 'prepared')) {
      q.status = 'invalidated'; q.invalidationReason = 'The question’s room or source context changed.';
    } else if (room) {
      // Safe room wording is revalidated against current persisted room IDs.
      const slot = next.plan.filter(p => p.roomId === room.id && p.kind === 'prepared' && p.status !== 'invalidated').findIndex(p => p.id === q.id);
      const refreshed = adaptGuidedRoomQuestions([], room)[Math.max(0, slot) % room.baseQuestions];
      Object.assign(q, { text: refreshed.text, sourceImageIds: refreshed.sourceImageIds, sourceAnswerIds: refreshed.sourceAnswerIds });
    } else {
      q.sourceImageIds = context.images.filter(image => image.roomId).slice(0, 3).map(image => image.id);
      q.text = q.baselineText ?? q.text;
    }
    delete q.reaction;
    delete q.adaptation;
    delete q.confirmation;
    delete q.baselineText;
  }
  next.rooms = context.rooms;
  if (next.roomsPrepared) {
    for (const room of next.rooms) {
      const existing = next.plan.filter(q => q.roomId === room.id && q.kind === 'prepared' && q.status !== 'invalidated');
      const missing = Math.max(0, room.baseQuestions - existing.length);
      if (missing) next.plan.push(...adaptGuidedRoomQuestions([], room).slice(0, missing));
    }
  }
  next.contextFingerprint = context.contextFingerprint;
  next.minimumTotalAnswers = Math.max(8, next.rooms.length * 3);
  next.pendingDecisionTurnId = null;
  if (!next.plan.some(q => q.id === next.activeQuestionId && q.status === 'active')) {
    next.activeQuestionId = null;
    applyDecision(next, { kind: 'advance' });
  }
  if (session.status === 'paused' || session.status === 'finished') next.status = session.status;
  next.notice = 'Project sources changed. Pending questions now use the current rooms and photographs. Review the question before sending your preserved text.';
  next.version++;
  next.updatedAt = new Date().toISOString();
  return commitGuidedSession(next.projectId, actorId, session.version, next);
}

export async function getGuidedSession(projectId: string, actorId: string) {
  assertLegacyInterviewAllowed(projectId);
  await assertProjectWrite(actorId, projectId);
  return savedGuidedSession((await loadGuidedPost(projectId))?.provenance);
}

async function finishDecision(session: GuidedSession, actorId: string): Promise<GuidedSession> {
  if (session.status !== 'deciding') return session;
  const next = structuredClone(session);
  try {
    const turn = next.turns.find(t => t.id === next.pendingDecisionTurnId && !t.supersededBy);
    const parent = turn && next.plan.find(q => q.id === turn.questionId);
    const prepareRooms = async () => {
      const roomQuestions = await prepareGuidedRoomPlan(next.projectId, next);
      appendRoomPlan(next, roomQuestions);
      if (turn) {
        const first = next.plan.find(q => q.id === next.activeQuestionId);
        if (first) first.status = 'pending';
        next.activeQuestionId = null;
        next.pendingDecisionTurnId = turn.id;
        next.status = 'deciding';
      }
    };
    // Once optional project follow-ups are exhausted, the next reply can move
    // naturally into the first room using the complete accepted conversation.
    if (!next.roomsPrepared && projectPhaseComplete(next) && (!parent || !followUpAllowed(next, parent)))
      await prepareRooms();
    const proposal = turn && parent
      ? await proposeGuidedNext(next, parent, turn)
      : { kind: 'advance' as const };
    applyDecision(next, proposal);
    if (!next.roomsPrepared && projectPhaseComplete(next) && !next.activeQuestionId) {
      await prepareRooms();
      if (turn && parent) applyDecision(next, await proposeGuidedNext(next, parent, turn));
    }
    const changedContext = await refreshContext(session, actorId);
    if (changedContext) return changedContext;
    next.version++;
    next.updatedAt = new Date().toISOString();
    return await commitGuidedSession(next.projectId, actorId, session.version, next);
  } catch (error) {
    // An accepted answer was already committed before this function. A late
    // model response never wins over a newer pause, correction or decision.
    const saved = await getGuidedSession(session.projectId, actorId);
    if (!saved) throw error;
    if (saved.version !== session.version) return saved;
    const failed = structuredClone(saved);
    failed.notice = 'Your answer is saved. The next question could not be prepared. Retry to continue.';
    failed.version++;
    failed.updatedAt = new Date().toISOString();
    try { return await commitGuidedSession(session.projectId, actorId, saved.version, failed); }
    catch { return (await getGuidedSession(session.projectId, actorId)) ?? saved; }
  }
}

export async function runGuidedCommand(projectId: string, actorId: string, command: GuidedCommand): Promise<GuidedSession> {
  assertLegacyInterviewAllowed(projectId);
  await assertProjectWrite(actorId, projectId);
  let current = await getGuidedSession(projectId, actorId);
  if (current && command.sessionId && command.sessionId !== current.id)
    throw new GuidedConflict('STALE_SESSION', 'This interview was started over in another tab. Reload to continue with the new interview.');
  if (!current) {
    if (command.action !== 'start') throw new GuidedConflict('NOT_STARTED', 'Open the guided interview to prepare its questions.', 422);
    await ensureGuidedPost(projectId, actorId);
    // Legacy evidence remains in canonical provenance; never silently count it
    // as answers to a newly prepared question without explicit confirmation.
    const preparation = await prepareGuidedProjectPlan(projectId);
    const next = createGuidedSession(projectId, preparation, command.requestId, command);
    try { return await commitGuidedSession(projectId, actorId, null, next); }
    catch (error) {
      if (error instanceof GuidedConflict && error.code === 'STALE_VERSION') {
        const winner = savedGuidedSession((await loadGuidedPost(projectId))?.provenance);
        if (winner) return winner;
      }
      throw error;
    }
  }
  // Normalize conversational controls before hashing, including exact retries.
  if (command.action === 'answer' && guidedTurnWantsToMoveOn(command.text ?? ''))
    command = { ...command, action: /\b(?:pause|stop)\b/i.test(command.text ?? '') ? 'pause' : 'skip' };
  const replay = isRequestReplay(current, command);
  const refreshed = await refreshContext(current, actorId);
  if (refreshed) return refreshed;
  if (command.action === 'start') return current;
  if (!replay) {
    // Exact conversational controls are application intents; their text never
    // becomes fabricated designer evidence or an answer to the active question.
    const accepted = acceptCommand(current, command);
    current = await commitGuidedSession(projectId, actorId, current.version, accepted);
  }
  return finishDecision(current, actorId);
}

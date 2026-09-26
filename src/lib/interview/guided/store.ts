import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { assertLegacyInterviewAllowed } from '@/lib/spotlight/legacyBoundary';
import { makeSlug } from '@/lib/posting/slug';
import { rebuildAnswerProjection, type AnswerAudioMap } from '@/lib/editorial/syncInterviewAnswers';
import { canonicalGuidedAnswers, GuidedConflict, roomProgress } from './controller';
import type { GuidedSession } from './types';

export type ProvenanceObject = Record<string, any>;
export const objectValue = (value: unknown): ProvenanceObject => value && typeof value === 'object' && !Array.isArray(value) ? value as ProvenanceObject : {};

export function savedGuidedSession(provenance: unknown): GuidedSession | null {
  const value = objectValue(provenance).interview?.guided;
  if (!value) return null;
  if (value.schemaVersion !== 1 || !Array.isArray(value.plan) || !Array.isArray(value.turns) || !Number.isInteger(value.version))
    throw new GuidedConflict('SESSION_VERSION', 'This saved interview needs a newer version of Folio.');
  return value as GuidedSession;
}

export async function loadGuidedPost(projectId: string) {
  return prisma.projectPost.findUnique({ where: { projectId }, select: { id: true, provenance: true, updatedAt: true } });
}

/** Every caller is a designer-authorized request; no anonymous or service-role client is used. */
export async function ensureGuidedPost(projectId: string, actorId: string) {
  assertLegacyInterviewAllowed(projectId);
  await assertProjectWrite(actorId, projectId);
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { title: true } });
  if (!project) throw new GuidedConflict('NOT_FOUND', 'Project not found.', 404);
  return prisma.projectPost.upsert({
    where: { projectId }, update: {},
    create: { projectId, slug: makeSlug(project.title || undefined, projectId), status: 'DRAFT' },
    select: { id: true, provenance: true, updatedAt: true },
  });
}

/** CAS is against the entire fresh provenance, then JSON and projection commit together. */
export async function commitGuidedSession(projectId: string, actorId: string, expectedVersion: number | null, next: GuidedSession) {
  assertLegacyInterviewAllowed(projectId);
  await assertProjectWrite(actorId, projectId);
  return prisma.$transaction(async tx => {
    const post = await tx.projectPost.findUnique({ where: { projectId }, select: { id: true, provenance: true, updatedAt: true } });
    if (!post) throw new GuidedConflict('NOT_FOUND', 'The saved project is unavailable.', 404);
    const current = savedGuidedSession(post.provenance);
    if ((current?.version ?? null) !== expectedVersion) throw new GuidedConflict('STALE_VERSION', 'The saved interview changed. Reload to continue.');
    const provenance = objectValue(post.provenance);
    const interview = objectValue(provenance.interview);
    // Resolve the exact immutable clip returned to this tab. Using the latest
    // clip for a question would attach another tab's recording to this text.
    for (const turn of next.turns) {
      if (current?.turns.some(t => t.id === turn.id) || !turn.recordingId) continue;
      const recording = interview.guidedAudio?.[turn.recordingId];
      if (turn.inputModality === 'text' || !recording?.audioUrl || recording.id !== turn.recordingId ||
        recording.projectId !== projectId || recording.questionId !== turn.questionId || typeof recording.transcript !== 'string')
        throw new GuidedConflict('RECORDING_MISMATCH', 'This recording does not belong to the answer. Keep the text and retry its recording attachment.', 422);
      turn.recording = { ...recording, textMatchesTranscript: recording.transcript.trim() === turn.text.trim() };
    }
    const payload = objectValue(interview.payload);
    const guidedIds = new Set(next.plan.map(q => q.id));
    const external = [...(Array.isArray(payload.answers) ? payload.answers : Array.isArray(interview.answers) ? interview.answers : []), ...(Array.isArray(payload.followups) ? payload.followups : [])]
      .filter(a => !guidedIds.has(a?.questionId));
    const answers = [...external, ...canonicalGuidedAnswers(next)];
    const nextPayload = {
      ...payload,
      answers: answers.filter(a => !a.isFollowUp), followups: answers.filter(a => a.isFollowUp),
      selectedQuestionIds: Array.from(new Set([...(payload.selectedQuestionIds ?? []).filter((id: string) => !guidedIds.has(id)), ...next.plan.filter(q => q.status !== 'invalidated').map(q => q.id)])),
    };
    const projectedAudio = { ...objectValue(interview.audio) } as AnswerAudioMap;
    for (const turn of next.turns.filter(t => !t.supersededBy && t.kind !== 'skip')) {
      projectedAudio[turn.questionId] = turn.recording
        ? { audioUrl: turn.recording.audioUrl, words: turn.recording.textMatchesTranscript ? turn.recording.words : [] }
        : null;
    }
    const nextProvenance = { ...provenance, interview: { ...interview, guided: next, payload: nextPayload, answers: nextPayload.answers, audio: projectedAudio } };
    // Optional recording fields can be undefined in memory. Encode the actual
    // JSON document at the boundary so Prisma receives only JSON values.
    const encodedProvenance: Prisma.InputJsonValue = JSON.parse(JSON.stringify(nextProvenance));
    const changed = await tx.projectPost.updateMany({
      where: { id: post.id, updatedAt: post.updatedAt, provenance: { equals: post.provenance === null ? Prisma.DbNull : post.provenance } },
      data: { provenance: encodedProvenance },
    });
    if (changed.count !== 1) throw new GuidedConflict('STALE_VERSION', 'The project changed while your answer was saving. Retry with your preserved text.');
    const editorial = await tx.editorialInterview.upsert({
      where: { projectId }, create: { projectId, status: 'IN_PROGRESS', selectedQuestionIds: nextPayload.selectedQuestionIds },
      update: { selectedQuestionIds: nextPayload.selectedQuestionIds }, select: { id: true, roomProgress: true, status: true },
    });
    await rebuildAnswerProjection(editorial.id, answers.map(a => ({ ...a, questionCategory: a.section ?? null })), projectedAudio, tx);
    await tx.editorialInterview.update({ where: { id: editorial.id }, data: {
      roomProgress: { ...objectValue(editorial.roomProgress), ...roomProgress(next) },
      ...(editorial.status === 'PUBLISHED' ? {} : { status: next.status === 'finished' ? 'COMPLETED' : 'IN_PROGRESS' }),
    } });
    return next;
  }, { maxWait: 5000, timeout: 20000 });
}

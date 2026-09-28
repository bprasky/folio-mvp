import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { assertLegacyInterviewAllowed } from '@/lib/spotlight/legacyBoundary';
import { rebuildAnswerProjection } from '@/lib/editorial/syncInterviewAnswers';
import { makeSlug } from '@/lib/posting/slug';
import { createGuidedSession, GuidedConflict } from './guided/controller';
import { adaptGuidedProjectQuestions, readGuidedContext } from './guided/preparation';
import { loadGuidedPost, objectValue, savedGuidedSession } from './guided/store';

export interface InterviewResetSnapshot { revision: string; sessionId: string | null }
export interface InterviewResetRequest extends InterviewResetSnapshot { requestId: string }

function snapshot(post: Awaited<ReturnType<typeof loadGuidedPost>>): InterviewResetSnapshot {
  return {
    revision: createHash('sha256').update(JSON.stringify(post ?? null)).digest('hex'),
    sessionId: savedGuidedSession(post?.provenance)?.id ?? null,
  };
}

function receiptDigest(request: InterviewResetRequest) {
  return createHash('sha256').update(JSON.stringify([request.revision, request.sessionId])).digest('hex');
}

async function assertResetAccess(projectId: string, actorId: string) {
  assertLegacyInterviewAllowed(projectId);
  await assertProjectWrite(actorId, projectId);
}

export async function getInterviewResetSnapshot(projectId: string, actorId: string) {
  await assertResetAccess(projectId, actorId);
  return snapshot(await loadGuidedPost(projectId));
}

/** Reset is explicit and atomic; no model call is required to erase an interview. */
export async function resetProjectInterview(projectId: string, actorId: string, request: InterviewResetRequest) {
  await assertResetAccess(projectId, actorId);
  const digest = receiptDigest(request);
  const before = await loadGuidedPost(projectId);
  const priorInterview = objectValue(objectValue(before?.provenance).interview);
  if (priorInterview.resetReceipt?.requestId === request.requestId) {
    if (priorInterview.resetReceipt.digest !== digest)
      throw new GuidedConflict('REQUEST_ID_REUSED', 'This reset request was already used for another interview revision.');
    return { session: savedGuidedSession(before?.provenance), resetId: priorInterview.resetId as string };
  }
  const expected = snapshot(before);
  if (request.revision !== expected.revision || request.sessionId !== expected.sessionId)
    throw new GuidedConflict('STALE_RESET', 'The interview changed before it could be cleared. Review the saved answers and choose Start over again.');

  const current = savedGuidedSession(before?.provenance);
  // A saved guided interview retains its safe writer even during flag rollback.
  // Reset starts at the first project obligation, using existing validated
  // openers; room questions still wait for new accepted project answers.
  const context = await readGuidedContext(projectId);
  const session = current || process.env.NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW === '1'
    ? createGuidedSession(projectId, {
      questions: adaptGuidedProjectQuestions([], context.images.filter(image => image.roomId).slice(0, 3).map(image => image.id)),
      rooms: context.rooms, contextFingerprint: context.contextFingerprint,
      minimumTotalAnswers: Math.max(8, context.rooms.length * 3),
    }, request.requestId) : null;
  if (session) session.version = (current?.version ?? 0) + 1;
  const resetId = randomUUID();
  if (session) session.resetId = resetId;

  return prisma.$transaction(async tx => {
    const post = await tx.projectPost.findUnique({ where: { projectId }, select: { id: true, provenance: true, updatedAt: true } });
    const interview = objectValue(objectValue(post?.provenance).interview);
    if (interview.resetReceipt?.requestId === request.requestId) {
      if (interview.resetReceipt.digest !== digest)
        throw new GuidedConflict('REQUEST_ID_REUSED', 'This reset request was already used for another interview revision.');
      return { session: savedGuidedSession(post?.provenance), resetId: interview.resetId as string };
    }
    const fresh = snapshot(post);
    if (fresh.revision !== request.revision || fresh.sessionId !== request.sessionId)
      throw new GuidedConflict('STALE_RESET', 'The interview changed before it could be cleared. Review the saved answers and choose Start over again.');

    const payload = objectValue(interview.payload);
    const next = {
      ...objectValue(post?.provenance),
      interview: {
        resetId, resetReceipt: { requestId: request.requestId, digest },
        payload: {
          ...(Array.isArray(payload.imageOrder) ? { imageOrder: payload.imageOrder } : {}),
          answers: [], followups: [], selectedQuestionIds: [],
        },
        answers: [],
        ...(session ? { guided: session } : {}),
      },
    };
    const provenance: Prisma.InputJsonValue = JSON.parse(JSON.stringify(next));
    if (post) {
      const changed = await tx.projectPost.updateMany({
        where: { id: post.id, updatedAt: post.updatedAt, provenance: { equals: post.provenance === null ? Prisma.DbNull : post.provenance } },
        data: { provenance },
      });
      if (changed.count !== 1) throw new GuidedConflict('STALE_RESET', 'The interview changed while it was being cleared. Review it before trying again.');
    } else {
      await tx.projectPost.create({ data: { projectId, slug: makeSlug(context.project.title || undefined, projectId), status: 'DRAFT', provenance } });
    }
    const editorial = await tx.editorialInterview.upsert({
      where: { projectId }, create: { projectId, status: 'IN_PROGRESS', selectedQuestionIds: [] },
      update: {}, select: { id: true, status: true },
    });
    await rebuildAnswerProjection(editorial.id, [], {}, tx);
    await tx.editorialInterview.update({ where: { id: editorial.id }, data: {
      selectedQuestionIds: [], roomProgress: {},
      ...(editorial.status === 'PUBLISHED' ? {} : { status: 'IN_PROGRESS' }),
    } });
    return { session, resetId };
  }, { maxWait: 5000, timeout: 20000 });
}

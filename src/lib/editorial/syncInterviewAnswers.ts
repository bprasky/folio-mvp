import type { Prisma } from '@prisma/client';
import { assertLegacyInterviewAllowed } from '@/lib/spotlight/legacyBoundary';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { SECTION_ENUM } from '@/lib/posting/interviewSchemas';

/**
 * The projection of interview answers into `EditorialInterviewAnswer`.
 *
 * The read/record split (D5b): `provenance.interview.payload.answers` on the
 * ProjectPost is CANONICAL — anything that decides reads it. This table is a
 * queryable PROJECTION of that provenance, and it exists so questions that span
 * designers and projects ("which vendors get named unprompted", "what do people
 * say about a room once it's fully tagged") are answerable in SQL instead of by
 * walking every project's JSON blob.
 *
 * That only works if the projection is FAITHFUL. It had two independent writers
 * — this file and the interview POST — writing different subsets of the same
 * row, so whichever ran last decided how much of the record survived: running
 * this one after a save dropped the question text, the room, the cross-room
 * flag and the follow-up edge. One writer now, one row shape.
 */

/** An answer as it exists in provenance, in either of its historical shapes. */
export interface ProjectionAnswer {
  questionId?: string;
  id?: string;
  /** The answer text: `answer` in provenance, `answerText` in the table. */
  answer?: string;
  answerText?: string;
  /** The question text the designer actually answered. */
  prompt?: string;
  questionText?: string;
  isFollowUp?: boolean;
  inputModality?: string | null;
  linkedImageId?: string | null;
  linkedProductId?: string | null;
  aiClassificationAttribute?: string | null;
  questionSource?: string | null;
  roomId?: string | null;
  isCrossRoom?: boolean;
  /**
   * The question CATEGORY, one of the twelve SECTION_ENUM values. Provenance
   * calls this field `section`; the column is `questionCategory` because by the
   * time an answer is loaded, `section` means the resolved ROOM and the two are
   * orthogonal. Read off the payload's `section` by the caller.
   */
  questionCategory?: string | null;
  /** For a follow-up: the questionId of the answer that prompted it. */
  parentQuestionId?: string | null;
}

/**
 * Retained recordings, keyed by questionId, as written by the transcribe route
 * to `provenance.interview.audio` (spec 21 delta D5a).
 *
 * It arrives as a parameter rather than being read here, for the same
 * single-writer reason the rest of this file exists: the projection is exactly
 * as complete as what its caller hands it, and a second reader inside this
 * function would be a second source of truth about what a row should contain.
 */
export type AnswerAudioMap = Record<
  string,
  | {
      audioUrl?: string | null;
      /** Whisper word timings, seconds. First-word start to last-word end
       *  resolves any contiguous substring to a span — which is what makes a
       *  published quote cuttable. */
      words?: Array<{ word: string; start: number; end: number }> | null;
    }
  | null
  | undefined
>;

const rowKey = (questionId: string, isFollowUp: boolean) =>
  `${questionId}|${isFollowUp ? 'F' : 'P'}`;

const pick = (...values: Array<string | null | undefined>) => {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
};

/**
 * Rewrite one interview's answer rows from the canonical answer list.
 *
 * Wipe-and-rebuild (rather than upsert) keeps the projection exactly as complete
 * as its source — an answer deleted from provenance must not survive here. It
 * runs in a single transaction (D5a) so a concurrent reader never observes a
 * half-written projection; half-written is worse than stale.
 *
 * Two things the rebuild has to carry across, since the rows themselves are
 * replaced every time:
 *  - `createdAt`, which otherwise becomes "the last time anything was saved" for
 *    every row at once, erasing the order the designer actually worked in.
 *  - `parentAnswerId`, resolved from the follow-up's parent QUESTION id. Row ids
 *    are generated here rather than by the database so a follow-up can point at
 *    its parent inside the same insert.
 */
export async function rebuildAnswerProjection(
  interviewId: string,
  answers: ProjectionAnswer[],
  audioByQuestion: AnswerAudioMap = {},
  tx?: Prisma.TransactionClient,
): Promise<number> {
  const writer = tx || prisma;
  const rows = answers
    .map((a) => ({ ...a, questionId: a.questionId || a.id || '' }))
    .filter((a) => a.questionId && pick(a.answer, a.answerText));

  const priorRows = await writer.editorialInterviewAnswer.findMany({
    where: { interviewId },
    select: { questionId: true, isFollowUp: true, createdAt: true },
  });
  const firstSeen = new Map(
    priorRows.map((r) => [rowKey(r.questionId, r.isFollowUp), r.createdAt]),
  );

  const idByQuestion = new Map<string, string>();
  for (const a of rows) {
    idByQuestion.set(rowKey(a.questionId, !!a.isFollowUp), randomUUID());
  }

  const operations = [
    writer.editorialInterviewAnswer.deleteMany({ where: { interviewId } }),
    ...rows.map((a) => {
      const key = rowKey(a.questionId, !!a.isFollowUp);
      return writer.editorialInterviewAnswer.create({
        data: {
          id: idByQuestion.get(key)!,
          interviewId,
          questionId: a.questionId,
          questionText: pick(a.prompt, a.questionText),
          answerText: pick(a.answer, a.answerText) ?? '',
          isFollowUp: !!a.isFollowUp,
          // A follow-up whose parent is no longer in the set stays unlinked
          // rather than pointing at a row that doesn't exist.
          parentAnswerId: a.parentQuestionId
            ? idByQuestion.get(rowKey(a.parentQuestionId, false)) ?? null
            : null,
          inputModality: pick(a.inputModality) ?? 'text',
          linkedImageId: a.linkedImageId || null,
          linkedProductId: a.linkedProductId || null,
          questionSource:
            pick(a.questionSource) ?? (a.isFollowUp ? 'follow_up' : 'base_question'),
          aiClassificationAttribute: a.aiClassificationAttribute || null,
          roomId: a.roomId || null,
          isCrossRoom: !!a.isCrossRoom,
          // Rebuilt from the payload on every pass, like audioUrl above and for
          // the same reason: a wipe-and-rebuild cannot drop what it re-derives
          // from its input. Null when the payload carried no category — never a
          // guess, because a wrong category is worse than a missing one.
          questionCategory: a.questionCategory || null,
          // The retained recording for this question, projected from canonical
          // provenance. Rebuilt from the map on every pass rather than carried
          // on the row, so a wipe-and-rebuild cannot drop it — which is the
          // failure that made writing it here directly the wrong design.
          audioUrl: audioByQuestion[a.questionId]?.audioUrl ?? null,
          // Omitted rather than nulled when absent: Prisma reserves null on a
          // Json? field for JSON null, and the column's default is SQL NULL,
          // which is the accurate statement for an answer with no recording.
          wordTimings: audioByQuestion[a.questionId]?.words?.length
            ? audioByQuestion[a.questionId]!.words!
            : undefined,
          createdAt: firstSeen.get(key) ?? new Date(),
        },
      });
    }),
  ]);

  return rows.length;
}

/** The interview record for a project, created on first use. */
export async function getOrCreateEditorialInterview(projectId: string) {
  const existing = await prisma.editorialInterview.findUnique({ where: { projectId } });
  if (existing) return existing;
  return prisma.editorialInterview.create({
    data: { projectId, status: 'IN_PROGRESS', selectedQuestionIds: [] },
  });
}

/**
 * Re-project a project's stored answers. Reads canonical provenance and hands it
 * to the one writer above, so calling this can only ever reproduce the same rows
 * the interview save would have written — never a thinner version of them.
 */
export async function syncAnswersToEditorialInterview(
  projectId: string
): Promise<{ interviewId: string; answersCreated: number }> {
  assertLegacyInterviewAllowed(projectId);
  const interview = await getOrCreateEditorialInterview(projectId);

  const post = await prisma.projectPost.findUnique({
    where: { projectId },
    select: { provenance: true },
  });

  if (!post || !post.provenance) {
    return { interviewId: interview.id, answersCreated: 0 };
  }

  const provenance = post.provenance as any;
  const payload = provenance.interview?.payload || {};

  // Provenance names the question category `section`. Carry it across under the
  // name the column uses, and only when it is a real SECTION_ENUM member —
  // anything else is a value some earlier derivation invented, and null is the
  // honest record of "we do not know".
  const withCategory = (a: any): ProjectionAnswer => ({
    ...a,
    questionCategory: SECTION_ENUM.safeParse(a?.section).success ? a.section : null,
  });

  const answers: ProjectionAnswer[] = (payload.answers || []).map(withCategory);
  const followups: ProjectionAnswer[] = (payload.followups || []).map(
    (f: ProjectionAnswer) => ({ ...withCategory(f), isFollowUp: true }),
  );

  const answersCreated = await rebuildAnswerProjection(
    interview.id,
    [...answers, ...followups],
    (provenance.interview?.audio as AnswerAudioMap) || {},
  );

  return { interviewId: interview.id, answersCreated };
}

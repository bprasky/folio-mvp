// ============================================================================
// The single writer for a designer-submitted interview answer.
//
// It lives here rather than inline in /api/interview/respond so the rule it
// encodes — one row per (interviewId, questionId, isFollowUp), re-answering
// UPDATES — can be exercised without standing up the route, and so a second
// caller cannot quietly reintroduce a plain create.
// ============================================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Write one interview answer, keyed by (interviewId, questionId, isFollowUp).
 *
 * WHAT A RE-ANSWER REFRESHES, and what it must not touch:
 *
 *   answerText     refreshed — this is the correction itself.
 *   inputModality  refreshed — it describes the answer, and the answer changed.
 *   questionText   refreshed ONLY when the caller actually sent one. The route
 *                  substitutes a generic fallback for a missing value, so
 *                  refreshing unconditionally would overwrite a real stored
 *                  question with "Tell us about this project."
 *   audioUrl,      CLEARED when the text actually changed. Word timings are
 *   wordTimings    offsets into the answer they were transcribed from; against
 *                  replaced text they resolve a pull quote to the wrong span.
 *                  Absent is recoverable — the next projection rebuild re-derives
 *                  both from provenance — and stale is not.
 *
 *   createdAt      PRESERVED. It is the order the designer worked in.
 *   questionSource PRESERVED. It classifies the QUESTION, not the answer; this
 *                  route only ever knows the default, so writing it on update
 *                  would relabel a 'follow_up' or 'realtime_interview' row as
 *                  'base_question'.
 *   roomId, questionCategory, linkedImageId, linkedProductId,
 *   aiClassificationAttribute, isCrossRoom, parentAnswerId
 *                  PRESERVED. All describe the question's context, which a
 *                  re-answer does not change, and none is known here — a full
 *                  update would null every one of them.
 */
export async function saveInterviewAnswer(input: {
  interviewId: string;
  questionId: string;
  questionText: string | undefined;
  answer: string;
  inputMode: "voice" | "text";
}): Promise<"created" | "updated"> {
  const { interviewId, questionId, questionText, answer, inputMode } = input;
  // This route only ever writes primary answers; follow-ups are written by the
  // projection rebuild. Named rather than implied, because it is a third of the
  // row key.
  const isFollowUp = false;

  const existing = await prisma.editorialInterviewAnswer.findFirst({
    where: { interviewId, questionId, isFollowUp },
    // Newest wins if duplicates predate 20260904193000_add_row_key_unique —
    // the same rule the cleanup used, so this agrees with it rather than
    // resurrecting an older answer.
    orderBy: { createdAt: "desc" },
    select: { id: true, answerText: true },
  });

  if (existing) {
    const textChanged = existing.answerText !== answer;
    await prisma.editorialInterviewAnswer.update({
      // By primary key, so this works before the row-key unique index exists.
      where: { id: existing.id },
      data: {
        answerText: answer,
        inputModality: inputMode,
        ...(questionText ? { questionText } : {}),
        ...(textChanged ? { audioUrl: null, wordTimings: Prisma.DbNull } : {}),
      },
    });
    return "updated";
  }

  try {
    await prisma.editorialInterviewAnswer.create({
      data: {
        interviewId,
        questionId,
        isFollowUp,
        questionText: questionText || "Tell us about this project.",
        answerText: answer,
        inputModality: inputMode,
        questionSource: "base_question",
      },
    });
    return "created";
  } catch (e) {
    // The ONLY error swallowed here: two concurrent submissions of the same
    // answer both found no row and both tried to insert. Once
    // 20260904193000_add_row_key_unique is applied the loser gets P2002, and the
    // right response is to take the update path it would have taken had it read
    // a moment later. Every other error propagates — a catch that swallowed
    // P2002 generally would hide exactly the duplicate this key exists to stop.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const raced = await prisma.editorialInterviewAnswer.findFirst({
        where: { interviewId, questionId, isFollowUp },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (raced) {
        await prisma.editorialInterviewAnswer.update({
          where: { id: raced.id },
          data: {
            answerText: answer,
            inputModality: inputMode,
            ...(questionText ? { questionText } : {}),
          },
        });
        return "updated";
      }
    }
    throw e;
  }
}

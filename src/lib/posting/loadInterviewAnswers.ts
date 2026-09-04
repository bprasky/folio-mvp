/**
 * Read a project's interview answers the way the generator reads them.
 *
 * There are two stores and they are not interchangeable:
 *
 *   `provenance.interview.payload` on the ProjectPost is CANONICAL — the older
 *   interview surface writes here, and the article generator reads here first.
 *   `EditorialInterviewAnswer` is a queryable PROJECTION of that provenance
 *   (see syncInterviewAnswers.ts), and it is also where the newer InterviewFlow
 *   writes directly.
 *
 * A caller that reads only one of them silently sees no answers for projects
 * interviewed through the other surface. Both are read and merged here.
 *
 * Room attribution is the other trap. Answers persist `roomId` and never a room
 * NAME — `section` on a STORED answer is the question category ("what"/"how"),
 * not a room. Resolving that id is what lets a quote be matched to its chapter;
 * skipping it puts every answer under "General", which is not the title of any
 * chapter, and every lookup misses. Resolution goes through buildRoomResolver,
 * the same closure the gallery images use, so answer rooms and chapter titles
 * cannot resolve differently.
 *
 * So `section` on a LOADED answer means the room, and that is load-bearing:
 * `quoteCandidates.ts:98` and `selectPullQuotes.ts:173` both match it against a
 * chapter title, and a quote whose section stops naming its room stops being
 * offered for that room. The field is not being renamed.
 *
 * What it cost was the OTHER half. A project-level answer has no `roomId`, so it
 * fell to "General" and reached the headline prompt tagged the same as an
 * unassigned room answer — the five most narrative answers on the project,
 * present and unlabelled. `category` carries that half alongside, recovered from
 * the question id rather than from a column, because there is no column.
 */

import { prisma } from '@/lib/prisma';
import { buildRoomResolver } from './resolveImageRoom';
import {
  PROJECT_QUESTION_CATEGORIES,
  type ProjectQuestionCategory,
} from '@/lib/interview/generateProjectQuestions';
import type { AnswerLike } from './quoteCandidates';
import { z } from 'zod';
import { SECTION_ENUM } from './interviewSchemas';

/** One of the twelve question categories. `z.infer` keeps it tied to the enum. */
export type SectionCategory = z.infer<typeof SECTION_ENUM>;

/**
 * The "About This Project" category an answer belongs to, or null for a room one.
 *
 * Project-level ids are minted as `project-<CATEGORY>-<uuid>`
 * (generateProjectQuestions.ts:95, :326) and nothing records the category as a
 * column: `EditorialInterviewAnswer` has `questionId`, `questionText` and
 * `roomId`, and no scope, topic or category field. The id IS the record, and two
 * readers already depend on that — getInterviewQuestions.ts:318, and
 * interview/route.ts:302, which states the rule outright: *"project-level answers
 * have none [no roomId] and are identified by their id prefix"*.
 *
 * Matched against the canonical list rather than split on hyphens. A category
 * contains underscores and a uuid contains hyphens, so splitting would work by
 * accident; prefix-matching a known member means a non-conforming id yields null
 * instead of whatever happened to sit between the first two hyphens.
 */
export function projectAnswerCategory(
  questionId: unknown,
): ProjectQuestionCategory | null {
  if (typeof questionId !== 'string') return null;
  return (
    PROJECT_QUESTION_CATEGORIES.find((c) => questionId.startsWith(`project-${c}-`)) ?? null
  );
}

export interface LoadedAnswer extends AnswerLike {
  /**
   * The ROOM this answer is about, or 'General'. Named `section` because that is
   * what `AnswerLike` calls it and what the pull-quote path matches against a
   * chapter title. It is not the question category — see `category`.
   */
  section: string;
  /**
   * The project-question category, for the five "About This Project" answers and
   * their follow-ups. Null for every room answer, which is what makes
   * `category !== null` the test for "this is project-scoped".
   */
  category: ProjectQuestionCategory | null;
  /**
   * The QUESTION CATEGORY — one of the twelve SECTION_ENUM values, the thing the
   * stores call `section` before this loader overwrites that field with the room.
   *
   * A third axis, not a variant of the other two. `section` above is the room the
   * answer is ABOUT; `category` is whether it is project-scoped; this is what was
   * ASKED. A "what" question can be asked about the Entry, which is precisely the
   * case that used to be unrecoverable: the room survived, the topic did not.
   *
   * Null means unknown, never a guess. Rows written before the column existed and
   * payload answers whose `section` is not a real SECTION_ENUM member both arrive
   * null rather than carrying whatever an earlier derivation invented.
   */
  questionCategory: SectionCategory | null;
  answer: string;
  isFollowUp: boolean;
}

export async function loadInterviewAnswers(projectId: string): Promise<LoadedAnswer[]> {
  const [post, rooms, interview] = await Promise.all([
    prisma.projectPost.findUnique({ where: { projectId }, select: { provenance: true } }),
    prisma.room.findMany({ where: { projectId }, select: { id: true, name: true } }),
    prisma.editorialInterview.findUnique({
      where: { projectId },
      include: { answers: { orderBy: { createdAt: 'asc' } } },
    }),
  ]);

  const resolveRoomName = buildRoomResolver(rooms);
  const roomOf = (a: any): string =>
    resolveRoomName({
      roomId: a?.roomId ?? a?.room_id ?? null,
      room: a?.roomName ?? null,
    }) ?? 'General';

  // A follow-up carries its OWN question id, not its parent's, so a follow-up to
  // "what was the big idea" is project-scoped and does not look it. The category
  // comes down the parent edge, and it has to be resolved for BOTH stores or the
  // two disagree — which would not show up as a wrong label but as a DUPLICATE,
  // since the de-dupe key below includes the category.
  //
  // The stores express the same edge differently. Provenance carries
  // `parentQuestionId` on the answer; the projection resolves that to a row id at
  // write time (syncInterviewAnswers.ts:127), so here it has to be walked back
  // through the rows already loaded. Both are absent together on older answers —
  // the projection's edge is derived from provenance's — so they stay symmetric.
  const questionIdByRowId = new Map<string, string>(
    (interview?.answers ?? []).map((a) => [a.id, a.questionId]),
  );
  const categoryFromPayload = (a: any): ProjectQuestionCategory | null =>
    projectAnswerCategory(a?.questionId ?? a?.id) ??
    projectAnswerCategory(a?.parentQuestionId ?? a?.parent_question_id);

  const out: LoadedAnswer[] = [];
  const push = (
    text: unknown,
    section: string,
    isFollowUp: boolean,
    category: ProjectQuestionCategory | null,
    questionCategory: SectionCategory | null,
  ) => {
    if (typeof text !== 'string' || !text.trim()) return;
    out.push({ answer: text, section, isFollowUp, category, questionCategory });
  };

  /**
   * The stored question category, or null.
   *
   * Provenance keeps it under `section` — the field this loader is about to
   * overwrite with the room — so reading it here is the whole of the fix for
   * provenance-native projects: the value was never missing, only discarded.
   * The projection keeps it under its own column. Validated against SECTION_ENUM
   * either way, so a derived `'how'` that some earlier pass wrote into a payload
   * does not get promoted to a fact.
   */
  const storedCategory = (raw: unknown): SectionCategory | null => {
    const parsed = SECTION_ENUM.safeParse(raw);
    return parsed.success ? parsed.data : null;
  };

  const payload = (post?.provenance as any)?.interview?.payload ?? {};
  for (const a of Array.isArray(payload.answers) ? payload.answers : []) {
    push(a?.answer ?? a?.a, roomOf(a), !!a?.isFollowUp, categoryFromPayload(a), storedCategory(a?.section));
  }
  for (const a of Array.isArray(payload.followups) ? payload.followups : []) {
    push(a?.answer ?? a?.a, roomOf(a), true, categoryFromPayload(a), storedCategory(a?.section));
  }
  for (const a of interview?.answers ?? []) {
    push(
      a.answerText,
      roomOf(a),
      a.isFollowUp,
      projectAnswerCategory(a.questionId) ??
        projectAnswerCategory(
          a.parentAnswerId ? questionIdByRowId.get(a.parentAnswerId) : null,
        ),
      storedCategory((a as { questionCategory?: unknown }).questionCategory),
    );
  }

  // De-dupe: the projection mirrors provenance, so most answers arrive twice.
  // Keyed on room + text, because the same sentence said about two rooms is two
  // answers, and collapsing them would cost one of the rooms its quote.
  //
  // Category joins the key for the same reason one step down: every project answer
  // resolves to the same room ("General", since none has a roomId), so without it
  // two answers to two different opening questions collapse if the designer
  // repeated themselves — and so does a project answer that happens to match an
  // unassigned room answer. Both stores derive the category identically, so this
  // narrows the key without letting the provenance/projection pair back through.
  const seen = new Set<string>();
  return out.filter((a) => {
    const key = `${a.section.toLowerCase()}::${a.category ?? ''}::${a.answer.replace(/\s+/g, ' ').trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

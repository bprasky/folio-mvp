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
 * NAME — `section` on a stored answer is the question category ("what"/"how"),
 * not a room. Resolving that id is what lets a quote be matched to its chapter;
 * skipping it puts every answer under "General", which is not the title of any
 * chapter, and every lookup misses. Resolution goes through buildRoomResolver,
 * the same closure the gallery images use, so answer rooms and chapter titles
 * cannot resolve differently.
 */

import { prisma } from '@/lib/prisma';
import { buildRoomResolver } from './resolveImageRoom';
import type { AnswerLike } from './quoteCandidates';

export interface LoadedAnswer extends AnswerLike {
  section: string;
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

  const out: LoadedAnswer[] = [];
  const push = (text: unknown, section: string, isFollowUp: boolean) => {
    if (typeof text !== 'string' || !text.trim()) return;
    out.push({ answer: text, section, isFollowUp });
  };

  const payload = (post?.provenance as any)?.interview?.payload ?? {};
  for (const a of Array.isArray(payload.answers) ? payload.answers : []) {
    push(a?.answer ?? a?.a, roomOf(a), !!a?.isFollowUp);
  }
  for (const a of Array.isArray(payload.followups) ? payload.followups : []) {
    push(a?.answer ?? a?.a, roomOf(a), true);
  }
  for (const a of interview?.answers ?? []) {
    push(a.answerText, roomOf(a), a.isFollowUp);
  }

  // De-dupe: the projection mirrors provenance, so most answers arrive twice.
  // Keyed on room + text, because the same sentence said about two rooms is two
  // answers, and collapsing them would cost one of the rooms its quote.
  const seen = new Set<string>();
  return out.filter((a) => {
    const key = `${a.section.toLowerCase()}::${a.answer.replace(/\s+/g, ' ').trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

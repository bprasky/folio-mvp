import 'server-only';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getBlankSlateQuestions, generateWebsiteContextQuestions, generateFollowUpQuestions } from './questions';
import type { InterviewAnswer } from './constants';
import type { LiveQuestion } from '@/lib/live-interview/adapter-types';

export const bioAnswerVersion = (answers: unknown) => createHash('sha256').update(JSON.stringify(answers || [])).digest('hex');
export async function readBioInterview(actorId: string) {
  const user = await prisma.user.findUnique({ where: { id: actorId }, select: { id: true, role: true } });
  if (!user) throw new Error('Forbidden: Sign in to continue.');
  const bio = await prisma.designerBio.findUnique({ where: { userId: actorId } });
  return { user, bio, answers: (bio?.interviewAnswers || []) as InterviewAnswer[] };
}

export async function prepareBioQuestions(actorId: string, round: 'base' | 'followup' = 'base') {
  const { user, bio, answers } = await readBioInterview(actorId);
  if (process.env.FOLIO_LIVE_INTERVIEWS === '1') {
    const { getLatestLiveSession } = await import('@/lib/live-interview/store');
    const saved = await getLatestLiveSession(actorId, 'designer_bio', actorId, undefined, round === 'followup' ? 2 : 1);
    const snapshot = saved?.payload.snapshot;
    if (snapshot?.source?.kind === 'designer_bio' && snapshot.source.id === actorId &&
      (snapshot.source.round === 2 ? 'followup' : 'base') === round && Array.isArray(snapshot.state?.questions)) {
      return (snapshot.state.questions as LiveQuestion[]).map(q => ({ id: q.id, question: q.text, round }));
    }
  }
  const base = answers.filter(answer => answer.round === 'base');
  const { readPreparedBio } = await import('@/lib/workspace-import/prepared');
  const prepared = round === 'base' ? readPreparedBio(bio?.scrapedData, user.role || 'DESIGNER') : null;
  const questions = round === 'followup'
    ? base.length < 3 ? [] : await generateFollowUpQuestions(base, user.role || 'DESIGNER', bio?.scrapedData as Record<string, unknown> | null)
    : prepared ?? (bio?.scrapedData && bio.status !== 'empty'
      ? await generateWebsiteContextQuestions(bio.scrapedData as Record<string, unknown>, user.role || 'DESIGNER')
      : getBlankSlateQuestions(user.role || 'DESIGNER'));
  // A regenerated positional ID never renames a previously answered question.
  return questions.map(question => ({ ...question, question: answers.find(answer => answer.id === question.id && answer.round === round)?.question || question.question }));
}

/** Both text and live use this writer. The actor is the personal publishing owner. */
export async function saveBioAnswer(actorId: string, answer: InterviewAnswer, expectedVersion?: string) {
  return prisma.$transaction(async db => {
    await db.$queryRaw`SELECT id FROM users WHERE id = ${actorId} FOR UPDATE`;
    if (!await db.user.findUnique({ where: { id: actorId }, select: { id: true } })) throw new Error('Forbidden: Sign in to continue.');
    const bio = await db.designerBio.upsert({ where: { userId: actorId }, create: { userId: actorId, status: 'interviewing' }, update: {} });
    const answers = (bio.interviewAnswers || []) as InterviewAnswer[];
    const existing = answers.find(item => item.id === answer.id);
    if (expectedVersion && bioAnswerVersion(answers) !== expectedVersion && (!existing || existing.answer !== answer.answer || existing.question !== answer.question))
      throw new Error('Conflict: Your bio answers changed. Reload before saving.');
    const next = [...answers.filter(item => item.id !== answer.id), answer];
    await db.designerBio.update({ where: { userId: actorId }, data: { interviewAnswers: next as unknown as Prisma.InputJsonValue, status: ['empty', 'scraped'].includes(bio.status) ? 'interviewing' : bio.status } });
    return { success: true, answerCount: next.length, baseAnswerCount: next.filter(item => item.round === 'base').length,
      canGenerateBio: next.filter(item => item.round === 'base').length >= 3, hasFollowUps: next.some(item => item.round === 'followup') };
  });
}

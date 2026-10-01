import 'server-only';
import { createHash } from 'crypto';
import { Prisma, type CollaborationStoryStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCollaborationStoryEdit } from './auth';
import { getRound1Questions, isRound1Complete, type Round1Response } from './questions/round1';
import { generateRound2Questions, isRound2Complete } from './questions/generateRound2';
import { generateRound3Questions, isRound3Complete } from './questions/generateRound3';

type Round = 1 | 2 | 3;
type Field = 'vendorRound1' | 'vendorRound2' | 'vendorRound3' | 'designerRound1' | 'designerRound2' | 'designerRound3';
type Question = { id: string; prompt: string; helper?: string; category?: string };
type RoundData = { responses?: Round1Response[]; completedAt?: string; questions?: Question[] };
export const collaborationVersion = (value: unknown) => createHash('sha256').update(JSON.stringify(value || {})).digest('hex');
export async function readCollaborationInterview(actorId: string, storyId: string, round: Round) {
  if (![1, 2, 3].includes(round)) throw new Error('Invalid interview round.');
  const { role } = await assertCollaborationStoryEdit(actorId, storyId);
  if (role !== 'vendor' && role !== 'designer') throw new Error('Forbidden: Only participants can answer this interview.');
  const story = await prisma.collaborationStory.findUnique({ where: { id: storyId } });
  if (!story) throw new Error('NotFound: Collaboration unavailable.');
  const field = `${role}Round${round}` as Field;
  return { story, role, field, data: (story[field] || {}) as RoundData };
}
export async function prepareCollaborationQuestions(actorId: string, storyId: string, round: Round) {
  const { story, role, field, data } = await readCollaborationInterview(actorId, storyId, round);
  if (data.questions?.length) return data.questions;
  const userRole = role === 'vendor' ? 'VENDOR' : 'DESIGNER';
  if (round === 1) return getRound1Questions(userRole);
  const own = (story[`${role}Round1` as Field] || {}) as RoundData;
  if (round === 2) {
    if (!own.responses?.length) throw new Error('Complete round 1 first.');
    return storeQuestions(await generateRound2Questions(userRole, own.responses));
  }
  const other = role === 'vendor' ? 'designer' : 'vendor';
  const other1 = (story[`${other}Round1` as Field] || {}) as RoundData;
  const other2 = (story[`${other}Round2` as Field] || {}) as RoundData;
  if (!other1.responses?.length) throw new Error('Waiting for the other participant’s answers.');
  return storeQuestions(await generateRound3Questions(userRole, other1.responses, other2.responses || [], getRound1Questions(userRole === 'VENDOR' ? 'DESIGNER' : 'VENDOR')));
  async function storeQuestions(questions: Question[]) {
    // Generation happens outside the write transaction. Retain exact generated wording on reload.
    await readCollaborationInterview(actorId, storyId, round);
    const result = await prisma.collaborationStory.updateMany({ where: { id: storyId, updatedAt: story.updatedAt }, data: { [field]: { ...data, questions } as Prisma.InputJsonValue } });
    if (!result.count) throw new Error('Conflict: Collaboration changed while preparing questions. Retry.');
    return questions;
  }
}

/** Shared text/live writer; serializes each participant's answers and existing round completion. */
export async function saveCollaborationResponses(actorId: string, storyId: string, round: Round,
  input: { questionId: string; answer: string }[], expectedVersion?: string) {
  const access = await readCollaborationInterview(actorId, storyId, round);
  if (input.some(answer => !answer.answer.trim() || answer.answer.length > 5000)) throw new Error('Keep each answer within 5,000 characters.');
  return prisma.$transaction(async db => {
    await db.$queryRaw`SELECT id FROM collaboration_stories WHERE id = ${storyId} FOR UPDATE`;
    const story = await db.collaborationStory.findUnique({ where: { id: storyId } });
    if (!story) throw new Error('NotFound: Collaboration unavailable.');
    // Membership is rechecked inside the write transaction; ownership cannot be supplied by speech.
    if (access.role === 'designer' ? story.designerUserId !== actorId : !await db.organizationUser.findFirst({ where: { userId: actorId, organizationId: story.vendorOrgId, isActive: true }, select: { id: true } }))
      throw new Error('Forbidden: Collaboration participation changed.');
    const previous = (story[access.field] || {}) as RoundData;
    const identical = input.every(answer => previous.responses?.some(old => old.questionId === answer.questionId && old.answer === answer.answer));
    if (expectedVersion && collaborationVersion(previous) !== expectedVersion && !identical) throw new Error('Conflict: Your contribution changed. Reload.');
    if (expectedVersion && identical) return { success: true, round, isComplete: !!previous.completedAt, status: story.status, responseCount: previous.responses?.length || 0 };
    const now = new Date();
    const responses = input.map(answer => ({ ...answer, answeredAt: now.toISOString() }));
    const userRole = access.role === 'vendor' ? 'VENDOR' : 'DESIGNER';
    const complete = round === 1 ? isRound1Complete(responses, userRole) : round === 2 ? isRound2Complete(responses) : isRound3Complete(responses);
    const otherField = `${access.role === 'vendor' ? 'designer' : 'vendor'}Round${round}` as Field;
    const other = (story[otherField] || {}) as RoundData;
    const status = (complete && other.completedAt ? `ROUND${round}_COMPLETE` : `ROUND${round}_${userRole}`) as CollaborationStoryStatus;
    await db.collaborationStory.update({ where: { id: storyId }, data: {
      [access.field]: { ...previous, responses, completedAt: complete ? now.toISOString() : null } as unknown as Prisma.InputJsonValue,
      status, ...(complete && round === 3 ? { [access.role === 'vendor' ? 'vendorCompletedAt' : 'designerCompletedAt']: now } : {}),
    } });
    return { success: true, round, isComplete: complete, status, responseCount: responses.length };
  });
}

import 'server-only';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getUserOrgMemberships, isOrgAdmin } from '@/lib/permissions';

export const orgInterviewVersion = (answers: unknown) => createHash('sha256').update(JSON.stringify(answers || {})).digest('hex');
export async function authorizeOrgInterview(actorId: string, orgId: string) {
  if (!isOrgAdmin(await getUserOrgMemberships(actorId), orgId)) throw new Error('Forbidden: Organization admin access required.');
}
export async function readOrgInterview(actorId: string, orgId: string) {
  await authorizeOrgInterview(actorId, orgId);
  return prisma.orgBioInterview.findUnique({ where: { organizationId: orgId }, include: { questionCoverage: true } });
}
/** Merge a single accepted answer without overwriting other saved conversations. */
export async function saveOrgInterviewAnswer(actorId: string, orgId: string, questionId: string, text: string, expectedVersion: string) {
  return saveOrgConversation(actorId, orgId, { [questionId]: text }, {}, expectedVersion);
}
export async function saveOrgConversation(actorId: string, orgId: string, input: Record<string, string>, importData: {
  importedBioText?: string | null; importedBioUrl?: string | null; importedBioAnalyzedAt?: Date | null; bioImportType?: string;
} = {}, expectedVersion?: string) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.values(input).some(value => typeof value !== 'string')) throw new Error('Invalid conversational answers.');
  await authorizeOrgInterview(actorId, orgId);
  return prisma.$transaction(async db => {
    await db.$queryRaw`SELECT id FROM organizations WHERE id = ${orgId} FOR UPDATE`;
    const membership = await db.organizationUser.findFirst({ where: { userId: actorId, organizationId: orgId, isActive: true, role: { in: ['OWNER', 'ADMIN'] } }, select: { id: true } });
    if (!membership) throw new Error('Forbidden: Organization admin access required.');
    const previous = await db.orgBioInterview.findUnique({ where: { organizationId: orgId } });
    const answers = (previous?.conversationalAnswers || {}) as Record<string, string>;
    if (expectedVersion && orgInterviewVersion(answers) !== expectedVersion && Object.entries(input).some(([id, text]) => answers[id] !== text)) throw new Error('Conflict: The organization interview changed. Reload.');
    const data = { interviewFormat: 'conversational', conversationalAnswers: { ...answers, ...input } as Prisma.InputJsonValue, ...importData };
    return db.orgBioInterview.upsert({ where: { organizationId: orgId }, create: { organizationId: orgId, ...data }, update: data });
  });
}

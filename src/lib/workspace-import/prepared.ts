import 'server-only';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { ensureGuidedPost, objectValue } from '@/lib/interview/guided/store';
import { prepareGuidedProjectPlan, readGuidedContext } from '@/lib/interview/guided/preparation';
import { validatePlan } from '@/lib/interview/guided/controller';
import type { GuidedPreparation } from '@/lib/interview/guided/types';
import type { BioQuestion } from '@/lib/designer-bio/questions';
import { assertImportSections } from './store';

/** Preparation is not an interview start: no answers, live sessions or editorial status changes. */
export async function savePreparedProject(projectId: string, actorId: string, orgId: string): Promise<GuidedPreparation> {
  await assertProjectWrite(actorId, projectId);
  const preparation = await prepareGuidedProjectPlan(projectId);
  await assertImportSections(actorId, { orgId, sections: ['projects'] });
  validatePlan(preparation.questions, { rooms: preparation.rooms, turns: [] });
  const post = await ensureGuidedPost(projectId, actorId);
  if ((await readGuidedContext(projectId)).contextFingerprint !== preparation.contextFingerprint)
    throw new Error('The project changed while its questions were being prepared.');
  const provenance = objectValue(post.provenance);
  await assertProjectWrite(actorId, projectId);
  await assertImportSections(actorId, { orgId, sections: ['projects'] });
  const updated = await prisma.projectPost.updateMany({ where: { id: post.id, updatedAt: post.updatedAt,
    provenance: { equals: post.provenance === null ? Prisma.DbNull : post.provenance } },
    data: { provenance: JSON.parse(JSON.stringify({ ...provenance, workspacePreparation: preparation })) } });
  if (!updated.count) throw new Error('The project changed while its questions were being saved.');
  return preparation;
}
export async function readPreparedProject(projectId: string): Promise<GuidedPreparation | null> {
  const post = await prisma.projectPost.findUnique({ where: { projectId }, select: { provenance: true } });
  const saved = objectValue(post?.provenance).workspacePreparation as GuidedPreparation | undefined;
  if (!saved || !Array.isArray(saved.questions) || !Array.isArray(saved.rooms) ||
    (await readGuidedContext(projectId)).contextFingerprint !== saved.contextFingerprint) return null;
  try { validatePlan(saved.questions, { rooms: saved.rooms, turns: [] }); return saved; } catch { return null; }
}
// JSONB may reorder object keys. A stored cache must survive a database round trip.
export const bioSourceFingerprint = (data: Record<string, unknown>) => createHash('sha256')
  .update(JSON.stringify(Object.keys(data).sort().map(key => [key, data[key]]))).digest('hex');
export function readPreparedBio(data: unknown, role: string): BioQuestion[] | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const { _folioPreparation, ...source } = data as Record<string, unknown>;
  const saved = objectValue(_folioPreparation);
  if (saved.role !== role || saved.fingerprint !== bioSourceFingerprint(source) || !Array.isArray(saved.questions) || !saved.questions.length) return null;
  return saved.questions.every((q: BioQuestion) => q && q.round === 'base' && typeof q.id === 'string' && typeof q.question === 'string' && q.question.length > 0 && q.question.length <= 600)
    ? saved.questions as BioQuestion[] : null;
}

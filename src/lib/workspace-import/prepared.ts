import 'server-only';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { objectValue } from '@/lib/interview/guided/store';
import { readGuidedContext } from '@/lib/interview/guided/preparation';
import { validatePlan } from '@/lib/interview/guided/controller';
import type { GuidedPreparation } from '@/lib/interview/guided/types';
import type { BioQuestion } from '@/lib/designer-bio/questions';
export async function readPreparedProject(projectId: string): Promise<GuidedPreparation | null> {
  const post = await prisma.projectPost.findUnique({ where: { projectId }, select: { provenance: true } });
  // Earlier website imports prepared questions before product review. Start a new
  // interview from current materials instead; existing sessions/answers remain intact.
  if (objectValue(post?.provenance).websiteImport) return null;
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

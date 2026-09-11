import { prisma } from '@/lib/prisma';

/** Public/editorial boundary. Never trust projection labels to identify drafts. */
export async function stripPrivateInterviewData<T>(value: T): Promise<T> {
  const candidates = new Set<string>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object' || node instanceof Date) return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const row = node as Record<string, unknown>;
    for (const key of ['questionId', 'parentQuestionId']) {
      if (typeof row[key] === 'string') candidates.add(row[key]);
    }
    if (typeof row.id === 'string' && ('answer' in row || 'answerText' in row || 'prompt' in row)) candidates.add(row.id);
    for (const [key, child] of Object.entries(row)) if (key !== 'spotlightDrafts') visit(child);
  };
  visit(value);
  const identities = candidates.size ? await prisma.spotlightQuestion.findMany({
    where: { id: { in: [...candidates] } }, select: { id: true },
  }) : [];
  const privateIds = new Set(identities.map(row => row.id));
  const clean = (node: unknown): unknown => {
    if (!node || typeof node !== 'object' || node instanceof Date) return node;
    if (Array.isArray(node)) return node.map(clean).filter(item => item !== undefined);
    const row = node as Record<string, unknown>;
    if ([row.questionId, row.parentQuestionId].some(id => typeof id === 'string' && privateIds.has(id)) ||
      (typeof row.id === 'string' && privateIds.has(row.id) && ('answer' in row || 'answerText' in row || 'prompt' in row))) return undefined;
    return Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'spotlightDrafts').map(([key, child]) => [key, clean(child)]));
  };
  return clean(value) as T;
}

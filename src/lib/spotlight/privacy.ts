import { prisma } from "@/lib/prisma";

/** Public/editorial boundary. Never trust projection labels to identify drafts. */
export async function stripPrivateInterviewData<T>(value: T): Promise<T> {
  const candidates = new Set<string>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object" || node instanceof Date) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const row = node as Record<string, unknown>;
    for (const key of [
      "id",
      "questionId",
      "question_id",
      "parentQuestionId",
      "parent_question_id",
    ]) {
      if (typeof row[key] === "string") candidates.add(row[key]);
    }
    for (const [key, child] of Object.entries(row))
      if (key !== "spotlightDrafts") {
        candidates.add(key);
        visit(child);
      }
  };
  visit(value);
  const identities = candidates.size
    ? await prisma.spotlightQuestion.findMany({
        where: { id: { in: Array.from(candidates) } },
        select: { id: true },
      })
    : [];
  const privateIds = new Set(identities.map((row) => row.id));
  const clean = (node: unknown): unknown => {
    if (!node || typeof node !== "object" || node instanceof Date) return node;
    if (Array.isArray(node))
      return node.map(clean).filter((item) => item !== undefined);
    const row = node as Record<string, unknown>;
    if (
      [
        row.id,
        row.questionId,
        row.question_id,
        row.parentQuestionId,
        row.parent_question_id,
      ].some((id) => typeof id === "string" && privateIds.has(id))
    )
      return undefined;
    return Object.fromEntries(
      Object.entries(row)
        .filter(([key]) => key !== "spotlightDrafts" && !privateIds.has(key))
        .map(([key, child]) => [key, clean(child)]),
    );
  };
  return clean(value) as T;
}

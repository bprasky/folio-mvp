import { prisma } from '@/lib/prisma';

/**
 * Sync answers FROM EditorialInterviewAnswer table TO ProjectPost.provenance
 *
 * This is the reverse of syncInterviewAnswers.ts (which syncs provenance → EditorialInterviewAnswer).
 * Called at interview completion to populate provenance so all existing consumers
 * (drafts, verify, followups, generation) can see InterviewFlow answers.
 */

// ---- helpers (duplicated from posting/interview/route.ts to avoid coupling) ----

const ALLOWED_SECTIONS = new Set([
  'designIntent', 'materialsMethod', 'collaboration', 'emotionalCore', 'insightsReflection', 'lightningRound',
  'why', 'who', 'what', 'where', 'when', 'how',
]);

function slugify(s?: string) {
  return (s ?? '').toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 64);
}

function deriveSection(qid?: string, prompt?: string): string {
  const cand = (qid ?? '').split('-')[0] || slugify(prompt).split('-')[0];
  if (ALLOWED_SECTIONS.has(cand)) return cand;
  return 'how';
}

function deepMerge(a: any, b: any): any {
  if (Array.isArray(a) || Array.isArray(b)) return b ?? a;
  if (a && typeof a === 'object' && b && typeof b === 'object') {
    const out: any = { ...a };
    for (const [k, v] of Object.entries(b)) {
      out[k] = deepMerge(a[k], v);
    }
    return out;
  }
  return b ?? a;
}

// ---- main export ----

export interface SyncResult {
  answerCount: number;
  /** Formatted answers ready for answersOverride */
  answers: Array<{
    questionId: string;
    section: string;
    prompt: string;
    answer: string;
    role: string;
    isFollowUp: false;
  }>;
  /** Formatted follow-ups ready for followupsOverride */
  followups: Array<{
    questionId: string;
    section: string;
    prompt: string;
    answer: string;
    role: string;
    isFollowUp: true;
  }>;
}

export async function syncEditorialAnswersToProvenance(
  projectId: string
): Promise<SyncResult> {
  // 1. Read all answers from EditorialInterviewAnswer
  const editorialInterview = await prisma.editorialInterview.findUnique({
    where: { projectId },
    include: {
      answers: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!editorialInterview || editorialInterview.answers.length === 0) {
    return { answerCount: 0, answers: [], followups: [] };
  }

  // 2. Convert to provenance answer shape
  const allFormatted = editorialInterview.answers.map((a) => ({
    questionId: a.questionId,
    section: deriveSection(a.questionId, a.questionText || undefined),
    prompt: a.questionText || a.questionId,
    answer: a.answerText,
    role: 'DESIGNER' as const,
    isFollowUp: a.isFollowUp,
    linkedImageId: a.linkedImageId || undefined,
    linkedProductId: a.linkedProductId || undefined,
    questionSource: a.questionSource || (a.isFollowUp ? 'follow_up' : 'base_question'),
    aiClassificationAttribute: a.aiClassificationAttribute || undefined,
  }));

  const baseAnswers = allFormatted
    .filter((a) => !a.isFollowUp)
    .map((a) => ({ ...a, isFollowUp: false as const }));
  const followupAnswers = allFormatted
    .filter((a) => a.isFollowUp)
    .map((a) => ({ ...a, isFollowUp: true as const }));

  // 3. Get image order from project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      images: {
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  const imageOrder = project?.images.map((img) => img.id) || [];

  // 4. Find or create ProjectPost, then merge into provenance
  let post = await prisma.projectPost.findUnique({
    where: { projectId },
    select: { provenance: true },
  });

  if (!post) {
    const { makeSlug } = await import('@/lib/posting/slug');
    const projectData = await prisma.project.findUnique({
      where: { id: projectId },
      select: { title: true },
    });
    const slug = makeSlug(projectData?.title || undefined, projectId);
    post = await prisma.projectPost.create({
      data: {
        projectId,
        slug,
        status: 'DRAFT',
        provenance: {},
      },
      select: { provenance: true },
    });
  }

  const existingProvenance = (post.provenance as any) || {};

  const nextInterviewPayload = {
    ...(existingProvenance.interview?.payload ?? {}),
    selectedQuestionIds: editorialInterview.selectedQuestionIds || [],
    answers: baseAnswers,
    followups: followupAnswers,
    imageOrder,
  };

  const nextProvenance = deepMerge(existingProvenance, {
    interview: {
      ...(existingProvenance.interview ?? {}),
      payload: nextInterviewPayload,
      // legacy mirror for b/c
      answers: nextInterviewPayload.answers,
    },
  });

  await prisma.projectPost.update({
    where: { projectId },
    data: { provenance: nextProvenance as any },
  });

  console.log('[syncEditorialAnswersToProvenance] Synced', {
    projectId,
    baseAnswers: baseAnswers.length,
    followups: followupAnswers.length,
    imageOrder: imageOrder.length,
  });

  return {
    answerCount: allFormatted.length,
    answers: baseAnswers,
    followups: followupAnswers,
  };
}

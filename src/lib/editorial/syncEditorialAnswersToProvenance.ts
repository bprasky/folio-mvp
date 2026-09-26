import { assertLegacyInterviewAllowed } from '@/lib/spotlight/legacyBoundary';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

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

/**
 * The category to write back into provenance for one projected answer.
 *
 * This function is the fix for the worse half of the category loss. It used to
 * be `deriveSection(a.questionId, a.questionText)` unconditionally, which meant
 * every trip through here OVERWROTE the canonical provenance value with a guess
 * — and `deriveSection` guesses `'how'` for anything it does not recognise,
 * which is every questionId this codebase currently mints (`project-<CAT>-<uuid>`
 * splits to `project`, a cuid splits to itself, `auto-<idx>` to `auto`). So a
 * project completed through InterviewFlow came out with its whole interview
 * relabelled `'how'`, and the store the new `questionCategory` column depends on
 * was corrupted by the same pass that populates it.
 *
 * Now the stored value wins whenever there is one. The derivation survives only
 * as the last resort for rows written before the column existed, where guessing
 * is still better than dropping the field entirely — those rows are already
 * carrying whatever `deriveSection` said, so this preserves their behaviour
 * rather than changing it.
 */
function categoryFor(a: { questionCategory: string | null; questionId: string; questionText: string | null }): string {
  if (a.questionCategory && ALLOWED_SECTIONS.has(a.questionCategory)) return a.questionCategory;
  return deriveSection(a.questionId, a.questionText || undefined);
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
  assertLegacyInterviewAllowed(projectId);

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
    section: categoryFor(a),
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
    select: { provenance: true, updatedAt: true },
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
      select: { provenance: true, updatedAt: true },
    });
  }

  const existingProvenance = (post.provenance as any) || {};
  if (existingProvenance.interview?.guided) {
    throw Object.assign(new Error('Continue the saved guided interview. Legacy completion cannot replace its answer history.'), { status: 409 });
  }

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

  const saved = await prisma.projectPost.updateMany({
    where: { projectId, updatedAt: post.updatedAt, provenance: { equals: post.provenance === null ? Prisma.DbNull : post.provenance } },
    data: { provenance: nextProvenance as any },
  });
  if (saved.count !== 1) throw Object.assign(new Error('The interview changed during completion. Reload before continuing.'), { status: 409 });

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

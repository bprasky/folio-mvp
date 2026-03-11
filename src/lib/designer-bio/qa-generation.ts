/**
 * Profile Q&A Question Generation
 *
 * Generates contextual Q&A questions based on:
 * - Bio interview data (initial seed after bio publishes)
 * - Project publishing activity
 * - Vendor affinity patterns
 * - Platform milestones
 */

import Anthropic from '@anthropic-ai/sdk';
import { callLLM } from '@/lib/posting/llmClient';
import { prisma } from '@/lib/prisma';
import { QA_MAX_PENDING, QA_MIN_GAP_DAYS, QA_INITIAL_SEED_COUNT } from './constants';
import type { QACategory, QASource } from './constants';

type GeneratedQuestion = {
  question: string;
  category: QACategory;
};

/**
 * Check whether new questions can be generated for a user.
 * Enforces the max pending cap and minimum gap between generations.
 */
export async function canGenerateQuestions(userId: string): Promise<boolean> {
  const pendingCount = await prisma.profileQA.count({
    where: { userId, status: 'pending' },
  });

  if (pendingCount >= QA_MAX_PENDING) {
    return false;
  }

  // Check minimum gap since last generation
  const lastGenerated = await prisma.profileQA.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  if (lastGenerated) {
    const daysSince = (Date.now() - lastGenerated.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < QA_MIN_GAP_DAYS) {
      return false;
    }
  }

  return true;
}

/**
 * Generate the initial seed batch of Q&A questions after bio publishes.
 * These are personality/taste questions based on the bio and website data.
 */
export async function generateInitialSeedQuestions(
  userId: string,
  folioBio: string,
  interviewAnswers: Array<{ question: string; answer: string }>,
  scrapedData?: Record<string, unknown> | null
): Promise<void> {
  const anthropic = new Anthropic();

  const qaBlock = interviewAnswers
    .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
    .join('\n\n');

  const scrapedContext = scrapedData
    ? `\n\nWebsite data:\n${JSON.stringify(scrapedData, null, 2)}`
    : '';

  const result = await callLLM(
    async () => {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        system: `You are generating profile interview questions for a designer's "In Their Words" section. These questions will appear on their public profile for visitors to read.

The goal: questions that reveal personality, taste, conviction, and character. Think magazine interview — the questions that make readers feel like they KNOW this person.

DO NOT ask questions that the bio already answers well.
DO NOT ask generic questions that could apply to anyone.
DO ask questions about taste, instinct, strong opinions, and surprises.

Generate ${QA_INITIAL_SEED_COUNT.min}-${QA_INITIAL_SEED_COUNT.max} questions.

Return JSON array: [{ "question": "...", "category": "personality|preference|conviction" }, ...]`,
        messages: [
          {
            role: 'user',
            content: `FOLIO BIO:\n${folioBio}\n\nINTERVIEW ANSWERS:\n${qaBlock}${scrapedContext}\n\nGenerate initial profile Q&A questions.`,
          },
        ],
        max_tokens: 800,
        temperature: 0.8,
      });

      const content = message.content[0]?.type === 'text' ? message.content[0].text : null;
      if (!content) throw new Error('No content in response');
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned);
    },
    {
      modelName: 'claude-sonnet-4-20250514',
      maxRetries: 2,
      contextHint: 'qa_initial_seed',
    }
  );

  if (!result.ok) {
    console.error('[generateInitialSeedQuestions] LLM failed:', result.code);
    return;
  }

  const questions = Array.isArray(result.data) ? result.data : [];

  // Save to database
  for (const q of questions.slice(0, QA_INITIAL_SEED_COUNT.max)) {
    await prisma.profileQA.create({
      data: {
        userId,
        question: q.question,
        category: q.category || 'personality',
        source: 'initial_seed',
        status: 'pending',
      },
    });
  }
}

/**
 * Generate questions triggered by a project publication.
 */
export async function generateProjectQuestions(
  userId: string,
  projectId: string,
  projectTitle: string
): Promise<void> {
  if (!(await canGenerateQuestions(userId))) return;

  const anthropic = new Anthropic();

  // Get the designer's bio context
  const bio = await prisma.designerBio.findUnique({
    where: { userId },
    select: { folioBio: true },
  });

  // Get their published project count
  const projectCount = await prisma.project.count({
    where: {
      OR: [{ designerId: userId }, { ownerId: userId }],
      isPublic: true,
    },
  });

  const result = await callLLM(
    async () => {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        system: `Generate 0-2 profile interview questions for a designer who just published a new project. Only generate questions if genuinely interesting ones emerge — don't force it.

Context:
- This is their project #${projectCount} on the platform
- Project title: "${projectTitle}"
${bio?.folioBio ? `- Designer bio: ${bio.folioBio.substring(0, 500)}` : ''}

If the project count suggests interesting questions (e.g., 3+ projects → patterns), lean into that.

Return JSON array: [{ "question": "...", "category": "project|evolution" }, ...]
Return empty array [] if no genuinely interesting question comes to mind.`,
        messages: [
          {
            role: 'user',
            content: `Generate questions based on the project "${projectTitle}" being published. This is project #${projectCount}.`,
          },
        ],
        max_tokens: 400,
        temperature: 0.7,
      });

      const content = message.content[0]?.type === 'text' ? message.content[0].text : null;
      if (!content) throw new Error('No content in response');
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned);
    },
    {
      modelName: 'claude-sonnet-4-20250514',
      maxRetries: 1,
      contextHint: 'qa_project_trigger',
    }
  );

  if (!result.ok) return;

  const questions = Array.isArray(result.data) ? result.data : [];
  for (const q of questions.slice(0, 2)) {
    await prisma.profileQA.create({
      data: {
        userId,
        question: q.question,
        category: q.category || 'project',
        source: 'project_trigger',
        triggerType: 'project_published',
        triggerEntityId: projectId,
        status: 'pending',
      },
    });
  }
}

/**
 * Generate a question triggered by vendor affinity (same vendor tagged 3+ times).
 */
export async function generateVendorAffinityQuestion(
  userId: string,
  vendorId: string,
  vendorName: string,
  tagCount: number
): Promise<void> {
  if (!(await canGenerateQuestions(userId))) return;

  await prisma.profileQA.create({
    data: {
      userId,
      question: `You keep coming back to ${vendorName}. What is it about their work?`,
      category: 'vendor',
      source: 'vendor_trigger',
      triggerType: 'vendor_tagged',
      triggerEntityId: vendorId,
      status: 'pending',
    },
  });
}

/**
 * Generate a question triggered by a platform milestone.
 */
export async function generateMilestoneQuestion(
  userId: string,
  milestoneType: string,
  context?: string
): Promise<void> {
  if (!(await canGenerateQuestions(userId))) return;

  const milestoneQuestions: Record<string, string> = {
    editorial_feature: 'You just made the editorial edition. What does that kind of recognition mean to you?',
    saves_50: 'Your work is starting to get noticed — 50 saves across your projects. What resonates most with the people saving your work?',
    saves_100: 'Over 100 saves on your projects. Why do you think your work connects with people?',
    saves_500: 'Your projects have been saved 500 times. That\'s real influence. What does it mean to you to shape how people think about their spaces?',
  };

  const question = milestoneQuestions[milestoneType];
  if (!question) return;

  await prisma.profileQA.create({
    data: {
      userId,
      question: context ? question.replace(/your projects/i, `"${context}"`) : question,
      category: 'milestone',
      source: 'milestone_trigger',
      triggerType: 'milestone_reached',
      status: 'pending',
    },
  });
}

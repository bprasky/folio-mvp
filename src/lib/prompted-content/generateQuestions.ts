/**
 * Prompted Content — Bio-Reflective Question Generation (Phase 1)
 *
 * Generates tailored questions from a designer's completed bio interview.
 * Uses the same Anthropic SDK + callLLM pattern as qa-generation.ts.
 */

import Anthropic from '@anthropic-ai/sdk';
import { callLLM } from '@/lib/posting/llmClient';
import { prisma } from '@/lib/prisma';

const MAX_PENDING_QUESTIONS = 3;
const QUESTIONS_PER_BATCH = 3;

interface GeneratedQuestion {
  questionText: string;
  bioExcerptRef: string; // Which part of the bio inspired this question
  cluster: string; // Atelier signal cluster, e.g. 'material_philosophy'
}

/**
 * Check whether new prompted questions should be generated for a user.
 */
export async function shouldGenerateQuestions(userId: string): Promise<boolean> {
  const pendingCount = await prisma.promptedQuestion.count({
    where: {
      targetUserId: userId,
      status: { in: ['GENERATED', 'DELIVERED'] },
    },
  });

  return pendingCount < MAX_PENDING_QUESTIONS;
}

/**
 * Generate bio-reflective questions for a designer based on their completed bio.
 * Returns the created PromptedQuestion records.
 */
export async function generateBioReflectiveQuestions(userId: string) {
  // Load the designer's bio
  const bio = await prisma.designerBio.findUnique({
    where: { userId },
    select: {
      folioBio: true,
      interviewAnswers: true,
      status: true,
    },
  });

  if (!bio || !bio.folioBio || bio.status === 'empty') {
    console.log('[prompted-content] No completed bio for user:', userId);
    return [];
  }

  // Load existing questions to avoid duplicates
  const existingQuestions = await prisma.promptedQuestion.findMany({
    where: { targetUserId: userId },
    select: { questionText: true },
  });
  const existingTexts = existingQuestions.map((q) => q.questionText);

  // Format interview answers
  const answers = Array.isArray(bio.interviewAnswers) ? bio.interviewAnswers : [];
  const qaBlock = (answers as Array<{ question: string; answer: string }>)
    .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
    .join('\n\n');

  // Also load existing ProfileQA for context
  const profileQAs = await prisma.profileQA.findMany({
    where: { userId, status: 'answered' },
    select: { question: true, answer: true },
    take: 10,
  });
  const qaContext = profileQAs
    .map((qa) => `Q: ${qa.question}\nA: ${qa.answer ?? ''}`)
    .join('\n\n');

  const anthropic = new Anthropic();

  const result = await callLLM(
    async () => {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        system: `You are generating questions for professionals in the interior design industry.
These questions will appear as beautifully typeset cards in a design magazine feed.

YOU HAVE ACCESS TO:
- The designer's bio interview (their self-narrative, philosophy, origin story)
- Their existing profile Q&A responses

CRITICAL RULES:
- Every question must trace back to something specific the designer said in their bio or interview.
- Questions should feel like they came from a thoughtful colleague who studied their work, not from a platform trying to extract content.
- Focus on wins, arrivals, and genuine curiosity about craft decisions.
- Never use: "Can you share...", "Tell us about a time...", "What insights..."
- Never ask about failures, compromises, or regrets unless framed as "what did that teach you."
- Be specific. Reference materials, spaces, decisions, places — not abstractions.
- Maximum 2 sentences per question. The best questions are one sentence.
- Questions should be answerable in 30-90 seconds of speaking or 2-4 sentences of typing.
- Do NOT repeat or closely paraphrase any existing questions provided below.

Return a JSON array of exactly ${QUESTIONS_PER_BATCH} objects:
[{
  "questionText": "The question text",
  "bioExcerptRef": "A brief quote or paraphrase of the bio content that inspired this question",
  "cluster": "A thematic cluster tag, e.g. 'material_philosophy', 'client_navigation', 'craft_decisions', 'design_origin', 'space_philosophy'"
}]`,
        messages: [
          {
            role: 'user',
            content: `DESIGNER BIO:\n${bio.folioBio}\n\nINTERVIEW ANSWERS:\n${qaBlock}\n\n${qaContext ? `EXISTING PROFILE Q&A:\n${qaContext}\n\n` : ''}${existingTexts.length > 0 ? `ALREADY ASKED (do not repeat):\n${existingTexts.join('\n')}\n\n` : ''}Generate ${QUESTIONS_PER_BATCH} bio-reflective questions for this designer.`,
          },
        ],
        max_tokens: 1200,
        temperature: 0.85,
      });

      const content = message.content[0]?.type === 'text' ? message.content[0].text : null;
      if (!content) throw new Error('No content in response');
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned) as GeneratedQuestion[];
    },
    {
      modelName: 'claude-sonnet-4-20250514',
      maxRetries: 2,
      contextHint: 'prompted_content_bio_reflective',
    }
  );

  if (!result.ok) {
    console.error('[prompted-content] Question generation failed:', result);
    return [];
  }

  const questions = Array.isArray(result.data) ? result.data : [];

  // Save to database
  const created = [];
  for (const q of questions.slice(0, QUESTIONS_PER_BATCH)) {
    if (!q.questionText) continue;

    const record = await prisma.promptedQuestion.create({
      data: {
        targetUserId: userId,
        questionText: q.questionText,
        questionType: 'BIO_REFLECTIVE',
        provenance: {
          sourceType: 'individual_bio',
          bioExcerptRef: q.bioExcerptRef || null,
        },
        atelierSignals: q.cluster
          ? {
              cluster: q.cluster,
              expectedSignals: [q.cluster],
            }
          : undefined,
        priority: 0.7,
        deliveryContext: 'feed_card',
        status: 'GENERATED',
      },
    });
    created.push(record);
  }

  console.log(`[prompted-content] Generated ${created.length} questions for user ${userId}`);
  return created;
}

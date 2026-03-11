/**
 * Designer Editorial Context
 *
 * Provides designer bio and Q&A data as context for editorial generation.
 * This is injected into editorial prompts so editorials can reference
 * the designer's philosophy, preferences, and convictions.
 */

import { prisma } from '@/lib/prisma';
import type { InterviewAnswer } from './constants';

/**
 * Get editorial context string for a designer.
 * Used when generating editorial content for any project.
 */
export async function getDesignerEditorialContext(userId: string): Promise<string> {
  const bio = await prisma.designerBio.findUnique({
    where: { userId },
  });

  let context = '';

  // The narrative bio
  if (bio?.folioBio) {
    context += `DESIGNER BIO:\n${bio.folioBio}\n\n`;
  }

  // Stated preferences from bio interview (high-signal)
  if (bio?.interviewAnswers) {
    const answers = bio.interviewAnswers as InterviewAnswer[];
    if (Array.isArray(answers) && answers.length > 0) {
      context += `DESIGNER IN THEIR OWN WORDS (from bio interview):\n`;
      answers.forEach((a) => {
        context += `Q: ${a.question}\nA: ${a.answer}\n\n`;
      });
    }
  }

  // High-signal Q&A answers (preference and conviction categories)
  const revealingQAs = await prisma.profileQA.findMany({
    where: {
      userId,
      status: 'answered',
      category: { in: ['preference', 'conviction', 'personality'] },
    },
    orderBy: { answeredAt: 'desc' },
    take: 5,
  });

  if (revealingQAs.length > 0) {
    context += `DESIGNER PREFERENCES & CONVICTIONS (from profile Q&A):\n`;
    revealingQAs.forEach((qa) => {
      context += `Q: ${qa.question}\nA: ${qa.answer}\n\n`;
    });
  }

  return context;
}

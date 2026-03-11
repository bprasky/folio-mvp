/**
 * Bio Interview Question Generation
 *
 * Two paths:
 * - Blank Slate: No website bio found, full foundational question set
 * - Website Exists: Bio scraped, skip basics, go deeper
 *
 * Questions are role-aware (DESIGNER, ARCHITECT, BUILDER).
 */

import Anthropic from '@anthropic-ai/sdk';
import { callLLM } from '@/lib/posting/llmClient';
import type { InterviewAnswer } from './constants';

// ── Static base questions (Blank Slate) ──────────────────────────

const DESIGNER_BASE_QUESTIONS = [
  {
    id: 'bio-designer-1',
    question: 'Where did you study, and how did that shape your eye?',
  },
  {
    id: 'bio-designer-2',
    question: 'How did you fall in love with design? Was there a moment?',
  },
  {
    id: 'bio-designer-3',
    question: 'Where do you do most of your work? Is there a region or type of space you keep coming back to?',
  },
  {
    id: 'bio-designer-4',
    question: 'How would you describe the feeling you want someone to have when they walk into one of your rooms?',
  },
  {
    id: 'bio-designer-5',
    question: 'Is there a material, texture, or element that shows up in almost every project?',
  },
  {
    id: 'bio-designer-6',
    question: 'What do you believe about design that most people in this industry would push back on?',
  },
];

const ARCHITECT_BASE_QUESTIONS = [
  {
    id: 'bio-architect-1',
    question: 'Where did you study architecture, and what was the perspective that stuck with you?',
  },
  {
    id: 'bio-architect-2',
    question: 'What drew you to architecture over other disciplines?',
  },
  {
    id: 'bio-architect-3',
    question: 'Where do most of your projects sit geographically? Does the landscape influence your work?',
  },
  {
    id: 'bio-architect-4',
    question: 'How do you think about the relationship between a building\'s structure and its interior life?',
  },
  {
    id: 'bio-architect-5',
    question: 'Is there a material or structural approach you keep returning to?',
  },
  {
    id: 'bio-architect-6',
    question: 'What\'s a conviction you hold about architecture that most of your peers wouldn\'t agree with?',
  },
];

const BUILDER_BASE_QUESTIONS = [
  {
    id: 'bio-builder-1',
    question: 'How did you get into building? Was it family, trade school, or something else?',
  },
  {
    id: 'bio-builder-2',
    question: 'What type of work do you specialize in? Is there a craft within building that you love most?',
  },
  {
    id: 'bio-builder-3',
    question: 'Where do most of your projects happen?',
  },
  {
    id: 'bio-builder-4',
    question: 'What\'s the detail most people would never notice but you\'d never skip?',
  },
  {
    id: 'bio-builder-5',
    question: 'Is there a material you love working with? One you avoid?',
  },
  {
    id: 'bio-builder-6',
    question: 'What do you wish designers and architects understood about the building process?',
  },
];

const BASE_QUESTIONS_BY_ROLE: Record<string, Array<{ id: string; question: string }>> = {
  DESIGNER: DESIGNER_BASE_QUESTIONS,
  ARCHITECT: ARCHITECT_BASE_QUESTIONS,
  BUILDER: BUILDER_BASE_QUESTIONS,
};

// ── Public API ───────────────────────────────────────────────────

export type BioQuestion = {
  id: string;
  question: string;
  round: 'base' | 'followup';
};

/**
 * Get base questions for the Blank Slate path (no website bio).
 */
export function getBlankSlateQuestions(role: string): BioQuestion[] {
  const questions = BASE_QUESTIONS_BY_ROLE[role] || BASE_QUESTIONS_BY_ROLE.DESIGNER;
  return questions.map((q) => ({ ...q, round: 'base' as const }));
}

/**
 * Generate questions for the Website Exists path.
 * AI reads scraped data and generates contextual questions that skip basics.
 */
export async function generateWebsiteContextQuestions(
  scrapedData: Record<string, unknown>,
  role: string
): Promise<BioQuestion[]> {
  const anthropic = new Anthropic();

  const roleLabel = role === 'ARCHITECT' ? 'architect' : role === 'BUILDER' ? 'builder' : 'interior designer';

  const result = await callLLM(
    async () => {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        system: `You are an editorial interviewer for a design industry publication. You've read a ${roleLabel}'s website and need to generate interview questions that go DEEPER than what the website already tells us.

Guidelines:
- Skip anything the website already answers clearly (name, location, firm name, basic specialties)
- Dig into things the website mentions but doesn't explain
- Probe preferences and convictions the website hints at
- Ask the questions the website bio SHOULD have answered but didn't
- Always include: the feeling question, the material/product question, and the conviction question
- Generate 4-6 questions total
- Each question should be conversational but substantive

Return a JSON array of objects: [{ "id": "web-q-1", "question": "..." }, ...]`,
        messages: [
          {
            role: 'user',
            content: `Here is the scraped website data for this ${roleLabel}:\n\n${JSON.stringify(scrapedData, null, 2)}\n\nGenerate 4-6 interview questions that go deeper than what the website tells us.`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const content = message.content[0]?.type === 'text' ? message.content[0].text : null;
      if (!content) throw new Error('No content in response');
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned);
    },
    {
      modelName: 'claude-sonnet-4-20250514',
      maxRetries: 2,
      contextHint: 'bio_website_questions',
    }
  );

  if (!result.ok) {
    console.error('[generateWebsiteContextQuestions] LLM call failed:', result.code);
    // Fall back to a subset of blank slate questions (the deeper ones)
    const fallback = getBlankSlateQuestions(role);
    return fallback.slice(3); // feeling, material, conviction questions
  }

  const questions = Array.isArray(result.data) ? result.data : [];
  return questions.map((q: { id?: string; question: string }, i: number) => ({
    id: q.id || `web-q-${i + 1}`,
    question: q.question,
    round: 'base' as const,
  }));
}

/**
 * Generate Level 2 follow-up questions based on the designer's base answers.
 * These reference what the designer actually said.
 */
export async function generateFollowUpQuestions(
  baseAnswers: InterviewAnswer[],
  role: string,
  scrapedData?: Record<string, unknown> | null
): Promise<BioQuestion[]> {
  if (baseAnswers.length < 3) {
    return [];
  }

  const anthropic = new Anthropic();
  const roleLabel = role === 'ARCHITECT' ? 'architect' : role === 'BUILDER' ? 'builder' : 'interior designer';

  const result = await callLLM(
    async () => {
      const qaBlock = baseAnswers
        .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
        .join('\n\n');

      const scrapedContext = scrapedData
        ? `\n\nWebsite data available:\n${JSON.stringify(scrapedData, null, 2)}`
        : '';

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        system: `You are an editorial interviewer for a design publication. You've just heard a ${roleLabel}'s initial answers and now need to generate follow-up questions that dig deeper into the most interesting threads.

Guidelines:
- Reference specific things the designer said in their answers
- Ask "why" and "how" questions that go one level deeper
- Focus on stories, convictions, and the emotional dimension
- Generate 3-5 follow-up questions
- Each question should feel like a natural continuation of the conversation

Return a JSON array: [{ "id": "followup-1", "question": "..." }, ...]`,
        messages: [
          {
            role: 'user',
            content: `Here are the ${roleLabel}'s interview answers so far:\n\n${qaBlock}${scrapedContext}\n\nGenerate 3-5 thoughtful follow-up questions.`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const content = message.content[0]?.type === 'text' ? message.content[0].text : null;
      if (!content) throw new Error('No content in response');
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned);
    },
    {
      modelName: 'claude-sonnet-4-20250514',
      maxRetries: 2,
      contextHint: 'bio_followup_questions',
    }
  );

  if (!result.ok) {
    console.error('[generateFollowUpQuestions] LLM call failed:', result.code);
    return [];
  }

  const questions = Array.isArray(result.data) ? result.data : [];
  return questions.map((q: { id?: string; question: string }, i: number) => ({
    id: q.id || `followup-${i + 1}`,
    question: q.question,
    round: 'followup' as const,
  }));
}

/**
 * Round 3: Cross-pollinated questions
 * AI generates questions that reference what the other party shared
 * Creates a dialogue effect in the final narrative
 */

import OpenAI from 'openai';
import { callLLM } from '@/lib/posting/llmClient';
import { Round1Response, CollaborationQuestion } from './round1';
import { Round2Question } from './generateRound2';

export type Round3Question = CollaborationQuestion & {
  referencesParty: 'VENDOR' | 'DESIGNER'; // Which party's response this references
  referencedQuote: string; // The quote being referenced
  originalQuestionId: string; // Which question the quote came from
};

export type Round3Data = {
  questions: Round3Question[];
  responses: Round1Response[];
  completedAt?: string;
};

const ROUND3_SYSTEM_PROMPT = `You are crafting the final round of questions for a collaboration story interview. This round creates a dialogue effect by having each party respond to something the other shared.

Your goal is to:
1. Select meaningful quotes from the other party's responses
2. Frame questions that invite reflection, reaction, or expansion on those themes
3. Create moments of connection and discovery between the parties
4. Maintain editorial quality - these will be published

The questions should feel like a natural conversation, as if the parties were in a room together and one just heard what the other said.

Output format: JSON array of question objects with:
- id: unique identifier
- prompt: the question to ask
- referencedQuote: the exact quote from the other party being referenced
- originalQuestionId: which question the quote came from
- category: one of "relationship", "project", "process", "philosophy", "outcome"`;

type AllResponses = {
  round1: Round1Response[];
  round2: Round1Response[];
};

async function generateCrossPollinated(
  targetRole: 'VENDOR' | 'DESIGNER',
  otherPartyResponses: AllResponses,
  otherPartyQuestions: (CollaborationQuestion | Round2Question)[]
): Promise<Round3Question[]> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const otherRole = targetRole === 'VENDOR' ? 'DESIGNER' : 'VENDOR';

  // Build context from other party's responses
  const allResponses = [...otherPartyResponses.round1, ...otherPartyResponses.round2];
  const qaContext = allResponses.map(response => {
    const question = otherPartyQuestions.find(q => q.id === response.questionId);
    return {
      questionId: response.questionId,
      question: question?.prompt || 'Unknown question',
      answer: response.answer,
    };
  });

  const userPrompt = `Generate 3-4 cross-pollinated questions for a ${targetRole.toLowerCase()} based on what the ${otherRole.toLowerCase()} shared.

The ${otherRole.toLowerCase()}'s responses:
${qaContext.map(qa => `
Question: ${qa.question}
Answer: "${qa.answer}"
[Question ID: ${qa.questionId}]
`).join('\n')}

Create questions that:
1. Quote a specific, meaningful part of the ${otherRole.toLowerCase()}'s response
2. Invite the ${targetRole.toLowerCase()} to react, reflect, or expand on that theme
3. Feel conversational - as if they just heard the other person say this
4. Explore complementary perspectives on the collaboration

Examples of good prompts:
- "The ${otherRole.toLowerCase()} mentioned '[quote]'. How does hearing that resonate with your experience?"
- "When asked about [topic], they said '[quote]'. What's your perspective on this?"
- "[Quote]. Does this match your memory of that moment/project/interaction?"

Return a JSON array of 3-4 questions.`;

  const result = await callLLM(
    async () => {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: ROUND3_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('No content in response');

      const parsed = JSON.parse(content);
      return parsed.questions || parsed;
    },
    {
      modelName: 'gpt-4o',
      maxRetries: 2,
      contextHint: 'collaboration_round3_generation',
    }
  );

  if (!result.ok) {
    console.error('[generateRound3] LLM call failed:', result.code, result.message);
    return getFallbackRound3Questions(targetRole, qaContext);
  }

  // Validate and transform response
  const questions = Array.isArray(result.data) ? result.data : [];
  return questions.map((q: any, index: number) => ({
    id: q.id || `r3-${targetRole.toLowerCase()}-${index + 1}`,
    role: targetRole,
    category: q.category || 'relationship',
    prompt: q.prompt,
    referencesParty: otherRole,
    referencedQuote: q.referencedQuote || '',
    originalQuestionId: q.originalQuestionId || qaContext[0]?.questionId || 'unknown',
  }));
}

// Fallback questions using basic template
function getFallbackRound3Questions(
  targetRole: 'VENDOR' | 'DESIGNER',
  otherResponses: { questionId: string; question: string; answer: string }[]
): Round3Question[] {
  const otherRole = targetRole === 'VENDOR' ? 'DESIGNER' : 'VENDOR';

  // Pick the most substantive responses (by length as proxy)
  const sortedResponses = [...otherResponses]
    .filter(r => r.answer.length > 50)
    .sort((a, b) => b.answer.length - a.answer.length)
    .slice(0, 3);

  if (sortedResponses.length === 0) {
    // Ultra fallback
    return [
      {
        id: `r3-${targetRole.toLowerCase()}-1`,
        role: targetRole,
        category: 'relationship',
        prompt: `The ${otherRole.toLowerCase()} spoke highly of your collaboration. What do you think makes this partnership work?`,
        referencesParty: otherRole,
        referencedQuote: '[Partnership reflection]',
        originalQuestionId: 'fallback',
      },
    ];
  }

  return sortedResponses.map((response, index) => {
    // Extract a meaningful snippet (first sentence or ~100 chars)
    const snippet = extractSnippet(response.answer);

    return {
      id: `r3-${targetRole.toLowerCase()}-${index + 1}`,
      role: targetRole,
      category: inferCategory(response.question),
      prompt: `The ${otherRole.toLowerCase()} mentioned: "${snippet}" — how does this resonate with your experience?`,
      referencesParty: otherRole,
      referencedQuote: snippet,
      originalQuestionId: response.questionId,
    };
  });
}

function extractSnippet(text: string, maxLen = 120): string {
  // Try to get first sentence
  const sentenceMatch = text.match(/^[^.!?]+[.!?]/);
  if (sentenceMatch && sentenceMatch[0].length <= maxLen) {
    return sentenceMatch[0].trim();
  }

  // Otherwise truncate at word boundary
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.slice(0, lastSpace) + '...';
}

function inferCategory(question: string): 'relationship' | 'project' | 'process' | 'philosophy' | 'outcome' {
  const q = question.toLowerCase();
  if (q.includes('project') || q.includes('design')) return 'project';
  if (q.includes('process') || q.includes('collaborate') || q.includes('work')) return 'process';
  if (q.includes('philosophy') || q.includes('believe') || q.includes('value')) return 'philosophy';
  if (q.includes('outcome') || q.includes('influence') || q.includes('shaped')) return 'outcome';
  return 'relationship';
}

export async function generateRound3Questions(
  targetRole: 'VENDOR' | 'DESIGNER',
  otherPartyRound1: Round1Response[],
  otherPartyRound2: Round1Response[],
  otherPartyQuestions: (CollaborationQuestion | Round2Question)[]
): Promise<Round3Question[]> {
  const allResponses = {
    round1: otherPartyRound1,
    round2: otherPartyRound2,
  };

  if (allResponses.round1.length === 0 && allResponses.round2.length === 0) {
    console.warn('[generateRound3] No responses from other party');
    return [];
  }

  try {
    return await generateCrossPollinated(targetRole, allResponses, otherPartyQuestions);
  } catch (error) {
    console.error('[generateRound3] Failed to generate questions:', error);
    const qaContext = [...otherPartyRound1, ...otherPartyRound2].map(r => ({
      questionId: r.questionId,
      question: otherPartyQuestions.find(q => q.id === r.questionId)?.prompt || '',
      answer: r.answer,
    }));
    return getFallbackRound3Questions(targetRole, qaContext);
  }
}

// Helper to check if round 3 is complete
export function isRound3Complete(responses: Round1Response[], minRequired = 2): boolean {
  return responses.length >= minRequired;
}

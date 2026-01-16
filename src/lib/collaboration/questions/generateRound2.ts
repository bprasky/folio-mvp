/**
 * Round 2: AI-generated follow-up questions based on Round 1 responses
 * These questions dig deeper into the themes and stories that emerged
 */

import OpenAI from 'openai';
import { callLLM } from '@/lib/posting/llmClient';
import { Round1Response, CollaborationQuestion, getRound1Questions } from './round1';

export type Round2Question = CollaborationQuestion & {
  derivedFrom: string; // ID of the Round 1 question this follows up on
  context: string; // Why this follow-up is relevant
};

export type Round2Data = {
  questions: Round2Question[];
  responses: Round1Response[];
  completedAt?: string;
};

const ROUND2_SYSTEM_PROMPT = `You are an expert editorial interviewer for a design industry publication. Your role is to generate thoughtful follow-up questions that dig deeper into the stories and themes that emerged from initial interview responses.

Guidelines:
- Ask questions that elicit specific stories, examples, and details
- Build on interesting threads from the initial responses
- Maintain a conversational but professional tone
- Focus on the human elements of collaboration
- Avoid generic or surface-level questions
- Each question should feel natural and connected to what was shared

Output format: JSON array of question objects with:
- id: unique identifier (format: "r2-{role}-{number}")
- derivedFrom: the Round 1 question ID this follows up on
- prompt: the follow-up question
- context: brief explanation of why this follow-up is valuable
- category: one of "relationship", "project", "process", "philosophy", "outcome"`;

async function generateFollowUpsWithLLM(
  role: 'VENDOR' | 'DESIGNER',
  round1Questions: CollaborationQuestion[],
  round1Responses: Round1Response[]
): Promise<Round2Question[]> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Build context from Round 1 Q&A
  const qaContext = round1Responses.map(response => {
    const question = round1Questions.find(q => q.id === response.questionId);
    return {
      questionId: response.questionId,
      question: question?.prompt || 'Unknown question',
      answer: response.answer,
    };
  });

  const userPrompt = `Generate 4-6 thoughtful follow-up questions for a ${role.toLowerCase()} based on their Round 1 interview responses.

Round 1 Questions and Answers:
${qaContext.map(qa => `
Question (${qa.questionId}): ${qa.question}
Answer: ${qa.answer}
`).join('\n')}

Generate follow-up questions that:
1. Build on the most interesting or meaningful parts of their responses
2. Ask for specific examples, stories, or details
3. Explore themes that emerged across multiple answers
4. Dig into any hints of challenges, successes, or turning points

Return a JSON array of 4-6 questions.`;

  const result = await callLLM(
    async () => {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: ROUND2_SYSTEM_PROMPT },
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
      contextHint: 'collaboration_round2_generation',
    }
  );

  if (!result.ok) {
    console.error('[generateRound2] LLM call failed:', result.code, result.message);
    // Return fallback questions
    return getFallbackRound2Questions(role);
  }

  // Validate and transform response
  const questions = Array.isArray(result.data) ? result.data : [];
  return questions.map((q: any, index: number) => ({
    id: q.id || `r2-${role.toLowerCase()}-${index + 1}`,
    role,
    category: q.category || 'project',
    prompt: q.prompt,
    derivedFrom: q.derivedFrom || round1Responses[0]?.questionId || 'unknown',
    context: q.context || '',
    helper: q.helper,
  }));
}

// Fallback questions if LLM fails
function getFallbackRound2Questions(role: 'VENDOR' | 'DESIGNER'): Round2Question[] {
  if (role === 'VENDOR') {
    return [
      {
        id: 'r2-vendor-1',
        role: 'VENDOR',
        category: 'project',
        prompt: 'Can you walk us through a specific moment in a project where the collaboration felt particularly rewarding?',
        derivedFrom: 'v1-project-1',
        context: 'Seeks concrete story',
      },
      {
        id: 'r2-vendor-2',
        role: 'VENDOR',
        category: 'process',
        prompt: 'How has your communication style evolved through working together?',
        derivedFrom: 'v1-process-1',
        context: 'Explores growth',
      },
      {
        id: 'r2-vendor-3',
        role: 'VENDOR',
        category: 'relationship',
        prompt: 'What\'s something about this designer\'s approach that you\'ve learned from?',
        derivedFrom: 'v1-relationship-2',
        context: 'Mutual learning',
      },
      {
        id: 'r2-vendor-4',
        role: 'VENDOR',
        category: 'outcome',
        prompt: 'Has any specific feedback from this designer influenced your product development?',
        derivedFrom: 'v1-outcome-1',
        context: 'Tangible impact',
      },
    ];
  }

  return [
    {
      id: 'r2-designer-1',
      role: 'DESIGNER',
      category: 'project',
      prompt: 'Tell us about a specific design challenge where this vendor\'s products provided an unexpected solution.',
      derivedFrom: 'd1-project-2',
      context: 'Seeks concrete story',
    },
    {
      id: 'r2-designer-2',
      role: 'DESIGNER',
      category: 'process',
      prompt: 'How do you involve this vendor early in your design process versus others?',
      derivedFrom: 'd1-process-1',
      context: 'Process differentiation',
    },
    {
      id: 'r2-designer-3',
      role: 'DESIGNER',
      category: 'relationship',
      prompt: 'What\'s a conversation or interaction that exemplifies why this partnership works?',
      derivedFrom: 'd1-relationship-2',
      context: 'Concrete example',
    },
    {
      id: 'r2-designer-4',
      role: 'DESIGNER',
      category: 'philosophy',
      prompt: 'How do you talk to clients about this vendor\'s products or approach?',
      derivedFrom: 'd1-philosophy-1',
      context: 'Client perspective',
    },
  ];
}

export async function generateRound2Questions(
  role: 'VENDOR' | 'DESIGNER',
  round1Responses: Round1Response[]
): Promise<Round2Question[]> {
  if (round1Responses.length === 0) {
    console.warn('[generateRound2] No Round 1 responses provided');
    return getFallbackRound2Questions(role);
  }

  const round1Questions = getRound1Questions(role);

  try {
    return await generateFollowUpsWithLLM(role, round1Questions, round1Responses);
  } catch (error) {
    console.error('[generateRound2] Failed to generate questions:', error);
    return getFallbackRound2Questions(role);
  }
}

// Helper to check if round 2 is complete
export function isRound2Complete(responses: Round1Response[], minRequired = 3): boolean {
  return responses.length >= minRequired;
}

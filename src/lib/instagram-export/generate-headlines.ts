/**
 * Instagram export HEADLINES.
 *
 * This was called `generatePullQuotes` in `generate-quotes.ts`, which was a lie
 * with consequences: the prompt below asks for five scroll-stopping cover lines
 * and the model writes them, so anything sitting in a slot named "pull quote"
 * was editorial copy nobody said. The export UI already treated the result as a
 * headline (`selectedHeadline`); only the name disagreed.
 *
 * A headline is Folio's own line about the work and may be written. A quote is a
 * claim about what a person said and may not — those come from
 * `@/lib/instagram/extractQuotes`, which reads the article's already-verified
 * selections and never generates.
 */

import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '@/lib/ai/models';

const anthropic = new Anthropic();

function isAnthropicEnabled(): boolean {
  return (
    process.env.ANTHROPIC_ENABLED === 'true' &&
    Boolean(process.env.ANTHROPIC_API_KEY)
  );
}

export function extractTextFromBlocks(blocks: any): string {
  if (!blocks) return '';
  if (typeof blocks === 'string') return blocks;
  if (Array.isArray(blocks)) {
    return blocks
      .map((block: any) => {
        if (typeof block === 'string') return block;
        if (block.text) return block.text;
        if (block.content) return extractTextFromBlocks(block.content);
        if (block.children) return extractTextFromBlocks(block.children);
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }
  if (blocks.text) return blocks.text;
  return JSON.stringify(blocks).slice(0, 2000);
}

interface GenerateHeadlinesInput {
  postTitle: string;
  postSubtitle?: string;
  expandedBlocks: any;
  roomName?: string;
  interviewAnswers?: string;
  feedback?: string;
}

export async function generateHeadlineOptions(input: GenerateHeadlinesInput): Promise<string[]> {
  if (!isAnthropicEnabled()) {
    throw new Error('AI generation is not available');
  }

  const editorialText = extractTextFromBlocks(input.expandedBlocks);

  const prompt = `You are an editorial headline writer for a high-end interior design magazine.

Given this project editorial content:
Title: ${input.postTitle}
${input.postSubtitle ? `Subtitle: ${input.postSubtitle}` : ''}
Editorial body: ${editorialText.slice(0, 3000)}
Room focus: ${input.roomName || 'Full project'}
${input.interviewAnswers ? `Designer interview answers: ${input.interviewAnswers.slice(0, 2000)}` : ''}

Generate exactly 5 headline options. Each headline should:
- Be 4-10 words maximum
- Stop the scroll — provocative, intriguing, or emotionally resonant
- Tease a story without telling it
- Sound like something a creative director would place on a magazine cover
- NOT be generic ("Beautiful Kitchen Design") — be specific and editorial
- Reference the actual design decisions, challenges, or philosophy

${input.feedback ? `Direction from the designer: ${input.feedback}` : ''}

Return ONLY a JSON array of 5 strings. No other text.`;

  const response = await anthropic.messages.create({
    model: MODELS.sonnet,
    thinking: { type: 'disabled' },
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse quotes response');
  }

  return JSON.parse(jsonMatch[0]) as string[];
}

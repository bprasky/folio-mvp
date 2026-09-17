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

import { generateSocialText, parseSocialOptions, extractTextFromBlocks } from './generation';
import { HeadlineOptionsSchema } from './generation.schemas';
export { extractTextFromBlocks } from './generation';

interface GenerateHeadlinesInput {
  postTitle: string;
  postSubtitle?: string;
  expandedBlocks: any;
  roomName?: string;
  interviewAnswers?: string;
  feedback?: string;
}

export async function generateHeadlineOptions(input: GenerateHeadlinesInput): Promise<string[]> {
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

  return parseSocialOptions(await generateSocialText(prompt, 500), HeadlineOptionsSchema);
}

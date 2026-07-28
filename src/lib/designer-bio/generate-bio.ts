/**
 * Folio Bio Generation
 *
 * Generates a 200-400 word editorial narrative from interview answers,
 * scraped website data, and role context.
 */

import Anthropic from '@anthropic-ai/sdk';
import { callLLM } from '@/lib/posting/llmClient';
import type { InterviewAnswer } from './constants';
import { MODELS } from '@/lib/ai/models';
import { FOLIO_TONE } from '@/lib/interview/prompts/editorialTone';

type GenerateBioInput = {
  role: string;
  designerName: string;
  interviewAnswers: InterviewAnswer[];
  scrapedData?: Record<string, unknown> | null;
};

/**
 * Generate the Folio Bio narrative from collected data.
 * Returns 200-400 word editorial narrative, third person, magazine profile quality.
 */
export async function generateFolioBio(input: GenerateBioInput): Promise<string> {
  const { role, designerName, interviewAnswers, scrapedData } = input;

  // Canonical prompt-visible label (docs/17 §7); enum KEY lookup stays 'BUILDER' (data migration).
  const roleLabel = role === 'ARCHITECT' ? 'architect' : role === 'BUILDER' ? 'contractor' : 'interior designer';

  const anthropic = new Anthropic();

  const qaBlock = interviewAnswers
    .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
    .join('\n\n');

  const scrapedContext = scrapedData
    ? `\n\nSCRAPED WEBSITE DATA:\n${JSON.stringify(scrapedData, null, 2)}`
    : '';

  const result = await callLLM(
    async () => {
      const message = await anthropic.messages.create({
        model: MODELS.sonnet,
        system: `${FOLIO_TONE}

You are writing a magazine-quality profile bio for a ${roleLabel} named ${designerName}. Write in third person. This bio will appear on their professional profile page.

REQUIREMENTS:
- 200-400 words
- Open with something specific, not a generic credential
- Include at least one stated material/product preference from the interview
- Include at least one design conviction or philosophy
- Reference something from the interview answers, not just website data
- Write like a design magazine profile (think Architectural Digest, Elle Decor, Dwell)
- No clichés, no filler, no generic praise
- The bio should feel like it could only be about THIS person

BANNED PHRASES:
- "passionate about"
- "dedicated to"
- "with over X years of experience"
- "strives to"
- "believes in creating"
- "committed to excellence"
- "award-winning"
- "brings a unique perspective"

Return ONLY the bio text. No headers, no labels, no markdown.`,
        messages: [
          {
            role: 'user',
            content: `INTERVIEW ANSWERS:\n\n${qaBlock}${scrapedContext}\n\nWrite the Folio Bio for ${designerName}.`,
          },
        ],
        max_tokens: 800,
        temperature: 0.8,
      });

      const content = message.content[0]?.type === 'text' ? message.content[0].text : null;
      if (!content) throw new Error('No content in response');
      return content.trim();
    },
    {
      modelName: MODELS.sonnet,
      maxRetries: 2,
      contextHint: 'folio_bio_generation',
    }
  );

  if (!result.ok) {
    throw new Error(`Bio generation failed: ${result.code} – ${result.message}`);
  }

  return result.data;
}

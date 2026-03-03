import Anthropic from '@anthropic-ai/sdk';
import { extractTextFromBlocks } from './generate-quotes';

const anthropic = new Anthropic();

function isAnthropicEnabled(): boolean {
  return (
    process.env.ANTHROPIC_ENABLED === 'true' &&
    Boolean(process.env.ANTHROPIC_API_KEY)
  );
}

interface GenerateCaptionInput {
  postTitle: string;
  headline: string;
  expandedBlocks: any;
  roomName?: string;
  designerName: string;
}

export async function generateInstagramCaption(input: GenerateCaptionInput): Promise<string> {
  if (!isAnthropicEnabled()) {
    throw new Error('AI generation is not available');
  }

  const editorialText = extractTextFromBlocks(input.expandedBlocks);

  const prompt = `Write an Instagram caption for this interior design project post.

Project: ${input.postTitle}
Selected headline: ${input.headline}
Editorial content: ${editorialText.slice(0, 2000)}
Room focus: ${input.roomName || 'Full project'}
Designer: ${input.designerName}

The caption should:
- Be 2-3 sentences in the designer's voice (first person)
- Tease the story without giving it all away
- Create curiosity that makes someone want to read the full editorial
- NOT repeat the headline
- Sound natural, not marketing-speak
- End before the auto-appended CTA (which says "The full editorial — and every product specification — lives on Folio.")

Include 5-8 relevant hashtags at the end.

Return ONLY the caption text, nothing else.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  return content.text.trim();
}

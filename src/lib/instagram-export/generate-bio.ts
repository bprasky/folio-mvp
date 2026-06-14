import Anthropic from '@anthropic-ai/sdk';
import { extractTextFromBlocks } from './generate-quotes';
import { MODELS } from '@/lib/ai/models';

const anthropic = new Anthropic();

function isAnthropicEnabled(): boolean {
  return (
    process.env.ANTHROPIC_ENABLED === 'true' &&
    Boolean(process.env.ANTHROPIC_API_KEY)
  );
}

interface GenerateBioInput {
  designerName: string;
  studio?: string | null;
  companyName?: string | null;
  title?: string | null;
  bio?: string | null;
  specialties?: string[];
  styleName?: string | null;
  styleDescription?: string | null;
  postTitle: string;
  expandedBlocks: any;
  feedback?: string;
}

export async function generateBioBlurbs(input: GenerateBioInput): Promise<string[]> {
  if (!isAnthropicEnabled()) {
    throw new Error('AI generation is not available');
  }

  const editorialText = extractTextFromBlocks(input.expandedBlocks);

  const prompt = `You are an editorial writer for a high-end design publication.

Write a third-person bio blurb that introduces this designer in the context of this specific project. This will appear on an Instagram carousel slide — it's an editorial introduction, not a resume.

Designer info:
Name: ${input.designerName}
Studio: ${input.studio || input.companyName || 'Independent'}
Title: ${input.title || 'Designer'}
Bio: ${input.bio || 'Not provided'}
Specialties: ${input.specialties?.join(', ') || 'Not specified'}
Style fingerprint: ${input.styleName || 'Not yet generated'}
Style description: ${input.styleDescription || ''}

Project context:
Title: ${input.postTitle}
Editorial content: ${editorialText.slice(0, 2000)}

Generate exactly 4 bio blurb options. Each should:
- Be 1-2 sentences (30-50 words max)
- Written in third person
- Connect who the designer IS to what THIS project represents
- Sound like a magazine editor wrote it, not the designer themselves
- Reference their aesthetic philosophy or approach in relation to this work
- Feel editorial, not promotional

${input.feedback ? `Direction: ${input.feedback}` : ''}

Return ONLY a JSON array of 4 strings.`;

  const response = await anthropic.messages.create({
    model: MODELS.sonnet,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse bio response');
  }

  return JSON.parse(jsonMatch[0]) as string[];
}

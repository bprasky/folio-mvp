/**
 * Narrative Assembly - Weaves both interviews into a cohesive collaboration story
 * Produces expandedBlocks format compatible with ProjectPost
 */

import Anthropic from '@anthropic-ai/sdk';
import { callLLM } from '@/lib/posting/llmClient';
import { Round1Response, CollaborationQuestion } from '../questions/round1';
import { Round2Question } from '../questions/generateRound2';
import { Round3Question } from '../questions/generateRound3';

// Types for the narrative structure
export type NarrativeSection = {
  type: 'intro' | 'dialogue' | 'reflection' | 'conclusion';
  heading?: string;
  content: string;
  quotes?: {
    speaker: 'VENDOR' | 'DESIGNER';
    speakerName: string;
    text: string;
    context?: string;
  }[];
};

export type GeneratedNarrative = {
  title: string;
  subtitle?: string;
  excerpt: string;
  sections: NarrativeSection[];
  suggestedTags: string[];
  generatedAt: string;
};

export type ExpandedBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'blockquote'; text: string; attribution?: string }
  | { type: 'pullQuote'; text: string; speaker: string; role: string }
  | { type: 'divider' }
  | { type: 'image'; url: string; caption?: string; alt?: string };

// All interview data combined
export type InterviewData = {
  vendorOrgName: string;
  designerName: string;
  vendorRound1: { questions: CollaborationQuestion[]; responses: Round1Response[] };
  vendorRound2: { questions: Round2Question[]; responses: Round1Response[] };
  vendorRound3: { questions: Round3Question[]; responses: Round1Response[] };
  designerRound1: { questions: CollaborationQuestion[]; responses: Round1Response[] };
  designerRound2: { questions: Round2Question[]; responses: Round1Response[] };
  designerRound3: { questions: Round3Question[]; responses: Round1Response[] };
};

const NARRATIVE_SYSTEM_PROMPT = `You are an editorial writer for a prestigious design publication. Your task is to weave two interview transcripts into a single, compelling narrative about a collaboration between a designer and a vendor.

Writing guidelines:
- Write in third person narrative voice
- Weave quotes naturally into the story flow
- Create a cohesive narrative arc: introduction → development → dialogue/exchange → reflection
- Highlight moments of connection, shared values, and mutual growth
- Use direct quotes to let both voices shine
- Balance screen time between both parties
- Find the emotional core of the collaboration
- Write for a sophisticated design industry audience
- Keep the total length to 800-1200 words

Structure:
1. Opening - Set the scene, introduce the partnership
2. Origin Story - How the collaboration began
3. The Work - Projects, processes, problem-solving together
4. Dialogue - Cross-referenced moments, reactions to each other's perspectives
5. Reflection - What the partnership means, looking forward

Output JSON with:
- title: Compelling headline (max 100 chars)
- subtitle: Optional secondary headline
- excerpt: 2-3 sentence summary for previews
- sections: Array of narrative sections
- suggestedTags: Array of relevant topic tags`;

async function generateNarrativeWithLLM(data: InterviewData): Promise<GeneratedNarrative> {
  const anthropic = new Anthropic();

  // Compile all Q&A into a structured context
  const formatQA = (
    questions: (CollaborationQuestion | Round2Question | Round3Question)[],
    responses: Round1Response[],
    round: string
  ) => {
    return responses.map(r => {
      const q = questions.find(qu => qu.id === r.questionId);
      return `[${round}] Q: ${q?.prompt || 'Question'}\nA: ${r.answer}`;
    }).join('\n\n');
  };

  const vendorInterview = `
=== ${data.vendorOrgName} (Vendor) Interview ===

${formatQA(data.vendorRound1.questions, data.vendorRound1.responses, 'Round 1')}

${formatQA(data.vendorRound2.questions, data.vendorRound2.responses, 'Round 2')}

${formatQA(data.vendorRound3.questions, data.vendorRound3.responses, 'Round 3 - Responding to Designer')}
`;

  const designerInterview = `
=== ${data.designerName} (Designer) Interview ===

${formatQA(data.designerRound1.questions, data.designerRound1.responses, 'Round 1')}

${formatQA(data.designerRound2.questions, data.designerRound2.responses, 'Round 2')}

${formatQA(data.designerRound3.questions, data.designerRound3.responses, 'Round 3 - Responding to Vendor')}
`;

  const userPrompt = `Write a collaboration story narrative based on these two interviews:

${vendorInterview}

${designerInterview}

Vendor: ${data.vendorOrgName}
Designer: ${data.designerName}

Craft a compelling narrative that weaves both perspectives into a cohesive story about their collaboration. Include direct quotes from both parties, especially the Round 3 cross-pollinated responses where they react to each other.`;

  const result = await callLLM(
    async () => {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        system: NARRATIVE_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 4000,
      });

      const content = message.content[0]?.type === 'text' ? message.content[0].text : null;
      if (!content) throw new Error('No content in response');

      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned);
    },
    {
      modelName: 'claude-sonnet-4-20250514',
      maxRetries: 2,
      contextHint: 'collaboration_narrative_assembly',
    }
  );

  if (!result.ok) {
    console.error('[assembleStory] LLM call failed:', result.code, result.message);
    return generateFallbackNarrative(data);
  }

  const narrative = result.data as any;
  return {
    title: narrative.title || `${data.vendorOrgName} × ${data.designerName}`,
    subtitle: narrative.subtitle,
    excerpt: narrative.excerpt || 'A collaboration story.',
    sections: narrative.sections || [],
    suggestedTags: narrative.suggestedTags || [],
    generatedAt: new Date().toISOString(),
  };
}

function generateFallbackNarrative(data: InterviewData): GeneratedNarrative {
  // Create a basic narrative structure from the raw responses
  const getFirstResponse = (responses: Round1Response[]) =>
    responses[0]?.answer || '';

  return {
    title: `${data.vendorOrgName} × ${data.designerName}: A Partnership in Design`,
    excerpt: `${data.vendorOrgName} and ${data.designerName} share their story of collaboration and creative partnership.`,
    sections: [
      {
        type: 'intro',
        content: `In the world of interior design, the best work often emerges from trusted partnerships. ${data.vendorOrgName} and ${data.designerName} have built just such a relationship.`,
      },
      {
        type: 'dialogue',
        heading: 'The Beginning',
        content: getFirstResponse(data.vendorRound1.responses),
        quotes: [
          {
            speaker: 'DESIGNER',
            speakerName: data.designerName,
            text: getFirstResponse(data.designerRound1.responses),
          },
        ],
      },
    ],
    suggestedTags: ['collaboration', 'partnership', 'design'],
    generatedAt: new Date().toISOString(),
  };
}

// Convert narrative to expandedBlocks format
export function narrativeToBlocks(
  narrative: GeneratedNarrative,
  vendorOrgName: string,
  designerName: string
): ExpandedBlock[] {
  const blocks: ExpandedBlock[] = [];

  // Title as H1
  blocks.push({ type: 'heading', level: 1, text: narrative.title });

  if (narrative.subtitle) {
    blocks.push({ type: 'paragraph', text: narrative.subtitle });
  }

  blocks.push({ type: 'divider' });

  for (const section of narrative.sections) {
    if (section.heading) {
      blocks.push({ type: 'heading', level: 2, text: section.heading });
    }

    if (section.content) {
      blocks.push({ type: 'paragraph', text: section.content });
    }

    if (section.quotes) {
      for (const quote of section.quotes) {
        blocks.push({
          type: 'pullQuote',
          text: quote.text,
          speaker: quote.speakerName,
          role: quote.speaker === 'VENDOR' ? vendorOrgName : designerName,
        });

        if (quote.context) {
          blocks.push({ type: 'paragraph', text: quote.context });
        }
      }
    }

    if (section.type === 'conclusion') {
      blocks.push({ type: 'divider' });
    }
  }

  return blocks;
}

export async function assembleCollaborationStory(
  data: InterviewData
): Promise<{
  narrative: GeneratedNarrative;
  blocks: ExpandedBlock[];
}> {
  const narrative = await generateNarrativeWithLLM(data);
  const blocks = narrativeToBlocks(narrative, data.vendorOrgName, data.designerName);

  return { narrative, blocks };
}

// Generate title and excerpt for the story
export async function generateStoryMeta(
  vendorOrgName: string,
  designerName: string,
  vendorResponses: Round1Response[],
  designerResponses: Round1Response[]
): Promise<{ title: string; excerpt: string }> {
  const anthropic = new Anthropic();

  // Get key quotes
  const vendorQuote = vendorResponses[0]?.answer?.slice(0, 200) || '';
  const designerQuote = designerResponses[0]?.answer?.slice(0, 200) || '';

  const result = await callLLM(
    async () => {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        system: 'Generate a compelling title and excerpt for a design collaboration story. Return JSON with "title" (max 80 chars) and "excerpt" (max 200 chars).',
        messages: [
          {
            role: 'user',
            content: `Collaboration between ${vendorOrgName} (vendor) and ${designerName} (designer).

Vendor's perspective: "${vendorQuote}"
Designer's perspective: "${designerQuote}"`,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      const content = message.content[0]?.type === 'text' ? message.content[0].text : null;
      if (!content) throw new Error('No content');
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned);
    },
    {
      modelName: 'claude-sonnet-4-20250514',
      maxRetries: 1,
      contextHint: 'collaboration_story_meta',
    }
  );

  if (!result.ok) {
    return {
      title: `${vendorOrgName} × ${designerName}`,
      excerpt: `A collaboration story between ${vendorOrgName} and ${designerName}.`,
    };
  }

  return {
    title: (result.data as any).title || `${vendorOrgName} × ${designerName}`,
    excerpt: (result.data as any).excerpt || `A collaboration story.`,
  };
}

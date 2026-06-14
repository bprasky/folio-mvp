import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { MODELS } from '@/lib/ai/models';

interface BioGenerationInput {
  organizationId: string;
  orgName: string;
  /** Pre-built transcript string (conversational interviews) — takes priority over interview fields */
  transcript?: string;
  interview?: {
    originStory?: string;
    philosophyStatement?: string;
    projectTypes?: string[];
    location?: string;
    serviceRegions?: string[];
    idealClient?: string;
    layer2Responses?: Record<string, string>;
    recognitionMentions?: string;
    collaboratorMentions?: string;
  };
}

export interface GeneratedBioOutput {
  fullBio: string;
  shortBio: string;
  pullQuotes: string[];
  philosophyTagline: string;
  processDescription: string | null;
}

const anthropic = new Anthropic();

export async function generateOrgBio(input: BioGenerationInput): Promise<GeneratedBioOutput> {
  const { orgName, transcript, interview } = input;

  let interviewContent: string;

  if (transcript) {
    // Conversational format: use the pre-built transcript directly
    interviewContent = transcript;
  } else if (interview) {
    // Legacy layered format: build from structured fields
    const parts: string[] = [];
    if (interview.originStory) parts.push(`**Origin Story:**\n${interview.originStory}`);
    if (interview.philosophyStatement) parts.push(`**Design Philosophy:**\n${interview.philosophyStatement}`);
    if (interview.projectTypes?.length) parts.push(`**Project Focus:**\n${interview.projectTypes.join(', ')}`);
    if (interview.location) parts.push(`**Location & Regions:**\n${interview.location}`);
    if (interview.serviceRegions?.length) parts.push(`Service regions: ${interview.serviceRegions.join(', ')}`);
    if (interview.idealClient) parts.push(`**Ideal Client:**\n${interview.idealClient}`);
    if (interview.layer2Responses) {
      const entries = Object.entries(interview.layer2Responses).filter(([, v]) => v);
      if (entries.length) {
        parts.push(`**Additional Context:**\n${entries.map(([k, v]) => `- ${k}: ${v}`).join('\n')}`);
      }
    }
    if (interview.recognitionMentions) parts.push(`**Recognition:**\n${interview.recognitionMentions}`);
    if (interview.collaboratorMentions) parts.push(`**Collaborations:**\n${interview.collaboratorMentions}`);
    interviewContent = parts.join('\n\n');
  } else {
    throw new Error('Either transcript or interview data is required');
  }

  if (!interviewContent.trim()) {
    throw new Error('No interview content to generate bio from');
  }

  const prompt = `You are a professional editorial writer for the interior design industry. Based on the following interview responses from ${orgName}, generate polished content for their studio profile.

## Interview Responses

${interviewContent}

## Generate the following:

1. **Full Bio** (3-4 paragraphs, ~200-300 words): A polished studio bio suitable for the "About" section. Professional but warm tone. Highlight what makes them distinctive.

2. **Short Bio** (exactly 80 words): A concise version for cards and search results.

3. **Pull Quotes** (3 memorable phrases): Extract or craft 3 quotable phrases from their responses that capture their voice and philosophy.

4. **Philosophy Tagline** (one sentence, max 15 words): A punchy one-liner capturing their design philosophy.

5. **Process Description** (1-2 paragraphs, only if process was discussed): If they mentioned their approach/process, describe it. Otherwise, return null.

## Tone Guidelines:
- Professional, not corporate
- Warm, not casual
- Observational, not promotional
- Respect craft, focus on work
- Avoid superlatives and marketing speak

Respond in JSON format:
{
  "fullBio": "...",
  "shortBio": "...",
  "pullQuotes": ["...", "...", "..."],
  "philosophyTagline": "...",
  "processDescription": "..." or null
}`;

  const response = await anthropic.messages.create({
    model: MODELS.sonnet,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  // Parse JSON from response
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse bio generation response');
  }

  const generated = JSON.parse(jsonMatch[0]) as GeneratedBioOutput;

  // Update the database
  await prisma.orgBioInterview.update({
    where: { organizationId: input.organizationId },
    data: {
      fullBio: generated.fullBio,
      shortBio: generated.shortBio,
      pullQuotes: generated.pullQuotes,
      philosophyTagline: generated.philosophyTagline,
      processDescription: generated.processDescription,
      generatedAt: new Date()
    }
  });

  // Also update the organization's description
  await prisma.organization.update({
    where: { id: input.organizationId },
    data: {
      description: generated.fullBio
    }
  });

  return generated;
}

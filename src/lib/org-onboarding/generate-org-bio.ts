import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';

interface BioGenerationInput {
  organizationId: string;
  orgName: string;
  interview: {
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

/**
 * Check if Anthropic API is enabled and available
 */
function isAnthropicEnabled(): boolean {
  return (
    process.env.ANTHROPIC_ENABLED === 'true' &&
    Boolean(process.env.ANTHROPIC_API_KEY)
  );
}

export async function generateOrgBio(input: BioGenerationInput): Promise<GeneratedBioOutput> {
  const { orgName, interview } = input;

  if (!isAnthropicEnabled()) {
    console.warn('[generateOrgBio] Anthropic API not enabled');
    throw new Error('AI generation is not available');
  }

  const prompt = `You are a professional editorial writer for the interior design industry. Based on the following interview responses from ${orgName}, generate polished content for their studio profile.

## Interview Responses

**Origin Story:**
${interview.originStory || 'Not provided'}

**Design Philosophy:**
${interview.philosophyStatement || 'Not provided'}

**Project Focus:**
${interview.projectTypes?.join(', ') || 'Not specified'}

**Location & Regions:**
${interview.location || 'Not provided'}
${interview.serviceRegions?.length ? `Service regions: ${interview.serviceRegions.join(', ')}` : ''}

**Ideal Client:**
${interview.idealClient || 'Not provided'}

${interview.layer2Responses ? `
**Additional Context:**
${Object.entries(interview.layer2Responses).map(([key, value]) => `- ${key}: ${value}`).join('\n')}
` : ''}

${interview.recognitionMentions ? `
**Recognition:**
${interview.recognitionMentions}
` : ''}

${interview.collaboratorMentions ? `
**Collaborations:**
${interview.collaboratorMentions}
` : ''}

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
    model: 'claude-sonnet-4-20250514',
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

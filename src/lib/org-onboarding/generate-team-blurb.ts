import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { MODELS } from '@/lib/ai/models';

interface TeamBlurbInput {
  orgUserId: string;
  userName: string;
  orgName: string;
  quiz: {
    joinDate?: Date;
    specialties?: string[];
    whatBroughtYou?: string;
    roleInProcess?: string;
    proudestProject?: string;
    background?: string;
    contextualAnswers?: Record<string, string>;
  };
  orgPhilosophy?: string;
}

export interface GeneratedTeamContent {
  teamBlurb: string;
  extendedBio: string;
  pullQuote: string;
  expertiseTags: string[];
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

export async function generateTeamBlurb(input: TeamBlurbInput): Promise<GeneratedTeamContent> {
  const { userName, orgName, quiz, orgPhilosophy } = input;

  if (!isAnthropicEnabled()) {
    console.warn('[generateTeamBlurb] Anthropic API not enabled');
    throw new Error('AI generation is not available');
  }

  const joinDateFormatted = quiz.joinDate
    ? quiz.joinDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const prompt = `You are a professional editorial writer. Based on the following team member profile, generate content for their presence on ${orgName}'s team page.

## Team Member Information

**Name:** ${userName}
**Organization:** ${orgName}
${joinDateFormatted ? `**Joined:** ${joinDateFormatted}` : ''}
${quiz.specialties?.length ? `**Specialties:** ${quiz.specialties.join(', ')}` : ''}

**What brought them to ${orgName}:**
${quiz.whatBroughtYou || 'Not provided'}

**Their role in the studio's process:**
${quiz.roleInProcess || 'Not provided'}

**Proudest project:**
${quiz.proudestProject || 'Not provided'}

**Background:**
${quiz.background || 'Not provided'}

${quiz.contextualAnswers ? `
**Additional context:**
${Object.entries(quiz.contextualAnswers).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
` : ''}

${orgPhilosophy ? `**Studio's design philosophy:** ${orgPhilosophy}` : ''}

## Generate:

1. **Team Blurb** (2-3 sentences): A brief description for the team page. Warm but professional. Should complement the studio's voice.

2. **Extended Bio** (1 short paragraph): For their personal profile if they choose to display it.

3. **Pull Quote** (one memorable line): Extract or craft one quotable phrase that captures their voice.

4. **Expertise Tags** (3-5 keywords): Inferred areas of expertise based on their answers.

## Tone:
- Professional, not corporate
- Warm, not casual
- Specific to their contributions
- Aligned with ${orgName}'s identity

Respond in JSON:
{
  "teamBlurb": "...",
  "extendedBio": "...",
  "pullQuote": "...",
  "expertiseTags": ["...", "..."]
}`;

  const response = await anthropic.messages.create({
    model: MODELS.sonnet,
    thinking: { type: 'disabled' },
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse team blurb response');
  }

  const generated = JSON.parse(jsonMatch[0]) as GeneratedTeamContent;

  // Update the database
  await prisma.teamMemberQuiz.update({
    where: { orgUserId: input.orgUserId },
    data: {
      teamBlurb: generated.teamBlurb,
      extendedBio: generated.extendedBio,
      pullQuote: generated.pullQuote,
      expertiseTags: generated.expertiseTags,
      generatedAt: new Date()
    }
  });

  return generated;
}

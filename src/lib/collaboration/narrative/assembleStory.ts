/**
 * Narrative Assembly - Weaves both interviews into a cohesive collaboration story
 * Produces expandedBlocks format compatible with ProjectPost
 */

import Anthropic from '@anthropic-ai/sdk';
import { callLLM } from '@/lib/posting/llmClient';
import { Round1Response, CollaborationQuestion } from '../questions/round1';
import { Round2Question } from '../questions/generateRound2';
import { Round3Question } from '../questions/generateRound3';
import { MODELS } from '@/lib/ai/models';
import { EDITORIAL_ACCURACY_RULES } from '@/lib/interview/prompts/editorialTone';
import { selectPullQuotes } from '@/lib/posting/selectPullQuotes';
import { isVerbatimSpan, type AnswerLike } from '@/lib/posting/quoteCandidates';
import { getSelectedPullQuoteText } from '@/lib/posting/schemas';
import { formatRoomName } from '@/lib/utils/formatRoomName';
import { cid as newCid } from '@/lib/utils/correlation';

// Types for the narrative structure
export type NarrativeSection = {
  type: 'intro' | 'dialogue' | 'reflection' | 'conclusion';
  heading?: string;
  content: string;
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
  | { type: 'verbatimQuote'; text: string; speaker: string; role: string }
  | { type: 'divider' }
  | { type: 'image'; url: string; caption?: string; alt?: string };

/**
 * A quote that a contributor actually said, cut from their own answers by code.
 *
 * Deliberately NOT the old `pullQuote` block type. Stories generated before this
 * change carry `pullQuote` blocks whose text the model wrote, and the renderer
 * drops those on sight. Reusing the tag would resurrect every one of them the
 * moment the renderer learned to draw it again, so the verified quote gets its
 * own tag and the fabricated ones stay dark with no data migration.
 */
export type VerbatimQuote = {
  text: string;
  /** Display name of the contributor who said it. */
  speaker: string;
  /** 'Vendor' or 'Designer'. */
  role: string;
};

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
- Create a cohesive narrative arc: introduction → development → dialogue/exchange → reflection
- Highlight moments of connection, shared values, and mutual growth
- NEVER quote either party. Do not put any of their words in quotation marks, and do not
  present a sentence as something either of them said. Report what they described in your
  own third-person prose instead. Neither party reviews this text before it publishes, so
  a quoted sentence here is words attributed to a named person that they never approved
  and may never have said.
- Balance screen time between both parties
- Write for a sophisticated design industry audience
- Keep the total length to 800-1200 words

${EDITORIAL_ACCURACY_RULES}

Everything above applies to a collaboration between two real businesses who did not
write this text and do not see it before it publishes. Report only what the two
interviews state. Do not infer a feeling, a motive, a shared value or a turning point
that neither of them described.

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

Craft a compelling narrative that weaves both perspectives into a cohesive story about their collaboration. Draw especially on the Round 3 cross-pollinated responses where they react to each other — but report them in third-person prose, never as quotations.`;

  const result = await callLLM(
    async () => {
      const message = await anthropic.messages.create({
        model: MODELS.sonnet,
        thinking: { type: 'disabled' },
        system: NARRATIVE_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 4000,
      });

      const content = message.content[0]?.type === 'text' ? message.content[0].text : null;
      if (!content) throw new Error('No content in response');

      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned);
    },
    {
      modelName: MODELS.sonnet,
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
      },
    ],
    suggestedTags: ['collaboration', 'partnership', 'design'],
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// VERBATIM QUOTES — selected from each contributor's own answers, never written
// ============================================================================

/**
 * The pool key for candidate extraction, and the whole of the attribution
 * guarantee.
 *
 * `extractQuoteCandidates(answers, key)` keeps only answers whose `section`
 * equals `key`, and `selectPullQuotes` re-verifies each pick against
 * `answers.filter(a => a.section === key)`. Setting `section` to the
 * contributor's ROLE therefore makes "a designer sentence attributed to the
 * vendor" the same class of impossibility as "a kitchen quote under the
 * bathroom heading" — the case that machinery was built for.
 *
 * The role token, not the display name: the map `selectPullQuotes` returns is
 * keyed by `formatRoomName(key)`, which title-cases and would turn a real
 * business name like "ACME Lighting Co." into "Acme Lighting Co." and lose the
 * lookup. `formatRoomName('VENDOR') === 'Vendor'` is stable and reversible.
 */
type ContributorRole = 'VENDOR' | 'DESIGNER';
const CONTRIBUTORS: ContributorRole[] = ['VENDOR', 'DESIGNER'];

/**
 * Flatten both interviews into the shape the candidate cutter reads.
 *
 * Rounds 2 and 3 are marked `isFollowUp` because that is what they are, and
 * `extractQuoteCandidates` ranks follow-ups above primaries — behind
 * self-sufficiency, which sorts first. Round 3 is the round where
 * each party reacts to the other, which is the most quotable material either of
 * them produces.
 */
function contributorAnswers(data: InterviewData): AnswerLike[] {
  const rounds: Array<{ role: ContributorRole; responses: Round1Response[]; isFollowUp: boolean }> = [
    { role: 'VENDOR', responses: data.vendorRound1.responses, isFollowUp: false },
    { role: 'VENDOR', responses: data.vendorRound2.responses, isFollowUp: true },
    { role: 'VENDOR', responses: data.vendorRound3.responses, isFollowUp: true },
    { role: 'DESIGNER', responses: data.designerRound1.responses, isFollowUp: false },
    { role: 'DESIGNER', responses: data.designerRound2.responses, isFollowUp: true },
    { role: 'DESIGNER', responses: data.designerRound3.responses, isFollowUp: true },
  ];

  const out: AnswerLike[] = [];
  for (const { role, responses, isFollowUp } of rounds) {
    for (const r of responses ?? []) {
      if (typeof r?.answer === 'string' && r.answer.trim()) {
        out.push({ section: role, answer: r.answer, isFollowUp });
      }
    }
  }
  return out;
}

/**
 * Choose at most one verbatim quote per contributor.
 *
 * Routed through `selectPullQuotes` rather than reimplemented, so the
 * collaboration surface inherits the article's guarantee instead of a lookalike
 * of it: candidates are cut from the answers by code, the model is handed
 * numbered candidates and returns IDs, an ID is resolved inside that
 * contributor's own array, and the resulting text is re-checked with
 * `isVerbatimSpan` before it survives. A failed check falls back to the top
 * code-ranked candidate; no candidate at all yields no quote.
 *
 * Fails closed at every step. An empty return is a correct outcome — it means
 * neither party said anything that stands alone as a display line, and the story
 * publishes without a quote rather than with an invented one.
 */
export async function selectCollaborationQuotes(
  data: InterviewData,
): Promise<VerbatimQuote[]> {
  const answers = contributorAnswers(data);
  if (answers.length === 0) return [];

  const _cid = newCid('collab-quotes');
  const { byRoom, roomsWithNoCandidates, roomsFailedVerification } =
    await selectPullQuotes(CONTRIBUTORS, answers, _cid, null);

  const displayName: Record<ContributorRole, string> = {
    VENDOR: data.vendorOrgName,
    DESIGNER: data.designerName,
  };

  const quotes: VerbatimQuote[] = [];
  for (const role of CONTRIBUTORS) {
    const key = formatRoomName(role);
    const text = getSelectedPullQuoteText(byRoom[key] ?? null);
    if (!text) continue;

    // Belt and braces, and the one line that is this module's own guarantee
    // rather than a borrowed one: re-verify against ONLY this contributor's
    // answers before the name goes on it. `selectPullQuotes` already scopes its
    // sources the same way; this does not trust that it will keep doing so.
    const ownAnswers = answers
      .filter((a) => a.section === role)
      .map((a) => a.answer);
    if (!isVerbatimSpan(text, ownAnswers)) {
      console.warn('[collabQuotes] selection is not verbatim for its speaker — dropping', {
        _cid, role, text: text.slice(0, 120),
      });
      continue;
    }

    quotes.push({
      text,
      speaker: displayName[role],
      role: key,
    });
  }

  console.info('[collabQuotes] selected', {
    _cid,
    selected: quotes.length,
    roomsWithNoCandidates,
    roomsFailedVerification,
  });

  return quotes;
}

// Convert narrative to expandedBlocks format
export function narrativeToBlocks(
  narrative: GeneratedNarrative,
  quotes: VerbatimQuote[] = [],
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

    if (section.type === 'conclusion') {
      blocks.push({ type: 'divider' });
    }
  }

  // Verified quotes close the piece, in a fixed order, one per contributor.
  //
  // Placed here rather than interleaved with the sections because the candidates
  // are scoped per CONTRIBUTOR, not per section — there is no honest mapping from
  // "the vendor's best line" to "the paragraph it belongs beside", and inventing
  // one would be the model deciding placement from prose it also wrote. An empty
  // `quotes` array simply adds nothing.
  for (const q of quotes) {
    blocks.push({ type: 'verbatimQuote', text: q.text, speaker: q.speaker, role: q.role });
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
  const quotes = await selectCollaborationQuotes(data);
  const blocks = narrativeToBlocks(narrative, quotes);

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
        model: MODELS.sonnet,
        thinking: { type: 'disabled' },
        system: 'Generate a compelling title and excerpt for a design collaboration story. Return JSON with "title" (max 80 chars) and "excerpt" (max 200 chars).',
        messages: [
          {
            role: 'user',
            content: `Collaboration between ${vendorOrgName} (vendor) and ${designerName} (designer).

Vendor's perspective: "${vendorQuote}"
Designer's perspective: "${designerQuote}"`,
          },
        ],
        max_tokens: 300,
      });

      const content = message.content[0]?.type === 'text' ? message.content[0].text : null;
      if (!content) throw new Error('No content');
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned);
    },
    {
      modelName: MODELS.sonnet,
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

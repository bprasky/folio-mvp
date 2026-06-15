/**
 * Prompted Content — Question Generation (Phase 1 + 2)
 *
 * Phase 1: Bio-reflective questions from a designer's completed bio interview.
 * Phase 2: Project-reflective questions from published projects + editorial interviews.
 *
 * Uses the same Anthropic SDK + callLLM pattern as qa-generation.ts.
 */

import Anthropic from '@anthropic-ai/sdk';
import { callLLM } from '@/lib/posting/llmClient';
import { prisma } from '@/lib/prisma';
import { MODELS } from '@/lib/ai/models';

const MAX_PENDING_QUESTIONS = 3;
const QUESTIONS_PER_BATCH = 3;

interface GeneratedQuestion {
  questionText: string;
  bioExcerptRef: string; // Which part of the bio inspired this question
  cluster: string; // Atelier signal cluster, e.g. 'material_philosophy'
}

/**
 * Check whether new prompted questions should be generated for a user.
 */
export async function shouldGenerateQuestions(userId: string): Promise<boolean> {
  const pendingCount = await prisma.promptedQuestion.count({
    where: {
      targetUserId: userId,
      status: { in: ['GENERATED', 'DELIVERED'] },
    },
  });

  return pendingCount < MAX_PENDING_QUESTIONS;
}

/**
 * Generate bio-reflective questions for a designer based on their completed bio.
 * Returns the created PromptedQuestion records.
 */
export async function generateBioReflectiveQuestions(userId: string) {
  // Load the designer's bio
  const bio = await prisma.designerBio.findUnique({
    where: { userId },
    select: {
      folioBio: true,
      interviewAnswers: true,
      status: true,
    },
  });

  if (!bio || !bio.folioBio || bio.status === 'empty') {
    console.log('[prompted-content] No completed bio for user:', userId);
    return [];
  }

  // Load existing questions to avoid duplicates
  const existingQuestions = await prisma.promptedQuestion.findMany({
    where: { targetUserId: userId },
    select: { questionText: true },
  });
  const existingTexts = existingQuestions.map((q) => q.questionText);

  // Format interview answers
  const answers = Array.isArray(bio.interviewAnswers) ? bio.interviewAnswers : [];
  const qaBlock = (answers as Array<{ question: string; answer: string }>)
    .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
    .join('\n\n');

  // Also load existing ProfileQA for context
  const profileQAs = await prisma.profileQA.findMany({
    where: { userId, status: 'answered' },
    select: { question: true, answer: true },
    take: 10,
  });
  const qaContext = profileQAs
    .map((qa) => `Q: ${qa.question}\nA: ${qa.answer ?? ''}`)
    .join('\n\n');

  const anthropic = new Anthropic();

  const result = await callLLM(
    async () => {
      const message = await anthropic.messages.create({
        model: MODELS.sonnet,
        system: `You are generating questions for verified design professionals on Folio, a design publication platform. These questions appear as editorial-quality cards in the magazine feed.

FRAMING PRINCIPLE: The bio is EVIDENCE of the designer's perspective, not the SUBJECT. Every question should be about a broader design theme, philosophy, or industry conversation. The designer's bio details are referenced because they prove the designer has a distinctive point of view — but the question asks for the principle, philosophy, or transferable insight, not a retelling of their story.

QUESTION STRUCTURE:
1. Open with the broader theme — a design philosophy, industry trend, or question that many professionals think about. Frame it as a live conversation.
2. Reference something from their bio as proof — "you mentioned X" or "your background in Y" — establishing that they have a unique angle.
3. Ask the expertise question — the WHY, the PRINCIPLE, the TRANSFERABLE INSIGHT. Not "tell us more about your origin story" but "what's the thinking behind X that other designers could learn from."

OPTIONAL TECHNIQUES:
- A/B framing: "Is that more of an A or a B?" gives the designer a starting point. Examples: "Is that instinct or something you learned?" / "Does that come from your training or from client work?"
- Trend context: "A lot of designers are rethinking X right now" — this tells the designer their answer has an audience.
- Peer framing: "Most designers come at this from Y — your path was completely different" — positions the designer as distinctive.

BANNED PATTERNS:
- Do NOT ask them to retell or elaborate on something they already said in their bio
- Do NOT quote their bio back at them as the main subject ("You said X — tell us more")
- Do NOT use "Can you share...", "Tell us about a time...", "What insights can you offer..."
- Do NOT ask about failures, compromises, or regrets unless framed as "what did that teach you"

EXAMPLES:
BAD: "You mentioned that your grandmother's home inspired your love of design — how does that early memory influence your work today?"
GOOD: "A lot of designers talk about spaces from childhood that shaped how they see proportion and light. Is the instinct you bring to a room something you can trace back, or has it evolved into something entirely different?"

BAD: "Your transition from fashion to interiors is unusual — what skills transferred?"
GOOD: "The crossover between fashion and interiors is getting more attention lately. When you think about material and drape and texture, are you drawing on the same instinct in both worlds or are they fundamentally different disciplines?"

TONE: Questions should read like a thoughtful design journalist who has studied the designer's background and wants to understand the thinking behind their perspective — not a platform extracting more bio content.

Maximum 2 sentences per question. One sentence is often better.
Questions should be answerable in 30-90 seconds of speaking or 2-4 sentences of typing.
Do NOT repeat or closely paraphrase any existing questions provided below.

Return a JSON array of exactly ${QUESTIONS_PER_BATCH} objects:
[{
  "questionText": "The question text",
  "bioExcerptRef": "A brief quote or paraphrase of the bio content that inspired this question",
  "cluster": "A thematic cluster tag, e.g. 'material_philosophy', 'client_navigation', 'craft_decisions', 'design_origin', 'space_philosophy'"
}]`,
        messages: [
          {
            role: 'user',
            content: `The following bio and interview answers reveal this designer's perspective and philosophy. Use them as EVIDENCE of their expertise when referencing their background, not as subjects to drill into. The question should be about the broader theme; the bio detail is cited to establish credibility.\n\nDESIGNER BIO:\n${bio.folioBio}\n\nINTERVIEW ANSWERS:\n${qaBlock}\n\n${qaContext ? `EXISTING PROFILE Q&A:\n${qaContext}\n\n` : ''}${existingTexts.length > 0 ? `ALREADY ASKED (do not repeat):\n${existingTexts.join('\n')}\n\n` : ''}Generate ${QUESTIONS_PER_BATCH} expertise-framed questions for this designer.`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.85,
      });

      const content = message.content[0]?.type === 'text' ? message.content[0].text : null;
      if (!content) throw new Error('No content in response');
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned) as GeneratedQuestion[];
    },
    {
      modelName: MODELS.sonnet,
      maxRetries: 2,
      contextHint: 'prompted_content_bio_reflective',
    }
  );

  if (!result.ok) {
    console.error('[prompted-content] Question generation failed:', result);
    return [];
  }

  const questions = Array.isArray(result.data) ? result.data : [];

  // Save to database
  const created = [];
  for (const q of questions.slice(0, QUESTIONS_PER_BATCH)) {
    if (!q.questionText) continue;

    const record = await prisma.promptedQuestion.create({
      data: {
        targetUserId: userId,
        questionText: q.questionText,
        questionType: 'BIO_REFLECTIVE',
        provenance: {
          sourceType: 'individual_bio',
          bioExcerptRef: q.bioExcerptRef || null,
        },
        atelierSignals: q.cluster
          ? {
              cluster: q.cluster,
              expectedSignals: [q.cluster],
            }
          : undefined,
        priority: 0.7,
        deliveryContext: 'feed_card',
        status: 'GENERATED',
      },
    });
    created.push(record);
  }

  console.log(`[prompted-content] Generated ${created.length} bio-reflective questions for user ${userId}`);
  return created;
}

// ---------------------------------------------------------------------------
// Phase 2: Project-Reflective Questions
// ---------------------------------------------------------------------------

interface ProjectReflectiveQuestion {
  questionText: string;
  projectRef: string; // Which project inspired the question
  cluster: string;
}

/**
 * Generate project-reflective questions based on a designer's published projects.
 * Draws on project metadata, editorial interview answers, rooms, and selections
 * to produce specific, craft-oriented questions tied to real work.
 */
export async function generateProjectReflectiveQuestions(userId: string) {
  // Load published projects with rich context
  const projects = await prisma.project.findMany({
    where: {
      ownerId: userId,
      post: { status: 'PUBLISHED' },
    },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      city: true,
      regionState: true,
      projectType: true,
      clientType: true,
      rooms: { select: { name: true, type: true }, take: 10 },
      post: {
        select: {
          excerpt: true,
          keywords: true,
          expandedBlocks: true,
        },
      },
      editorialInterviews: {
        select: {
          answers: {
            select: { questionText: true, answerText: true },
            take: 10,
          },
        },
        take: 1,
      },
    },
    orderBy: { publishedAt: 'desc' },
    take: 5,
  });

  if (projects.length === 0) {
    console.log('[prompted-content] No published projects for user:', userId);
    return [];
  }

  // Load existing questions to avoid duplicates
  const existingQuestions = await prisma.promptedQuestion.findMany({
    where: { targetUserId: userId },
    select: { questionText: true },
  });
  const existingTexts = existingQuestions.map((q) => q.questionText);

  // Load bio for cross-referencing (optional, enriches prompt)
  const bio = await prisma.designerBio.findUnique({
    where: { userId },
    select: { folioBio: true },
  });

  // Format project context for the LLM
  const projectBlocks = projects.map((p) => {
    const parts: string[] = [];
    parts.push(`PROJECT: "${p.title || 'Untitled'}"`);
    if (p.city || p.regionState) parts.push(`Location: ${[p.city, p.regionState].filter(Boolean).join(', ')}`);
    if (p.category) parts.push(`Category: ${p.category}`);
    if (p.description) parts.push(`Description: ${p.description}`);
    if (p.post?.excerpt) parts.push(`Editorial excerpt: ${p.post.excerpt}`);
    if (p.post?.keywords?.length) parts.push(`Keywords: ${p.post.keywords.join(', ')}`);
    if (p.rooms.length > 0) parts.push(`Rooms: ${p.rooms.map((r) => r.name).join(', ')}`);

    // Editorial interview Q&A
    const interview = p.editorialInterviews?.[0];
    if (interview?.answers?.length) {
      const qa = interview.answers
        .map((a) => `  Q: ${a.questionText ?? '?'}\n  A: ${a.answerText}`)
        .join('\n');
      parts.push(`Interview:\n${qa}`);
    }

    return parts.join('\n');
  });

  const anthropic = new Anthropic();

  const result = await callLLM(
    async () => {
      const message = await anthropic.messages.create({
        model: MODELS.sonnet,
        system: `You are generating questions for verified design professionals on Folio, a design publication platform. These questions appear as editorial-quality cards in the magazine feed.

FRAMING PRINCIPLE: The project is the EVIDENCE, not the SUBJECT. Every question should be about a broader design theme, trend, or expertise area. The designer's specific project is referenced because it proves they have real experience with the topic — but the question asks them to share the principle, philosophy, or approach behind the decision, not to describe the decision itself.

QUESTION STRUCTURE:
1. Open with the broader theme — what the industry cares about, what people search for, what other professionals think about. Frame it as a live conversation happening in design right now.
2. Reference their specific project as proof — "your [Project Name] achieved this" or "the way you handled this in [Project Name]" — establishing credibility.
3. Ask the expertise question — the WHY, the PRINCIPLE, the TRANSFERABLE INSIGHT. Not "how did you do X in this project" but "what's the thinking behind X that other designers could learn from."

OPTIONAL TECHNIQUES:
- A/B framing: "Is that more of an A or a B?" gives the designer a starting point and creates natural follow-up energy. Examples: "Is that an architectural move or a furniture move?" / "Do you design for how it looks now or how it'll look in ten years?" / "Is that about the client's lifestyle or the space's proportions?"
- Trend context: "A lot of designers are rethinking X right now" or "Seamless storage is one of the most searched topics in residential design" — this tells the designer their answer has an audience.
- Peer framing: "Most designers solve this with Y — you went a completely different direction" — this positions the designer as distinctive.

BANNED PATTERNS:
- Do NOT ask about specific project details as the main subject ("what drew you to pair X with Y in Project Z")
- Do NOT quote their interview answers back at them and ask them to elaborate
- Do NOT use "Can you share...", "Tell us about a time...", "What insights can you offer..."
- Do NOT ask them to describe something they already described in a project interview — ask them to go BEYOND it
- Do NOT make every question about the same project — spread references across their published work

EXAMPLES:
BAD: "The fluted oak panels that conceal your prep kitchen in the Boca Raton project — what was the design intent behind that detail?"
GOOD: "A lot of designers are rethinking hidden storage right now. Your prep kitchen in the Boca Raton project pulled it off seamlessly — what's the principle behind making storage truly invisible versus just concealed?"

BAD: "Luca's House features a fluid layout that 'invites interaction' — how did you achieve that openness?"
GOOD: "Open layouts are everywhere, but most of them feel like one big room instead of distinct spaces that flow. Your approach in Luca's House kept the openness without losing the rooms — is that an architectural move or a furniture move?"

TONE: Questions should read like a thoughtful design journalist who has studied the designer's portfolio and wants to understand the thinking behind the work — not a platform asking for more content about a specific room.

Maximum 2 sentences per question. One sentence is often better.
Questions should be answerable in 30-90 seconds of speaking or 2-4 sentences of typing.
Do NOT repeat or closely paraphrase any existing questions provided below.

Return a JSON array of exactly ${QUESTIONS_PER_BATCH} objects:
[{
  "questionText": "The question text",
  "projectRef": "The project title or identifier that inspired this question",
  "cluster": "A thematic cluster tag, e.g. 'material_philosophy', 'spatial_logic', 'craft_decisions', 'vendor_rationale', 'room_narrative'"
}]`,
        messages: [
          {
            role: 'user',
            content: `The following projects demonstrate this designer's areas of expertise. Use them as EVIDENCE when referencing their work, not as subjects to drill into. The question should be about the broader theme; the project is cited to establish credibility.\n\nPROJECTS:\n${projectBlocks.join('\n\n---\n\n')}${bio?.folioBio ? `\n\nDESIGNER BIO:\n${bio.folioBio}` : ''}${existingTexts.length > 0 ? `\n\nALREADY ASKED (do not repeat):\n${existingTexts.join('\n')}` : ''}\n\nGenerate ${QUESTIONS_PER_BATCH} expertise-framed questions for this designer.`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.85,
      });

      const content = message.content[0]?.type === 'text' ? message.content[0].text : null;
      if (!content) throw new Error('No content in response');
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned) as ProjectReflectiveQuestion[];
    },
    {
      modelName: MODELS.sonnet,
      maxRetries: 2,
      contextHint: 'prompted_content_project_reflective',
    }
  );

  if (!result.ok) {
    console.error('[prompted-content] Project question generation failed:', result);
    return [];
  }

  const questions = Array.isArray(result.data) ? result.data : [];

  // Save to database
  const created = [];
  for (const q of questions.slice(0, QUESTIONS_PER_BATCH)) {
    if (!q.questionText) continue;

    const record = await prisma.promptedQuestion.create({
      data: {
        targetUserId: userId,
        questionText: q.questionText,
        questionType: 'PROJECT_REFLECTIVE',
        provenance: {
          sourceType: 'published_project',
          projectRef: q.projectRef || null,
        },
        atelierSignals: q.cluster
          ? {
              cluster: q.cluster,
              expectedSignals: [q.cluster],
            }
          : undefined,
        priority: 0.8, // Slightly higher than bio-reflective — project context is richer
        deliveryContext: 'feed_card',
        status: 'GENERATED',
      },
    });
    created.push(record);
  }

  console.log(`[prompted-content] Generated ${created.length} project-reflective questions for user ${userId}`);
  return created;
}

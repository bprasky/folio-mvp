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
        model: 'claude-sonnet-4-20250514',
        system: `You are generating questions for professionals in the interior design industry.
These questions will appear as beautifully typeset cards in a design magazine feed.

YOU HAVE ACCESS TO:
- The designer's bio interview (their self-narrative, philosophy, origin story)
- Their existing profile Q&A responses

CRITICAL RULES:
- Every question must trace back to something specific the designer said in their bio or interview.
- Questions should feel like they came from a thoughtful colleague who studied their work, not from a platform trying to extract content.
- Focus on wins, arrivals, and genuine curiosity about craft decisions.
- Never use: "Can you share...", "Tell us about a time...", "What insights..."
- Never ask about failures, compromises, or regrets unless framed as "what did that teach you."
- Be specific. Reference materials, spaces, decisions, places — not abstractions.
- Maximum 2 sentences per question. The best questions are one sentence.
- Questions should be answerable in 30-90 seconds of speaking or 2-4 sentences of typing.
- Do NOT repeat or closely paraphrase any existing questions provided below.

Return a JSON array of exactly ${QUESTIONS_PER_BATCH} objects:
[{
  "questionText": "The question text",
  "bioExcerptRef": "A brief quote or paraphrase of the bio content that inspired this question",
  "cluster": "A thematic cluster tag, e.g. 'material_philosophy', 'client_navigation', 'craft_decisions', 'design_origin', 'space_philosophy'"
}]`,
        messages: [
          {
            role: 'user',
            content: `DESIGNER BIO:\n${bio.folioBio}\n\nINTERVIEW ANSWERS:\n${qaBlock}\n\n${qaContext ? `EXISTING PROFILE Q&A:\n${qaContext}\n\n` : ''}${existingTexts.length > 0 ? `ALREADY ASKED (do not repeat):\n${existingTexts.join('\n')}\n\n` : ''}Generate ${QUESTIONS_PER_BATCH} bio-reflective questions for this designer.`,
          },
        ],
        max_tokens: 1200,
        temperature: 0.85,
      });

      const content = message.content[0]?.type === 'text' ? message.content[0].text : null;
      if (!content) throw new Error('No content in response');
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned) as GeneratedQuestion[];
    },
    {
      modelName: 'claude-sonnet-4-20250514',
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
        model: 'claude-sonnet-4-20250514',
        system: `You are generating questions for professionals in the interior design industry.
These questions will appear as beautifully typeset cards in a design magazine feed.

YOU HAVE ACCESS TO:
- The designer's published projects (titles, locations, rooms, editorial excerpts, interview answers)
${bio?.folioBio ? '- The designer\'s bio for cross-referencing their philosophy with specific project decisions' : ''}

YOUR GOAL:
Generate questions that reference SPECIFIC projects, rooms, materials, or decisions visible in the data.
These should feel like a thoughtful editor who visited the space asking follow-up questions.

CRITICAL RULES:
- Every question MUST reference a specific project by name, location, or a detail from it.
- Questions should surface the "why" behind visible decisions — material choices, spatial arrangements, vendor selections.
- Focus on craft pride: "What made you choose X for Y?" not "Tell us about your process."
- Never use: "Can you share...", "Tell us about a time...", "What insights..."
- Never ask about failures, compromises, or regrets unless framed as "what did that teach you."
- Maximum 2 sentences per question. The best questions are one sentence.
- Questions should be answerable in 30-90 seconds of speaking or 2-4 sentences of typing.
- Do NOT repeat or closely paraphrase any existing questions provided below.

Return a JSON array of exactly ${QUESTIONS_PER_BATCH} objects:
[{
  "questionText": "The question text",
  "projectRef": "The project title or identifier that inspired this question",
  "cluster": "A thematic cluster tag, e.g. 'material_philosophy', 'spatial_logic', 'craft_decisions', 'vendor_rationale', 'room_narrative'"
}]`,
        messages: [
          {
            role: 'user',
            content: `${projectBlocks.join('\n\n---\n\n')}${bio?.folioBio ? `\n\nDESIGNER BIO:\n${bio.folioBio}` : ''}${existingTexts.length > 0 ? `\n\nALREADY ASKED (do not repeat):\n${existingTexts.join('\n')}` : ''}\n\nGenerate ${QUESTIONS_PER_BATCH} project-reflective questions for this designer.`,
          },
        ],
        max_tokens: 1200,
        temperature: 0.85,
      });

      const content = message.content[0]?.type === 'text' ? message.content[0].text : null;
      if (!content) throw new Error('No content in response');
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned) as ProjectReflectiveQuestion[];
    },
    {
      modelName: 'claude-sonnet-4-20250514',
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

import Anthropic from "@anthropic-ai/sdk";
import { BlocksSchema } from "./schemas";
import { z } from "zod";
import { callLLM } from "./llmClient";

const client = new Anthropic();

export const FOLIO_TONE = `
Warm, confident, minimalist, design-literate. 
Describe process, intent, and materials poetically but concretely.
Avoid marketing speak; prefer quiet authority and authenticity.
`;

type GenInput = {
  project: any;
  designer?: any;
  vendors?: any[];
  images: { id: string; caption?: string }[];
  tags: any[];
  answers: {
    questionId: string;
    section: string;
    role: "DESIGNER" | "VENDOR" | "ANY";
    answer: string;
    isFollowUp?: boolean;
  }[];
  followups?: {
    question: string;
    answer: string;
  }[];
  imageOrder?: string[];
  correlationId?: string;
};

const ANTHROPIC_ENABLED = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_ENABLED !== "false";

// De-duplicate answers by content
function deduplicateAnswers(answers: GenInput['answers']) {
  const seen = new Set<string>();
  return answers.filter((a) => {
    if (!a.answer) return false;
    const normalized = a.answer.trim().toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

// Build material context from tags
function buildMaterialContext(tags: any[]) {
  const map = new Map<string, { name: string; vendor?: string; finish?: string; count: number }>();
  for (const t of tags || []) {
    const p = t?.product;
    if (!p?.id) continue;
    const key = p.id;
    const prev = map.get(key) || {
      name: p.name ?? "Product",
      vendor: p.vendor?.name,
      finish: p.finish || p.category,
      count: 0,
    };
    prev.count += 1;
    map.set(key, prev);
  }
  return Array.from(map.values());
}

// Fallback blocks generator
export function toFallbackBlocks(input: GenInput) {
  const uniqueAnswers = deduplicateAnswers(input.answers);
  const chosen = (input.imageOrder && input.imageOrder.map(id => input.images.find(i => i.id === id)).filter(Boolean) as any[]) || input.images.slice(0, 4);
  const ledger = buildMaterialContext(input.tags);
  
  const deck = (uniqueAnswers[0]?.answer || input.project?.title || "A considered composition").slice(0, 180);
  
  const blocks = {
    lead: { deck },
    galleryChapters: chosen.length ? [{
      title: input.project?.title || "Project Feature",
      body: [uniqueAnswers[0]?.answer?.slice(0, 400) || "The composition balances intention and function with a restrained material palette."],
      imageIds: chosen.slice(0, 4).map(i => i.id),
    }] : undefined,
    pullQuotes: uniqueAnswers.slice(0, 2).map(a => a.answer.slice(0, 200)).filter(Boolean),
    method: uniqueAnswers.slice(0, 6).map(a => a.answer.slice(0, 200)).filter(Boolean),
    qa: uniqueAnswers.slice(0, 5).map(q => ({
      q: "Q",
      a: q.answer.slice(0, 800),
      role: q.role === "VENDOR" ? "VENDOR" : "DESIGNER",
    })),
    materialsLedger: ledger.length ? {
      items: ledger.map(l => ({
        name: l.name,
        finish: (l.finish && typeof l.finish === 'string' && l.finish.trim()) ? l.finish : undefined,
        note: l.vendor ? `Vendor: ${l.vendor}` : undefined,
      }))
    } : undefined,
    credits: []
  };

  return BlocksSchema.parse(blocks);
}

// Extract structured blocks from narrative article
function parseNarrativeToBlocks(article: string, input: GenInput): z.infer<typeof BlocksSchema> {
  const lines = article.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Extract dek (first 1-2 sentences)
  const firstParagraph = lines[0] || '';
  const dek = firstParagraph.slice(0, 240);
  
  // Extract narrative paragraphs (skip first if it's the dek)
  const narrativeParagraphs = lines.slice(1).filter(l => l.length > 50);
  
  // Extract method section (look for "Method" or bullet points)
  const methodStart = narrativeParagraphs.findIndex(p => /method|process|approach/i.test(p));
  const method = methodStart >= 0 
    ? narrativeParagraphs.slice(methodStart, methodStart + 6).map(p => p.slice(0, 200))
    : narrativeParagraphs.slice(0, 6).map(p => p.slice(0, 200));
  
  // Extract pull quotes (look for quoted text)
  const pullQuotes = narrativeParagraphs
    .filter(p => /["']/.test(p) || p.length < 200)
    .slice(0, 3)
    .map(p => p.replace(/["']/g, '').slice(0, 200));
  
  // Use provided images
  const chosen = (input.imageOrder && input.imageOrder.map(id => input.images.find(i => i.id === id)).filter(Boolean) as any[]) || input.images.slice(0, 4);
  
  // Build materials ledger
  const ledger = buildMaterialContext(input.tags);
  
  // Build Q&A from unique answers
  const uniqueAnswers = deduplicateAnswers(input.answers);
  const qa = uniqueAnswers.slice(0, 5).map(q => ({
    q: "Q",
    a: q.answer.slice(0, 800),
    role: q.role === "VENDOR" ? "VENDOR" : "DESIGNER",
  }));
  
  const blocks = {
    lead: dek ? { deck } : undefined,
    galleryChapters: chosen.length ? [{
      title: input.project?.title || "Project Feature",
      body: narrativeParagraphs.slice(0, 3).map(p => p.slice(0, 400)),
      imageIds: chosen.slice(0, 4).map(i => i.id),
    }] : undefined,
    pullQuotes: pullQuotes.length > 0 ? pullQuotes : undefined,
    method: method.length > 0 ? method : undefined,
    qa: qa.length > 0 ? qa : undefined,
    materialsLedger: ledger.length ? {
      items: ledger.map(l => ({
        name: l.name,
        finish: (l.finish && typeof l.finish === 'string' && l.finish.trim()) ? l.finish : undefined,
        note: l.vendor ? `Vendor: ${l.vendor}` : undefined,
      }))
    } : undefined,
    credits: []
  };
  
  return BlocksSchema.parse(blocks);
}

export async function generateEditorialDraft(input: GenInput): Promise<{
  blocks: z.infer<typeof BlocksSchema>;
  usedFallback: boolean;
}> {
  const _cid = input.correlationId || 'generate';
  
  // De-duplicate answers before processing
  const uniqueAnswers = deduplicateAnswers(input.answers);
  
  // Build context
  const { project, designer, images, tags } = input;
  const products = buildMaterialContext(tags);
  
  const contextText = `
PROJECT: ${project?.title ?? ""}
DESIGNER: ${designer?.name ?? ""}
LOCATION: ${project?.city ?? project?.regionState ?? ""}
TAGGED PRODUCTS: ${products.map(p => p.name).join(", ")}
IMAGES: ${images.length}
ANSWERS: ${uniqueAnswers.map(a => `Q: ${a.questionId || 'Question'}\nA: ${a.answer}`).join("\n\n")}
${input.followups && input.followups.length > 0 ? `FOLLOWUPS: ${input.followups.map(f => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")}` : ''}
`;

  const prompt = `
You are Folio — an editorial design platform. 
Write a refined, emotionally intelligent, Architectural Digest–style article 
based on the following context. 
The tone should be sophisticated, human, and flowing — 
blending storytelling, material focus, and designer insight. 
Avoid repeating raw Q&A. Instead, narrate the project's journey.

${FOLIO_TONE}

Include:
• A short headline and a 1–2 sentence intro ("dek")
• 3–5 narrative paragraphs organized naturally
• A "Method" section describing process and design philosophy
• Optional pull quotes (if content fits)
• End with a "Materials" section summarizing key tagged materials.

CONTEXT:
${contextText}
`;

  let blocks: z.infer<typeof BlocksSchema>;
  let usedFallback = false;

  if (!ANTHROPIC_ENABLED) {
    console.warn('[posting/generate] LLM disabled, using fallback blocks', {
      projectId: input.project?.id,
      _cid,
    });
    blocks = toFallbackBlocks({ ...input, answers: uniqueAnswers });
    usedFallback = true;
  } else {
    const modelName = 'claude-sonnet-4-20250514';

    const llmResult = await callLLM(
      async () => {
        return await client.messages.create({
          model: modelName,
          temperature: 0.8,
          max_tokens: 2000,
          system: `You are Folio, the voice of modern design storytelling. ${FOLIO_TONE}`,
          messages: [
            { role: "user", content: prompt },
          ],
        });
      },
      { modelName, contextHint: `generate:${input.project?.id}`, baseDelayMs: 500 }
    );

    if (!llmResult.ok) {
      if (llmResult.code === 'moderation_block') {
        console.warn('[generate] moderation_block; using fallback', { _cid });
        usedFallback = true;
        blocks = toFallbackBlocks({ ...input, answers: uniqueAnswers });
      } else {
        usedFallback = true;
        console.warn('[generate] llm_fail_using_fallback', {
          _cid,
          code: llmResult.code,
          status: llmResult.status,
          projectId: input.project?.id,
        });
        blocks = toFallbackBlocks({ ...input, answers: uniqueAnswers });
      }
    } else {
      console.info('[generate] llm_ok', { _cid, model: llmResult.usedModel });
      const article = llmResult.data.content[0]?.type === 'text' ? llmResult.data.content[0].text : "";
      
      if (!article || article.trim().length === 0) {
        console.warn('[generate] empty_article; using fallback', { _cid });
        usedFallback = true;
        blocks = toFallbackBlocks({ ...input, answers: uniqueAnswers });
      } else {
        // Parse narrative article into structured blocks
        try {
          blocks = parseNarrativeToBlocks(article, { ...input, answers: uniqueAnswers });
        } catch (parseError) {
          console.warn('[generate] parse_error; using fallback', { _cid, error: parseError });
          usedFallback = true;
          blocks = toFallbackBlocks({ ...input, answers: uniqueAnswers });
        }
      }
    }
  }

  return { blocks, usedFallback };
}

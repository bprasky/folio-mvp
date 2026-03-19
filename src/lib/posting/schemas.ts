import { z } from "zod";

// [AUDIT] Log schema configuration
console.log("[AUDIT] schema: BlocksSchema configured", {
  strict: true, // .strict() is applied
  hasLead: true,
  hasGalleryChapters: true,
  hasCredits: true,
});

// Recomposition mode schema
export const RecompositionModeSchema = z.enum(['recomposition', 'verbatim']).default('recomposition');

// Section schema for compose stage (strict for validation) - NO QA type for recomposition mode
export const SectionSchema = z.object({
  type: z.enum(['narrative', 'pullquote']),
  heading: z.string().optional(),
  body: z.string().optional(),
  quote: z.string().optional(),
}).passthrough();

// Composed draft schema for LLM output (accepts sections at compose time)
// Uses .passthrough() so unexpected keys from the LLM don't cause validation failures
export const ComposedDraftSchema = z.object({
  lead: z.object({
    title: z.string().min(3).max(80).optional(), // Support title field
    kicker: z.string().min(3).max(80),
    deck: z.string().min(10).max(400), // Increased from implicit limit to 400
  }).strict(),
  sections: z.array(SectionSchema).min(3).max(7), // REQUIRED at compose time
  galleryChapters: z.array(z.object({
    title: z.string().optional(),
    imageIds: z.array(z.string()).min(1),
    body: z.array(z.string()).optional(),
  })).min(1),
  pullQuotes: z.array(z.union([z.string(), z.object({ text: z.string(), context: z.string().optional(), sourceSection: z.string().optional() })])).optional(),
  credits: z.array(z.object({ role: z.string(), name: z.string().nullable().optional() })).optional(),
  materialsLedger: z.object({
    items: z.array(z.object({
      name: z.string(),
      productId: z.string().nullable().optional(),
    }))
  }).optional(),
  mode: RecompositionModeSchema.optional(),
}).passthrough();

// Tolerant schema for LLM payload (accepts sections & materials temporarily) - for backward compatibility
const SectionSchemaLoose = z.object({
  type: z.enum(["narrative", "pullquote", "qa"]).optional(), // writer sometimes omits
  heading: z.string().optional(),
  body: z.string().optional(),
  quote: z.string().optional(),
  qa: z.array(z.object({ q: z.string(), a: z.string().optional() })).optional(),
}).passthrough();

// Loose schema for LLM output - tolerates sections & materials that we'll repair/strip later
export const LlmComposedLooseSchema = z.object({
  lead: z.object({
    title: z.string().max(80).optional(), // Support title field with limit
    kicker: z.string().max(80).optional(), // Increased limit
    deck: z.string().max(400).optional(), // Increased limit
    dek: z.string().max(400).optional(), // Alias for deck, same limit
  }).optional(),

  // tolerate these keys; we'll repair/strip them later
  sections: z.array(SectionSchemaLoose).optional(),
  materials: z.array(z.string()).optional(),
  mode: RecompositionModeSchema.optional(),

  galleryChapters: z.array(z.object({
    title: z.string().optional(),
    imageIds: z.array(z.string()).optional(),
    body: z.array(z.string()).optional(),
  })).optional(),

  qa: z.array(z.object({ q: z.string(), a: z.string().optional() })).optional(),
  credits: z.array(z.object({ role: z.string(), name: z.string().nullable().optional() })).optional(),

  materialsLedger: z.object({
    items: z.array(z.object({
      name: z.string(),
      productId: z.string().nullable().optional(),
    }))
  }).optional(),

  pullQuotes: z.array(z.union([z.string(), z.object({ text: z.string(), context: z.string().optional(), sourceSection: z.string().optional() })])).optional(),
  method: z.array(z.string()).optional(),
}).passthrough();

export const PostMetaSchema = z.object({
  heroAssetId: z.string().uuid().optional(),
  excerpt: z.string().max(220).optional(),
  keywords: z.array(z.string().min(1)).max(16).optional(),
  variant: z.enum([
    "PROJECT_FEATURE","MATERIAL_STUDY","METHOD","DESIGNER_PROFILE","EVENT_ESSAY"
  ]).optional(),
});

// Per-chapter pull quote selection with alternatives for cycling UI
export const PullQuoteAlternativeSchema = z.object({
  text: z.string().max(300),
  context: z.string().max(80).optional(),
  score: z.number(),
});

export const PullQuoteSelectionSchema = z.object({
  selected: z.object({
    text: z.string().max(300),
    context: z.string().max(80).optional(),
  }).nullable(),
  alternatives: z.array(PullQuoteAlternativeSchema),
});

export type PullQuoteAlternative = z.infer<typeof PullQuoteAlternativeSchema>;
export type PullQuoteSelection = z.infer<typeof PullQuoteSelectionSchema>;

export const BlocksSchema = z.object({
  lead: z.object({
    title: z.string().max(80).optional(), // Support title field (LLM sometimes generates this)
    kicker: z.string().max(80).optional(), // Increased from 48 to 80 for natural headlines
    deck: z.string().max(400).optional(), // Increased from 240 to 400 for proper magazine-style descriptions
  }).optional(),
  galleryChapters: z.array(z.object({
    title: z.string().max(80).optional(),
    body: z.array(z.string().max(5000)).optional(), // Allow very long paragraphs for recomposition (600-900 words = ~3000-4500 chars total, sections may be 1000-2000 chars each)
    imageIds: z.array(z.string().uuid()).min(1).max(8),
    pullQuote: z.union([
      z.string().max(300),       // Legacy format (backward compat)
      PullQuoteSelectionSchema,  // New format with alternatives
    ]).optional().nullable(),
  })).optional(),
  pullQuotes: z.array(
    z.union([
      z.string().max(300),
      z.object({
        text: z.string().max(300),
        context: z.string().max(80).optional(),
        sourceSection: z.string().max(80).optional(),
      }),
    ])
  ).max(5).optional(),
  materialsLedger: z.object({
    items: z.array(z.object({
      productId: z.string().uuid().nullable().optional(),
      name: z.string(),
      finish: z.string().nullish(),
      vendorId: z.string().uuid().optional(),
      note: z.string().max(140).optional(),
    })).optional(),
  }).optional(),
  method: z.array(z.string().max(200)).max(10).optional(),
  qa: z.array(z.object({
    q: z.string().max(140),
    a: z.string().max(800),
    role: z.enum(["DESIGNER","VENDOR"]).default("DESIGNER"),
  })).max(8).optional(),
  data: z.record(z.string(), z.any()).optional(),
  // Note: This is the AI-generated credits within expandedBlocks. The canonical credits
  // source is ProjectPost.credits (Json field) which uses the richer CreditEntry schema
  // from creditsSchema.ts (with userId, organizationId, url). Rendering components
  // should prefer ProjectPost.credits over expandedBlocks.credits.
  credits: z.array(z.object({
    role: z.string().max(60),
    name: z.string().max(100).nullable().optional(),
    url: z.string().url().optional(),
  })).optional(),
  mode: RecompositionModeSchema.optional(), // Store mode for rendering logic
}).strict();

export type Blocks = z.infer<typeof BlocksSchema>;

/** Normalized pull quote with optional context and source section */
export type NormalizedPullQuote = { text: string; context?: string; sourceSection?: string };

/** Normalize a pull quote entry (string or {text, context, sourceSection}) to a consistent shape */
export function normalizePullQuote(q: string | { text: string; context?: string; sourceSection?: string }): NormalizedPullQuote {
  if (typeof q === 'string') return { text: q };
  return { text: q.text, context: q.context || undefined, sourceSection: q.sourceSection || undefined };
}

/** Get the selected pull quote text from a chapter's pullQuote field (handles both legacy string and new object) */
export function getSelectedPullQuoteText(pullQuote: string | PullQuoteSelection | null | undefined): string | null {
  if (!pullQuote) return null;
  if (typeof pullQuote === 'string') return pullQuote;
  return pullQuote.selected?.text ?? null;
}

/** Get the selected pull quote context from a chapter's pullQuote field */
export function getSelectedPullQuoteContext(pullQuote: string | PullQuoteSelection | null | undefined): string | undefined {
  if (!pullQuote || typeof pullQuote === 'string') return undefined;
  return pullQuote.selected?.context ?? undefined;
}

/** Check if a pullQuote value is in the new PullQuoteSelection format */
export function isPullQuoteSelection(pullQuote: unknown): pullQuote is PullQuoteSelection {
  return typeof pullQuote === 'object' && pullQuote !== null && 'alternatives' in pullQuote;
}

/** Sync top-level pullQuotes array from per-chapter selections */
export function syncPullQuotesFromChapters(blocks: Record<string, any>): void {
  const chapters = blocks.galleryChapters as Array<{ title?: string; pullQuote?: string | PullQuoteSelection | null }> | undefined;
  if (!chapters) return;
  const pullQuotes: NormalizedPullQuote[] = [];
  for (const ch of chapters) {
    const text = getSelectedPullQuoteText(ch.pullQuote);
    if (text) {
      const context = getSelectedPullQuoteContext(ch.pullQuote);
      pullQuotes.push({ text, context, sourceSection: ch.title });
    }
  }
  blocks.pullQuotes = pullQuotes.length > 0 ? pullQuotes : undefined;
}

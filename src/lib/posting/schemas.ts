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

// Per-chapter pull quote selection with alternatives for cycling UI
/**
 * Where a quote came from, durably.
 *
 * (questionId, isFollowUp) is the row key `rebuildAnswerProjection` already
 * treats as an answer's identity within an interview. It is the only handle that
 * survives a sync: the projection row `id` is re-minted by randomUUID() on every
 * rebuild, and `answerIndex` on a candidate indexes an in-memory array that does
 * not outlive the run.
 *
 * Optional, and absent on every quote selected before this landed. ABSENT MEANS
 * UNVERIFIABLE, NOT INVALID — a quote chosen under the old code is still a
 * verbatim span, it simply has no recorded pointer to re-check it against. No
 * backfill: a pointer inferred after the fact would be a guess wearing the
 * costume of a record.
 */
export const QuoteProvenanceSchema = z.object({
  questionId: z.string().max(200),
  isFollowUp: z.boolean(),
});
export type QuoteProvenance = z.infer<typeof QuoteProvenanceSchema>;

/** Folio's room teaser, with the interview evidence used to write it. */
export const FolioLineSchema = z.object({
  text: z.string().trim().min(1).max(300),
  originalText: z.string().min(1).max(300),
  sources: z.array(QuoteProvenanceSchema.extend({
    excerpt: z.string().min(1).max(4000),
  })).min(1).max(3),
});
export type FolioLine = z.infer<typeof FolioLineSchema>;

export const PullQuoteAlternativeSchema = z.object({
  text: z.string().max(300),
  context: z.string().max(80).optional(),
  score: z.number(),
  /** Every alternative carries its own: the picker lets a designer cycle to any
   *  of them and publish it, so a pointer on the selected quote alone would go
   *  stale the moment they cycled. */
  provenance: QuoteProvenanceSchema.optional(),
});

/**
 * Who wrote the line under the photograph.
 *
 * `verbatim` — the designer's own sentence, chosen from their interview answers.
 * `folio`    — Folio writing about their decisions on their behalf.
 *
 * These are two legitimate authorship choices, not a quality ladder, and the
 * distinction is exactly the one a reader is entitled to. Folio versions live
 * in a separate pool: switching modes never changes the original direct quotes.
 */
export const PullQuoteAuthorshipSchema = z.enum(['verbatim', 'folio']);
export type PullQuoteAuthorship = z.infer<typeof PullQuoteAuthorshipSchema>;

export const PullQuoteSelectionSchema = z.object({
  selected: z.object({
    text: z.string().max(300),
    context: z.string().max(80).optional(),
    provenance: QuoteProvenanceSchema.optional(),
  }).nullable(),
  alternatives: z.array(PullQuoteAlternativeSchema),
  /** Absent on every article generated before the toggle; absent means `verbatim`. */
  authorship: PullQuoteAuthorshipSchema.optional(),
  folio: z.object({
    generatorVersion: z.literal(2).optional(),
    selected: FolioLineSchema.nullable(),
    alternatives: z.array(FolioLineSchema).min(1).max(6),
  }).optional(),
});

/**
 * Headline options, one or more per eligible ANGLE.
 *
 * `angle` is the frame id the candidate was written to (`constraint`,
 * `governing-decision`, `change`); `angleLabel` is that frame's `name`, which is
 * already written for display and needs no authoring. Position encoded the angle
 * inside the generating route and was used three times there — to spread the kept
 * set, to log per-keep angles, to log coverage — and then thrown away when `kept`
 * mapped to `s.text`. This is where it stops being thrown away.
 *
 * Why it matters: the batch has been several angles since C3, and presenting it as
 * six interchangeable strings asked the designer to compare wordings when what
 * actually differs is the story.
 */
export const TitleAlternativeSchema = z.object({
  text: z.string().max(120),
  angle: z.string().max(40),
  angleLabel: z.string().max(60),
});

export const TitleSelectionSchema = z.object({
  selected: z.object({
    text: z.string().max(120),
    angle: z.string().max(40),
    angleLabel: z.string().max(60),
  }).nullable(),
  alternatives: z.array(TitleAlternativeSchema).max(16),
});

export type TitleAlternative = z.infer<typeof TitleAlternativeSchema>;
export type TitleSelection = z.infer<typeof TitleSelectionSchema>;

// Composed draft schema for LLM output (accepts sections at compose time)
// Uses .passthrough() so unexpected keys from the LLM don't cause validation failures
export const ComposedDraftSchema = z.object({
  lead: z.object({
    title: z.string().min(3).max(120).optional(), // Support title field
    kicker: z.string().min(3).max(120),
    deck: z.string().min(10).max(400), // Increased from implicit limit to 400
  }).strict(),
  sections: z.array(SectionSchema).min(3).max(15), // REQUIRED at compose time (rooms + pullquotes can exceed 7)
  galleryChapters: z.array(z.object({
    title: z.string().optional(),
    imageIds: z.array(z.string()).min(1),
    body: z.array(z.string()).optional(),
    pullQuote: z.union([
      z.string().max(300),
      PullQuoteSelectionSchema,
    ]).optional().nullable(),
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
    title: z.string().max(120).optional(), // Support title field with limit
    kicker: z.string().max(120).optional(), // Increased limit
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
    pullQuote: z.union([
      z.string().max(300),
      PullQuoteSelectionSchema,
    ]).optional().nullable(),
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

export type PullQuoteAlternative = z.infer<typeof PullQuoteAlternativeSchema>;
export type PullQuoteSelection = z.infer<typeof PullQuoteSelectionSchema>;

export const BlocksSchema = z.object({
  lead: z.object({
    title: z.string().max(120).optional(), // Support title field (LLM sometimes generates this)
    kicker: z.string().max(120).optional(), // Increased from 80 to 120 for natural headlines
    deck: z.string().max(400).optional(), // Increased from 240 to 400 for proper magazine-style descriptions
    // Headline options the designer cycles through, newest batch replacing the
    // last. Written only by the headline regenerate endpoint, and only with
    // candidates that already passed `headlineIssues` — so cycling cannot land
    // on a headline that breaks house style. The live headline stays `kicker`
    // until the designer picks one; a batch they don't like costs them nothing.
    // Declared here because BlocksSchema is strict: an undeclared key is
    // stripped on the next parse, which would silently empty the picker.
    // Union, not a replacement. Every pool in production today is a bare
    // `string[]`, and `BlocksSchema` is strict — an undeclared key is stripped on
    // the next parse — so dropping the legacy arm would silently empty the picker
    // for every existing project. Readers go through `normalizeTitleAlternatives`,
    // exactly as pull quotes go through `normalizePullQuote`.
    kickerAlternatives: z.union([
      z.array(z.string().max(120)).max(16),
      TitleSelectionSchema,
    ]).optional(),
  }).optional(),
  introduction: z.array(z.string().max(2000)).max(4).optional(),
  galleryChapters: z.array(z.object({
    title: z.string().max(120).optional(),
    body: z.array(z.string().max(5000)).optional(), // Allow very long paragraphs for recomposition (600-900 words = ~3000-4500 chars total, sections may be 1000-2000 chars each)
    imageIds: z.array(z.string().uuid()).min(1).max(8),
    pullQuote: z.union([
      z.string().max(300),       // Legacy format (backward compat)
      PullQuoteSelectionSchema,  // New format with alternatives
    ]).optional().nullable(),
    // Append-only room chapters (ADR append-only-room-chapters, C1). All three
    // are OPTIONAL so legacy blocks (5 rows in prod, none carrying `kind`) still
    // parse. `kind` distinguishes an editorial write-up from a photo-only gallery
    // block; `roomId` ties an editorial chapter to its Room so it can be frozen
    // across regenerations; `generatedAt` records the pass that wrote it.
    roomId: z.string().nullable().optional(),
    generatedAt: z.number().optional(),
    kind: z.enum(['editorial', 'gallery']).optional(),
  })).optional(),
  // NOT an editorial selection — the generation prompt explicitly forbids the
  // model from emitting this array. It is a DERIVED INDEX, built by
  // `syncPullQuotesFromChapters` as the hook quote (index 0, no sourceSection)
  // followed by one entry per gallery chapter, keyed by chapter title.
  //
  // Its length is therefore a function of `galleryChapters`, which is uncapped —
  // a house has as many rooms as it has. This field carried `.max(5)` until a
  // 10-room project hit it: generation and JSON parsing both succeeded, then
  // validation threw `too_big` and the whole draft was discarded
  // (LLM_REPAIR_FAILED, cid generate_019bb0c31bfc). The effective ceiling was 4
  // rooms. Truncating the index instead would silently break the
  // `sourceSection` lookup `layoutEngine.ts` uses as its per-chapter fallback,
  // so the cap is gone rather than enforced by dropping entries. The two sibling
  // declarations of this field in this file never carried a cap either.
  //
  // Per-entry limits below still bind; only the array length is unbounded.
  pullQuotes: z.array(
    z.union([
      z.string().max(300),
      z.object({
        text: z.string().max(300),
        context: z.string().max(80).optional(),
        sourceSection: z.string().max(80).optional(),
      }),
    ])
  ).optional(),
  // Editorially spliced lead pull quote drawn from the designer's hook-opener
  // answer (and its adaptive follow-up, if any). When present, this wins over
  // extracted chapter quotes for the article's lead slot.
  hookQuote: z.object({
    text: z.string().max(300),
    context: z.string().max(80).optional(),
  }).optional(),
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

/** Normalize a pull quote entry (string, {text, context, sourceSection}, or PullQuoteSelection) to a consistent shape */
export function normalizePullQuote(q: string | { text: string; context?: string; sourceSection?: string; selected?: { text: string; context?: string } | null; alternatives?: unknown[] }): NormalizedPullQuote {
  if (typeof q === 'string') return { text: q };
  if ('authorship' in q && q.authorship === 'folio') return { text: '' };
  // Handle PullQuoteSelection format — extract from selected
  if ('selected' in q && 'alternatives' in q) {
    const sel = q.selected;
    if (!sel) return { text: '' };
    return { text: sel.text, context: sel.context || undefined };
  }
  return { text: q.text, context: q.context || undefined, sourceSection: q.sourceSection || undefined };
}

/** Get the selected pull quote text from a chapter's pullQuote field (handles both legacy string and new object) */
export function getSelectedPullQuoteText(pullQuote: string | PullQuoteSelection | null | undefined): string | null {
  if (!pullQuote) return null;
  if (typeof pullQuote === 'string') return pullQuote;
  // Quote-only consumers (including export overlays) must never receive a rewrite.
  if (pullQuote.authorship === 'folio') return null;
  return pullQuote.selected?.text ?? null;
}

/** Display copy for a room; the renderer must respect its authorship. */
export function getSelectedRoomLineText(pullQuote: string | PullQuoteSelection | null | undefined): string | null {
  if (pullQuote && typeof pullQuote !== 'string' && pullQuote.authorship === 'folio') {
    return pullQuote.folio?.selected?.text ?? null;
  }
  return getSelectedPullQuoteText(pullQuote);
}

/** Get the selected pull quote context from a chapter's pullQuote field */
export function getSelectedPullQuoteContext(pullQuote: string | PullQuoteSelection | null | undefined): string | undefined {
  if (!pullQuote || typeof pullQuote === 'string') return undefined;
  return pullQuote.selected?.context ?? undefined;
}

/**
 * Normalize a stored headline pool to the structured shape.
 *
 * Accepts the legacy `string[]` and the new `TitleSelection`, and mirrors
 * `normalizePullQuote` because the migration problem is identical: the shape
 * changed after data existed, so the reader carries the union rather than a
 * backfill. A legacy entry gets no angle — which is honest, since none was
 * recorded — and the picker renders it without a label.
 */
export function normalizeTitleAlternatives(
  stored: unknown,
): { selected: TitleAlternative | null; alternatives: TitleAlternative[] } {
  if (Array.isArray(stored)) {
    return {
      selected: null,
      alternatives: stored
        .filter((t): t is string => typeof t === 'string' && !!t.trim())
        .map((text) => ({ text, angle: '', angleLabel: '' })),
    };
  }
  if (stored && typeof stored === 'object' && 'alternatives' in stored) {
    const sel = (stored as TitleSelection).selected;
    const alts = (stored as TitleSelection).alternatives;
    return {
      selected: sel ?? null,
      alternatives: Array.isArray(alts) ? alts.filter((a) => a && typeof a.text === 'string' && a.text.trim()) : [],
    };
  }
  return { selected: null, alternatives: [] };
}

/** Check if a pullQuote value is in the new PullQuoteSelection format */
export function isPullQuoteSelection(pullQuote: unknown): pullQuote is PullQuoteSelection {
  return typeof pullQuote === 'object' && pullQuote !== null && 'alternatives' in pullQuote;
}

/** Sync top-level pullQuotes array from per-chapter selections.
 *
 * When `blocks.hookQuote` is present it is prepended WITHOUT a `sourceSection`
 * — `buildRoomTiles.ts` prefers the first entry without a `sourceSection` as
 * the project-level lead quote, so this guarantees the spliced hook quote
 * wins the top-of-post slot.
 */
export function syncPullQuotesFromChapters(blocks: Record<string, any>): void {
  const chapters = blocks.galleryChapters as Array<{ title?: string; pullQuote?: string | PullQuoteSelection | null }> | undefined;
  const pullQuotes: NormalizedPullQuote[] = [];

  const hookQuote = blocks.hookQuote as { text?: string; context?: string } | undefined;
  if (hookQuote?.text) {
    pullQuotes.push({ text: hookQuote.text, context: hookQuote.context || undefined });
  }

  if (chapters) {
    for (const ch of chapters) {
      const text = getSelectedPullQuoteText(ch.pullQuote);
      if (!text) continue;
      // Avoid duplicating the hook quote if a chapter happens to have the same line.
      if (hookQuote?.text && text.trim() === hookQuote.text.trim()) continue;
      const context = getSelectedPullQuoteContext(ch.pullQuote);
      pullQuotes.push({ text, context, sourceSection: ch.title });
    }
  }

  blocks.pullQuotes = pullQuotes.length > 0 ? pullQuotes : undefined;
}

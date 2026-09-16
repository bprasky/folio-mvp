// src/lib/story/buildRoomTiles.ts
//
// Transforms getPostBySlug() data into structured room tile data
// for the Folio Story Format mosaic layout.

import { buildEditorialChapters, type EditorialChapter } from "@/lib/editorial/buildEditorialChapters";
import { getSelectedRoomLineText, type PullQuoteSelection } from "@/lib/posting/schemas";
import { formatRoomName } from "@/lib/utils/formatRoomName";
import { blockingIssues } from "@/lib/posting/headline";
import { normalizeTitleAlternatives, type TitleAlternative } from "@/lib/posting/schemas";
import { hasWeakPredicate } from "@/lib/interview/prompts/headlineFrames";
import { embeddedQuoteOptions, embeddedQuoteCredits, embeddedQuoteAttribution, savedEmbeddedQuoteChoices, type EmbeddedQuoteOption } from '@/lib/posting/embeddedQuotes';
import type { EmbeddedQuoteChoice } from '@/lib/posting/schemas';

// --- Types ---

export type TilePattern = 1 | 2 | 3 | 4;

export interface RoomTileData {
  roomId: string;
  /**
   * Index into `expandedBlocks.galleryChapters` — the key the section-override
   * API is addressed by.
   *
   * NOT the tile's own position: tiles without a usable image are dropped below,
   * so the two diverge the moment any chapter lacks a photo. Editing keyed by
   * tile position would then write into the wrong room.
   */
  chapterIndex: number;
  roomLabel: string;
  roomSlug: string;
  heroImage: { id: string; url: string; tags?: any[] };
  pullQuote: string | null;
  /**
   * The unresolved pull quote, alternatives included. `pullQuote` above is just
   * the selected text, which is all a reader needs; the owner's picker needs the
   * list it is allowed to choose from.
   */
  pullQuoteSelection: string | PullQuoteSelection | null;
  attribution: string;
  productCount: number;
  products: any[];
  additionalImages: Array<{ id: string; url: string; tags?: any[] }>;
  editorialNarrative: string | null;
  /** The same narrative, still addressable per paragraph. See EditorialChapter. */
  editorialParagraphs: string[];
  editorialTeaser: string | null;
  pattern: TilePattern;
}

export interface BreatherData {
  id: string;
  insertAfterRoomSlug: string;
  quote: string;
  attribution: string;
  choice: EmbeddedQuoteChoice;
  options: EmbeddedQuoteOption[];
  credits: ReturnType<typeof embeddedQuoteCredits>;
}

export interface StoryData {
  title: string;
  subtitle: string | null;
  slug: string;
  heroImageUrl: string;
  heroImage: { id: string; url: string; name?: string | null; room?: string | null; tags?: any[] } | null;
  projectPullQuote: string | null;
  projectPullQuoteIsAttributed: boolean;
  introText: string | null;
  /** The same intro, per paragraph — see RoomTileData.editorialParagraphs. */
  introParagraphs: string[];
  /** Headline options the owner cycles through. Empty on the published page. */
  titleAlternatives: TitleAlternative[];
  credits: Array<{ role: string; name: string; url?: string }>;
  designerName: string;
  designerStudio: string | null;
  designerProfileImage: string | null;
  location: string | null;
  roomCount: number;
  roomTiles: RoomTileData[];
  breathers: BreatherData[];
  supplementalQuotes: any[];
}

// --- Room slug generation ---

function toRoomSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// --- Pattern assignment ---

function assignPatterns(chapters: EditorialChapter[]): TilePattern[] {
  const n = chapters.length;
  if (n === 0) return [];
  if (n === 1) return [3]; // Single room gets full-width treatment

  const patterns: TilePattern[] = [];

  // Score chapters for full-width eligibility (patterns 3/4)
  const scores = chapters.map((ch, idx) => {
    let score = 0;
    const imageCount = 1 + (ch.supportingImages?.length ?? 0);
    const productCount = ch.taggedProducts?.length ?? 0;
    const bodyLength = ch.body?.length ?? 0;

    if (imageCount >= 3) score += 3;
    if (productCount >= 3) score += 2;
    if (bodyLength > 500) score += 1;
    // First and last chapters get slight boost for dramatic framing
    if (idx === 0) score += 1;
    if (idx === n - 1) score += 1;
    return { idx, score };
  });

  // Pick 1-2 chapters for full-width (patterns 3 or 4)
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const fullWidthCount = Math.min(2, Math.max(1, Math.floor(n * 0.3)));
  const fullWidthIndices = new Set(
    sorted.slice(0, fullWidthCount).map((s) => s.idx)
  );

  // Assign patterns with zigzag rule
  let lastPattern: TilePattern | null = null;
  let standardAlternator = true; // true = pattern 1, false = pattern 2

  for (let i = 0; i < n; i++) {
    let pattern: TilePattern;

    if (fullWidthIndices.has(i)) {
      // Full-width: use pattern 3, or 4 if chapter has rich content
      const ch = chapters[i];
      const hasRichContent =
        (ch.body?.length ?? 0) > 400 && ch.taggedProducts.length >= 2;
      pattern = hasRichContent ? 4 : 3;
    } else {
      // Standard: alternate 1/2
      pattern = standardAlternator ? 1 : 2;
      standardAlternator = !standardAlternator;
    }

    // Ensure no two adjacent rooms use the same pattern
    if (pattern === lastPattern) {
      if (pattern === 1) pattern = 2;
      else if (pattern === 2) pattern = 1;
      else if (pattern === 3) pattern = 4;
      else pattern = 3;
    }

    patterns.push(pattern);
    lastPattern = pattern;
  }

  return patterns;
}

// --- Breather placement ---

function placeBreathers(
  roomTiles: RoomTileData[],
  post: any
): BreatherData[] {
  const breathers: BreatherData[] = [];
  if (roomTiles.length < 3) return breathers;

  // Collect all quotes already used by room tiles so we never duplicate
  const usedQuotes = new Set<string>();
  for (const tile of roomTiles) {
    if (tile.pullQuote) usedQuotes.add(tile.pullQuote);
  }

  const candidates = embeddedQuoteOptions(post);
  // Preserve the existing automatic placements. Extra room alternatives are
  // choices for the owner, not a reason to add more quotations to the article.
  const indexedTexts = new Set((post?.expandedBlocks?.pullQuotes ?? []).map((quote: any) => typeof quote === 'string' ? quote : quote.text));
  const defaults = candidates.filter(option => {
    if (usedQuotes.has(option.text) || (!option.contributorAttribution && !indexedTexts.has(option.text))) return false;
    usedQuotes.add(option.text);
    return true;
  });
  const saved = savedEmbeddedQuoteChoices(post.expandedBlocks);
  const credits = embeddedQuoteCredits(post.project);

  // Insert breathers after every 2-3 rooms
  const intervals = roomTiles.length <= 4 ? [2] : [2, 5];

  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];
    if (interval >= roomTiles.length) break;
    const slotId = `breather-${interval}` as EmbeddedQuoteChoice['slotId'];
    const stored = saved.find(choice => choice.slotId === slotId);
    const selected = candidates.find(option => option.sourceId === stored?.sourceId && option.text === stored.text)
      ?? defaults[i];
    if (!selected) continue;
    const choice: EmbeddedQuoteChoice = { slotId, sourceId: selected.sourceId, text: selected.text,
      attribution: stored?.attribution ?? (credits.organization ? 'organization' : credits.designer ? 'designer' : undefined) };

    const afterRoom = roomTiles[interval - 1];
    breathers.push({
      id: slotId,
      insertAfterRoomSlug: afterRoom.roomSlug,
      quote: selected.text,
      attribution: embeddedQuoteAttribution(selected, choice, post.project),
      choice,
      options: candidates,
      credits,
    });
  }

  return breathers;
}

// --- Main builder ---

export function buildStoryData(post: any): StoryData | null {
  if (!post || !post.project) return null;

  const chapters = buildEditorialChapters(post);
  if (!chapters.length) return null;

  const blocks = post.expandedBlocks as any;
  const project = post.project;
  const designer = project.designer;

  // Title and intro
  const title =
    blocks?.lead?.title ?? blocks?.lead?.kicker ?? project.title ?? "Untitled";
  const subtitle = blocks?.lead?.deck ?? post.excerpt ?? null;
  // Unchanged: this string is what the published article renders.
  const introText =
    Array.isArray(blocks?.introduction)
      ? blocks.introduction.join("\n\n")
      : subtitle;
  // Stored batches are re-checked on the way out, not trusted because they were
  // clean when they were written.
  //
  // The pool lives in expandedBlocks, so it outlives the rules that produced it.
  // A shape banned this week is still sitting in every batch generated before the
  // ban — which is exactly how "the exterior stays quiet so the rooms can argue"
  // kept being offered days after it was rejected at the source. Re-grading here
  // costs one regex sweep and retires an offer everywhere it is read, without
  // making the designer regenerate to get the benefit of a rule.
  //
  // Only the mechanical checks run here: they are free and have no opinion. The
  // editorial pass is a model call and belongs at write time, in the endpoint.
  //
  // `hasWeakPredicate` is one of the mechanical ones and was missing from this
  // list, which cost exactly what the re-grade exists to prevent. It shipped as a
  // route-only check, so every pool written before it kept offering the shapes it
  // bans — "A stairway's mixed metals WERE KEPT, then let loose into rooms next
  // door" survived here, because `blockingIssues` has no opinion about voice and
  // nothing else looked. A stale batch could not self-clean, and the only way to
  // stop being offered a passive headline was to generate a new batch.
  // Both shapes, because every pool written before P1 is a bare `string[]` and a
  // legacy entry simply carries no angle — which is honest, since none was recorded.
  const titleAlternatives: TitleAlternative[] = normalizeTitleAlternatives(
    blocks?.lead?.kickerAlternatives,
  ).alternatives.filter(
    (a) => blockingIssues(a.text).length === 0 && !hasWeakPredicate(a.text),
  );
  // Additive: the same paragraphs, still individually addressable for editing.
  const introParagraphs: string[] = Array.isArray(blocks?.introduction)
    ? blocks.introduction.filter((p: unknown): p is string => typeof p === "string" && !!p.trim())
    : [];

  // Main pull quote — prefer project-level designer quotes; fall back to
  // editorial deck (summary copy) only when no quote exists. The fallback is
  // not an actual quote, so the renderer must not wrap it in quote marks or
  // attribute it to the designer.
  let projectPullQuote: string | null = null;
  let projectPullQuoteIsAttributed = false;

  // 1. Top-level pullQuotes — only an unsectioned (project-level) quote qualifies.
  //    Sectioned (chapter) quotes are piece-specific by construction and must
  //    never appear in the lead slot.
  if (Array.isArray(blocks?.pullQuotes) && blocks.pullQuotes.length > 0) {
    for (const pq of blocks.pullQuotes) {
      const text = typeof pq === "string" ? pq : pq?.text;
      const section = typeof pq === "string" ? null : pq?.sourceSection;
      if (text && !section) {
        projectPullQuote = text;
        projectPullQuoteIsAttributed = true;
        break;
      }
    }
  }

  // 2. Editorial deck fallback — summary copy, render plain (no quote marks,
  //    no attribution). Stays until the interview reliably produces a signature
  //    intro pull quote.
  if (!projectPullQuote) {
    projectPullQuote = blocks?.lead?.deck ?? null;
  }

  // Hero image: first chapter's primary image, or heroAssetId, or first project image
  const heroAssetId = post.heroAssetId;
  const projectImages = project.images ?? [];
  let heroImage: { id: string; url: string; name?: string | null; room?: string | null; tags?: any[] } | null = null;

  if (heroAssetId) {
    const found = projectImages.find((img: any) => img.id === heroAssetId);
    if (found?.url) heroImage = found;
  }
  if (!heroImage && chapters[0]?.primaryImage?.url) {
    heroImage = chapters[0].primaryImage;
  }
  if (!heroImage && projectImages[0]?.url) {
    heroImage = projectImages[0];
  }

  // Credits
  const credits: Array<{ role: string; name: string; url?: string }> = [];
  if (Array.isArray(blocks?.credits)) {
    credits.push(...blocks.credits);
  }
  if (designer?.name && !credits.some((c) => c.name === designer.name)) {
    credits.unshift({ role: "Designer", name: designer.name, url: designer.website });
  }

  // Location
  const location = [project.city, project.regionState].filter(Boolean).join(", ") || null;

  // Build room tiles from chapters
  const patterns = assignPatterns(chapters);
  const designerName = designer?.studio || designer?.name || "Designer";

  const roomTiles: RoomTileData[] = chapters
    .map((chapter, idx) => {
      const roomLabel = chapter.title
        ? formatRoomName(chapter.title)
        : `Room ${idx + 1}`;
      const roomSlug = chapter.title ? toRoomSlug(chapter.title) : `room-${idx + 1}`;

      if (!chapter.primaryImage?.url) return null;

      // Editorial teaser: first sentence or first 120 chars of body
      let editorialTeaser: string | null = null;
      if (chapter.body) {
        const firstSentence = chapter.body.match(/^[^.!?]+[.!?]/);
        editorialTeaser = firstSentence
          ? firstSentence[0]
          : chapter.body.slice(0, 120) + (chapter.body.length > 120 ? "..." : "");
      }

      return {
        roomId: chapter.id,
        chapterIndex: chapter.index,
        roomLabel,
        roomSlug,
        heroImage: chapter.primaryImage,
        pullQuote: getSelectedRoomLineText(chapter.pullQuote),
        pullQuoteSelection: chapter.pullQuote ?? null,
        attribution: designerName,
        productCount: chapter.taggedProducts.length,
        products: chapter.taggedProducts,
        additionalImages: (chapter.supportingImages ?? []).filter(
          (img: any) => img?.url
        ),
        editorialNarrative: chapter.body ?? null,
        editorialParagraphs: chapter.bodyParagraphs ?? [],
        editorialTeaser,
        pattern: patterns[idx] ?? 1,
      } as RoomTileData;
    })
    .filter(Boolean) as RoomTileData[];

  // Place breathers
  const breathers = placeBreathers(roomTiles, post);

  return {
    title,
    subtitle,
    slug: post.slug,
    heroImageUrl: heroImage?.url ?? "",
    heroImage,
    projectPullQuote,
    projectPullQuoteIsAttributed,
    introText,
    introParagraphs,
    titleAlternatives,
    credits,
    designerName,
    designerStudio: designer?.studio ?? null,
    designerProfileImage: designer?.profileImage ?? null,
    location,
    roomCount: roomTiles.length,
    roomTiles,
    breathers,
    supplementalQuotes: post.supplementalQuotes ?? [],
  };
}

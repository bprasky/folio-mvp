// src/lib/story/buildRoomTiles.ts
//
// Transforms getPostBySlug() data into structured room tile data
// for the Folio Story Format mosaic layout.

import { buildEditorialChapters, type EditorialChapter } from "@/lib/editorial/buildEditorialChapters";
import { getSelectedPullQuoteText } from "@/lib/posting/schemas";
import { formatRoomName } from "@/lib/utils/formatRoomName";

// --- Types ---

export type TilePattern = 1 | 2 | 3 | 4;

export interface RoomTileData {
  roomId: string;
  roomLabel: string;
  roomSlug: string;
  heroImage: { id: string; url: string; tags?: any[] };
  pullQuote: string | null;
  attribution: string;
  productCount: number;
  products: any[];
  additionalImages: Array<{ id: string; url: string; tags?: any[] }>;
  editorialNarrative: string | null;
  editorialTeaser: string | null;
  pattern: TilePattern;
}

export interface BreatherData {
  id: string;
  insertAfterRoomSlug: string;
  quote: string;
  attribution: string;
}

export interface StoryData {
  title: string;
  subtitle: string | null;
  slug: string;
  heroImageUrl: string;
  heroImage: { id: string; url: string; tags?: any[] } | null;
  projectPullQuote: string | null;
  introText: string | null;
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

  // Candidate pool: supplemental quotes from non-designer contributors (architect, builder, etc.)
  // These are the best breathers — they shift perspective away from the room-level designer voice
  const candidates: Array<{ text: string; attribution: string }> = [];

  const supplementalBreathers =
    post?.supplementalQuotes
      ?.filter((sq: any) => sq.pinned && sq.answer && sq.contributorRole !== "DESIGNER")
      ?.map((sq: any) => ({
        text: sq.answer,
        attribution: sq.contributorRole
          ? formatRoomName(sq.contributorRole.toLowerCase())
          : "Contributor",
      })) ?? [];

  for (const sb of supplementalBreathers) {
    if (!usedQuotes.has(sb.text)) {
      candidates.push(sb);
      usedQuotes.add(sb.text);
    }
  }

  // Next: top-level pull quotes that are NOT room-specific (no sourceSection)
  // These are project-level quotes that won't duplicate any room tile
  const topQuotes: Array<{ text: string; context?: string; sourceSection?: string }> =
    Array.isArray(post?.expandedBlocks?.pullQuotes)
      ? post.expandedBlocks.pullQuotes
          .map((q: any) => {
            if (typeof q === "string") return { text: q };
            return { text: q.text, context: q.context, sourceSection: q.sourceSection };
          })
          .filter((q: any) => q.text)
      : [];

  for (const tq of topQuotes) {
    // Skip if this quote is already used by a room tile
    if (usedQuotes.has(tq.text)) continue;
    // Prefer non-room-specific quotes; room-specific ones are last resort
    candidates.push({
      text: tq.text,
      attribution: tq.sourceSection
        ? formatRoomName(tq.sourceSection)
        : post?.project?.designer?.name ?? "Designer",
    });
    usedQuotes.add(tq.text);
  }

  // Insert breathers after every 2-3 rooms
  const intervals = roomTiles.length <= 4 ? [2] : [2, 5];

  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];
    if (interval >= roomTiles.length) break;
    if (i >= candidates.length) break; // No unused quotes left

    const afterRoom = roomTiles[interval - 1];
    breathers.push({
      id: `breather-${interval}`,
      insertAfterRoomSlug: afterRoom.roomSlug,
      quote: candidates[i].text,
      attribution: candidates[i].attribution,
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
  const introText =
    Array.isArray(blocks?.introduction)
      ? blocks.introduction.join("\n\n")
      : subtitle;

  // Main pull quote (from first chapter or top-level)
  let projectPullQuote: string | null = null;
  if (chapters[0]) {
    projectPullQuote = getSelectedPullQuoteText(chapters[0].pullQuote);
  }
  if (!projectPullQuote && Array.isArray(blocks?.pullQuotes) && blocks.pullQuotes.length > 0) {
    const first = blocks.pullQuotes[0];
    projectPullQuote = typeof first === "string" ? first : first?.text ?? null;
  }

  // Hero image: first chapter's primary image, or heroAssetId, or first project image
  const heroAssetId = post.heroAssetId;
  const projectImages = project.images ?? [];
  let heroImage: { id: string; url: string; tags?: any[] } | null = null;

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
        roomLabel,
        roomSlug,
        heroImage: chapter.primaryImage,
        pullQuote: getSelectedPullQuoteText(chapter.pullQuote),
        attribution: designerName,
        productCount: chapter.taggedProducts.length,
        products: chapter.taggedProducts,
        additionalImages: (chapter.supportingImages ?? []).filter(
          (img: any) => img?.url
        ),
        editorialNarrative: chapter.body ?? null,
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
    introText,
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

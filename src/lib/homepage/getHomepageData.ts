// src/lib/homepage/getHomepageData.ts
//
// Homepage Editorial Elevation Feed — data layer (Task 05)
//
// Assembles the homepage shape:
//   1. XL hero — current-window editorial post, with algorithmic fallback
//   2. Boost reel — products tagged in the XL post, top 2 by vendor bid + 5 organic
//   3. Mosaic feed — refresh feed (reuses getFilteredPosts)
//
// Selection contracts (locked in spec/Task 05):
//   - Hero is editorial. The Following filter NEVER personalizes the hero.
//   - Reel is per-XL-post: products tagged on the post's project images.
//   - Reel ordering: HomepageReelBoost.bidCents DESC, createdAt ASC for deterministic
//     tiebreak, capped at 2 paid slots. Slots 3–7 fill organically by tag-creation order.
//   - "+N View all" cell renders when totalTagged > 7 with N = totalTagged - 7.
//
// Cache strategy: server components call this directly (no HTTP). Anonymous
// callers can be wrapped with unstable_cache by the orchestrator. Authenticated
// callers (Following=true) skip cache.

import { prisma } from "@/lib/prisma";
import { getFilteredPosts, type FeedFilter } from "@/lib/magazine/getFilteredPosts";
import type { MagazineMosaicItem } from "@/lib/magazine/getMagazineData";

export interface HomepageHero {
  postId: string;
  postSlug: string;
  projectId: string;
  title: string;
  excerpt?: string | null;
  heroImageUrl: string;
  designerName?: string | null;
  studio?: string | null;
  publishedAt: Date | null;
  /** Eyebrow source: from XL window if present, else "Editor's Pick" fallback. */
  eyebrow: string;
}

export interface BoostReelItem {
  productId: string;
  productSlug?: string | null;
  name: string;
  imageUrl: string;
  vendorName?: string | null;
  /**
   * Pre-rendered crop of the project image around the tag, stored at
   * tag-create time. Used as the second-tier fallback when the product
   * has no catalog imageUrl yet.
   */
  cropUrl?: string | null;
  /**
   * Source project image the tag was placed on. Third-tier fallback —
   * rendered with the focal point centered + scaled up so the tagged
   * region acts as a contextual crop on the fly.
   */
  sourceImageUrl?: string | null;
  /** Focal point on sourceImageUrl, 0-100 (cropX/cropY if set, else x/y). */
  focalX?: number | null;
  focalY?: number | null;
  /** True for the first 2 slots (paid); false for organic slots 3–7. */
  isBoosted: boolean;
  /** 1..7 — display position in the reel. */
  slotPosition: number;
  /** Persisted post-render for billing/analytics; only set on boosted slots. */
  boostId?: string;
}

export interface HomepageData {
  hero: HomepageHero | null;
  reel: {
    items: BoostReelItem[];
    /** Total products tagged in the XL post (drives the "+N" affordance). */
    totalTagged: number;
  };
  feedPosts: MagazineMosaicItem[];
  nextCursor: string | null;
}

const REEL_VISIBLE_SLOTS = 7;
const REEL_PAID_SLOTS = 2;
const FALLBACK_LOOKBACK_DAYS = 14;

// ────────────────────────────────────────────────────────────────────────────
// Temporary editorial pin
//
// When non-null, this slug overrides both the window-based and algorithmic
// XL-hero selection. The window check + 14-day fallback below stay in place
// so the moment this constant goes back to `null`, the system resumes its
// normal selection — no other code change required.
//
// Set to `null` (or delete the constant + the guard block in selectXlHero)
// to restore window-based + algorithmic selection.
// ────────────────────────────────────────────────────────────────────────────
const PINNED_HERO_POST_SLUG: string | null = "meru-XB4XBK";
const PINNED_HERO_EYEBROW = "Editorial Feature";

export async function getHomepageData(opts: {
  userId?: string | null;
  filter?: FeedFilter | null;
  followingOnly?: boolean;
  cursor?: string | null;
} = {}): Promise<HomepageData> {
  // Resolve followed-designer scope for the Following filter (mosaic only).
  // Fail open: if the follows query throws, the homepage still renders.
  const followedDesignerIds = await resolveFollowedDesigners(opts);

  const [hero, feed] = await Promise.all([
    selectXlHero(),
    getFilteredPosts({
      filter: opts.filter ?? null,
      cursor: opts.cursor ?? null,
      take: 12,
      followedDesignerIds,
    }),
  ]);

  const reel = hero
    ? await buildBoostReel(hero.postId, hero.projectId)
    : { items: [], totalTagged: 0 };

  // Hide the XL hero from the mosaic so we don't duplicate it.
  const feedPosts = hero
    ? feed.posts.filter((p) => p.postSlug !== hero.postSlug)
    : feed.posts;

  return { hero, reel, feedPosts, nextCursor: feed.nextCursor };
}

// ────────────────────────────────────────────────────────────────────────────
// XL hero selection
// ────────────────────────────────────────────────────────────────────────────

async function selectXlHero(): Promise<HomepageHero | null> {
  const now = new Date();

  // 0. Manual pin: when PINNED_HERO_POST_SLUG is non-null, that post wins
  //    regardless of window or recency. If the slug is set but the post
  //    isn't found / isn't published, fall through to the normal path so
  //    the homepage degrades gracefully instead of going blank.
  if (PINNED_HERO_POST_SLUG) {
    const pinned = await prisma.projectPost.findFirst({
      where: { slug: PINNED_HERO_POST_SLUG, status: "PUBLISHED" },
      select: heroSelect,
    });
    if (pinned) {
      return mapHero(pinned, PINNED_HERO_EYEBROW);
    }
    // else fall through to window/fallback
  }

  // 1. Calendar-window XL: editorial team scheduled this post for the homepage.
  const scheduled = await prisma.projectPost.findFirst({
    where: {
      status: "PUBLISHED",
      homepageXlStartsAt: { lte: now },
      homepageXlEndsAt: { gte: now },
    },
    orderBy: { homepageXlStartsAt: "desc" },
    select: heroSelect,
  });
  if (scheduled) {
    return mapHero(scheduled, daysRemainingEyebrow(scheduled.homepageXlEndsAt));
  }

  // 2. Algorithmic fallback: most recent published post in the last 14 days.
  //
  // Originally this ordered by `postSaves: { _count: "desc" }` to surface
  // highest-engagement work, but `post_saves` is part of pre-existing schema
  // drift (declared in schema.prisma, never migrated to prod) and joining to
  // it 500'd the homepage on first load. Most-recent-published is also more
  // aligned with the editorial brand: "Editor's Pick" + recency reads
  // editorial; save-count reads algorithmic. Engagement-weighted ordering
  // can come back when post_saves is reconciled by a Phase 5 fix.
  const since = new Date(now.getTime() - FALLBACK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const fallback = await prisma.projectPost.findFirst({
    where: {
      status: "PUBLISHED",
      publishedAt: { gte: since },
    },
    orderBy: { publishedAt: "desc" },
    select: heroSelect,
  });
  if (fallback) {
    return mapHero(fallback, "Editor's Pick");
  }

  // 3. No editorial in window AND no fallback. Caller skips the hero section.
  return null;
}

const heroSelect = {
  id: true,
  slug: true,
  publishedAt: true,
  heroAssetId: true,
  excerpt: true,
  expandedBlocks: true,
  homepageXlStartsAt: true,
  homepageXlEndsAt: true,
  project: {
    select: {
      id: true,
      title: true,
      images: {
        select: { id: true, url: true },
        orderBy: { displayOrder: "asc" as const },
      },
      designer: {
        select: { id: true, name: true, studio: true },
      },
    },
  },
} as const;

type RawHero = {
  id: string;
  slug: string;
  publishedAt: Date | null;
  heroAssetId: string | null;
  excerpt: string | null;
  expandedBlocks: unknown;
  homepageXlStartsAt: Date | null;
  homepageXlEndsAt: Date | null;
  project: {
    id: string;
    title: string | null;
    images: { id: string; url: string }[];
    designer: { id: string; name: string | null; studio: string | null } | null;
  } | null;
};

function mapHero(raw: RawHero, eyebrow: string): HomepageHero | null {
  if (!raw.project) return null;
  const heroImg = raw.heroAssetId
    ? raw.project.images.find((img) => img.id === raw.heroAssetId)
    : raw.project.images[0];
  if (!heroImg?.url) return null;

  const blocks = raw.expandedBlocks as { lead?: { title?: string; kicker?: string } } | null;
  const title = blocks?.lead?.title ?? blocks?.lead?.kicker ?? raw.project.title ?? "Untitled";

  return {
    postId: raw.id,
    postSlug: raw.slug,
    projectId: raw.project.id,
    title,
    excerpt: raw.excerpt ?? null,
    heroImageUrl: heroImg.url,
    designerName: raw.project.designer?.name ?? null,
    studio: raw.project.designer?.studio ?? null,
    publishedAt: raw.publishedAt,
    eyebrow,
  };
}

function daysRemainingEyebrow(endsAt: Date | null): string {
  if (!endsAt) return "Editorial Feature";
  const ms = endsAt.getTime() - Date.now();
  if (ms <= 0) return "Editorial Feature";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return days === 1 ? "1 day remaining" : `${days} days remaining`;
}

// ────────────────────────────────────────────────────────────────────────────
// Boost reel ordering
// ────────────────────────────────────────────────────────────────────────────

async function buildBoostReel(
  postId: string,
  projectId: string,
): Promise<{ items: BoostReelItem[]; totalTagged: number }> {
  // 1. All product tags on this XL post's project images, in tag-creation order.
  //    cropUrl + cropX/cropY + image.url power the contextual-crop fallback
  //    chain when Product.imageUrl is null (Phase 4 backfill catches up).
  const tags = await prisma.productTag.findMany({
    where: { image: { projectId } },
    orderBy: { createdAt: "asc" },
    select: {
      productId: true,
      createdAt: true,
      x: true,
      y: true,
      cropUrl: true,
      cropX: true,
      cropY: true,
      image: { select: { url: true } },
      product: {
        // Note: Product has no `slug` field on the deployed schema.
        // BoostReelCell falls back to `/products/${productId}` when
        // productSlug is null, which the [slug] route handler accepts
        // (it resolves by id-or-slug; other callers pass id too).
        select: {
          id: true,
          name: true,
          imageUrl: true,
          vendor: { select: { name: true } },
        },
      },
    },
  });

  // Dedupe by productId — a product tagged multiple times across images is
  // still one reel cell. Keep earliest tag.
  const uniqueProducts = new Map<string, (typeof tags)[number]>();
  for (const tag of tags) {
    if (!uniqueProducts.has(tag.productId)) {
      uniqueProducts.set(tag.productId, tag);
    }
  }
  const totalTagged = uniqueProducts.size;
  if (totalTagged === 0) {
    return { items: [], totalTagged: 0 };
  }

  // 2. Active boosts on this post for the tagged products. Highest bid wins
  //    slots 1-2; deterministic tiebreak by createdAt ASC.
  const productIds = Array.from(uniqueProducts.keys());
  const now = new Date();
  const boosts = await prisma.homepageReelBoost.findMany({
    where: {
      projectPostId: postId,
      productId: { in: productIds },
      status: "ACTIVE",
      startsAt: { lte: now },
      endsAt: { gte: now },
      bidCents: { gt: 0 },
    },
    orderBy: [{ bidCents: "desc" }, { createdAt: "asc" }],
    select: { id: true, productId: true, bidCents: true, vendorId: true },
  });

  // Dedupe by productId — keep the highest bid per product (orderBy already
  // ensures highest is first).
  const winningBoostByProduct = new Map<string, { id: string; bidCents: number }>();
  for (const b of boosts) {
    if (!winningBoostByProduct.has(b.productId)) {
      winningBoostByProduct.set(b.productId, { id: b.id, bidCents: b.bidCents });
    }
  }

  // 3. Resolve slots: paid first (top REEL_PAID_SLOTS by bid), organic fills the rest
  //    in tag-creation order, skipping any product already placed in a paid slot.
  const paidProductIds: string[] = [];
  const sortedPaid = Array.from(winningBoostByProduct.entries()).sort(
    (a, b) => b[1].bidCents - a[1].bidCents,
  );
  for (const entry of sortedPaid) {
    if (paidProductIds.length >= REEL_PAID_SLOTS) break;
    paidProductIds.push(entry[0]);
  }

  const usedIds = new Set(paidProductIds);
  const organicProductIds: string[] = [];
  // Iterate via Array.from for compatibility with older tsconfig targets.
  for (const pid of Array.from(uniqueProducts.keys())) {
    if (organicProductIds.length + paidProductIds.length >= REEL_VISIBLE_SLOTS) break;
    if (usedIds.has(pid)) continue;
    organicProductIds.push(pid);
    usedIds.add(pid);
  }

  const orderedIds = [...paidProductIds, ...organicProductIds];
  const items: BoostReelItem[] = [];
  orderedIds.forEach((pid, i) => {
    const tag = uniqueProducts.get(pid);
    if (!tag?.product) return;
    // Allow products with no catalog image through; the cell falls back
    // through cropUrl → focal-cropped project image → name+vendor text
    // so every slot is filled even while Phase 4 backfill catches up.
    const imageUrl = tag.product.imageUrl ?? "";
    const boost = winningBoostByProduct.get(pid);
    const isBoosted = i < REEL_PAID_SLOTS && !!boost;
    items.push({
      productId: tag.product.id,
      productSlug: null, // Product has no slug field on the deployed schema; route by productId.
      name: tag.product.name,
      imageUrl,
      vendorName: tag.product.vendor?.name ?? null,
      cropUrl: tag.cropUrl ?? null,
      sourceImageUrl: tag.image?.url ?? null,
      focalX: tag.cropX ?? tag.x ?? null,
      focalY: tag.cropY ?? tag.y ?? null,
      isBoosted,
      slotPosition: i + 1,
      boostId: isBoosted ? boost?.id : undefined,
    });
  });

  return { items, totalTagged };
}

// ────────────────────────────────────────────────────────────────────────────
// Following filter
// ────────────────────────────────────────────────────────────────────────────

async function resolveFollowedDesigners(opts: {
  userId?: string | null;
  followingOnly?: boolean;
}): Promise<string[] | null> {
  if (!opts.followingOnly || !opts.userId) return null;
  try {
    const follows = await prisma.follow.findMany({
      where: { followerId: opts.userId },
      select: { followingId: true },
    });
    return follows.map((f) => f.followingId);
  } catch {
    // Fail open: if the follows query throws, drop the filter rather than 500.
    return null;
  }
}

/**
 * usePublishReadiness — the single source of truth for the publish spine.
 *
 * Spec: 20_PUBLISH_FLOW_AND_UPLOAD_WIZARD §6. Derived server-side (in the
 * project page RSC) and hydrated to the client spine as a plain object. The
 * client never recomputes; mutations call router.refresh() to re-derive.
 *
 * Migration ordering is a HARD requirement, not a nicety: the project page's
 * Prisma query selects `roomId` / `inclusion` / `noProducts` unconditionally,
 * so the read path THROWS against a database that has not had the spec-20
 * migrations applied. There is no graceful pre-migration read path — deploy
 * `migrate deploy` before serving this code. The `roomId === undefined`
 * fallback below is defensive only (it never fires once the column exists).
 */

export type Gate = 'photos' | 'rooms' | 'tags' | 'story' | 'publish';

export type CtaAction =
  | 'openUploader'
  | 'scrollToUncategorized'
  | 'openMaterials' // when no tags exist yet
  | 'openTagReview' // when tags exist but some photos unreviewed
  | 'startInterview'
  | 'publish';

export interface GateState {
  complete: boolean;
  remaining: number; // photos left to resolve for this gate
}

export interface PublishReadiness {
  gates: Record<Gate, GateState>;
  nextGate: Gate;
  ctaLabel: string;
  ctaAction: CtaAction;
  /** gates.rooms.complete. Tags are prompted for at publish, never required. */
  canPublish: boolean;
  statusLine: string; // "19 photos · 7 rooms · 0 tagged"
}

/** One image as the selector needs to see it. Documents (spec/PDF) excluded upstream. */
export interface ReadinessImage {
  id: string;
  inclusion?: 'INCLUDED' | 'EXCLUDED' | null;
  roomId?: string | null;
  /** Legacy free-text room field, used as a fallback before roomId backfill. */
  room?: string | null;
  /** Designer marked "no products to tag" on this photo. */
  noProducts?: boolean | null;
  /** Count of product tags on this image. */
  tagCount: number;
}

export interface ReadinessInput {
  /** Photo images only — documents/spec files filtered out by the caller. */
  photos: ReadinessImage[];
  /** Distinct room count for the project (Room model rows), for the status line. */
  roomCount: number;
  /**
   * Story gate: true once a story draft has actually been generated
   * (editorialState is GENERATED/PUBLISHED/UNPUBLISHED). An interview that is
   * merely in progress (INTERVIEWED, answers saved but no draft) does NOT satisfy
   * this — the step stays current so the interview remains reachable.
   */
  storyComplete: boolean;
}

const isIncluded = (img: ReadinessImage) => (img.inclusion ?? 'INCLUDED') === 'INCLUDED';

const isAssignedToRoom = (img: ReadinessImage) => {
  // roomId is authoritative once the column exists (it is `null` when
  // unassigned, a value when assigned). Only fall back to the legacy free-text
  // `room` field before the Phase 3c migration, when roomId is `undefined`.
  if (img.roomId !== undefined) return Boolean(img.roomId);
  return Boolean(img.room && img.room.trim().length > 0);
};

const isReviewed = (img: ReadinessImage) => {
  // Derived, not stored. A confirmed tag auto-satisfies review; dismissing the
  // last tag auto-reverts it. `noProducts` covers architectural/detail shots
  // the designer has explicitly declared product-free. This makes it impossible
  // for a photo to sit "reviewed" with zero attribution unless the designer
  // said so on purpose.
  return img.tagCount > 0 || img.noProducts === true;
};

export function computePublishReadiness(input: ReadinessInput): PublishReadiness {
  const { photos, roomCount, storyComplete } = input;

  const included = photos.filter(isIncluded);
  const uncategorized = included.filter(img => !isAssignedToRoom(img));
  const untagged = included.filter(img => !isReviewed(img));
  const taggedItemCount = included.reduce((sum, img) => sum + img.tagCount, 0);

  const photosComplete = photos.length > 0;
  const roomsComplete = included.length > 0 && uncategorized.length === 0;
  const tagsComplete = roomsComplete && untagged.length === 0;

  // TAGS DO NOT BLOCK PUBLISHING. Rooms do.
  //
  // A room is structural: the article's chapters and its gallery are both built
  // per room, so a photo with no room has nowhere to appear and would silently
  // vanish from the piece the designer is about to publish. That is worth
  // stopping for.
  //
  // Tagging is not structural — it is upside. Tags are how the vendors in a
  // project get invited to collaborate on the post and share it with their own
  // audience, and how the designer's product library builds up for the next
  // project. Real value, and worth asking for at the moment of publishing, but
  // withholding a finished article until every last photo is signed off makes a
  // marketing benefit read as a compliance step. The Publish tab prompts once,
  // names the benefit, and lets the designer publish.
  const publishComplete = roomsComplete;

  const gates: Record<Gate, GateState> = {
    photos: { complete: photosComplete, remaining: photosComplete ? 0 : 1 },
    rooms: { complete: roomsComplete, remaining: uncategorized.length },
    tags: { complete: tagsComplete, remaining: untagged.length },
    story: { complete: storyComplete, remaining: storyComplete ? 0 : 1 },
    publish: { complete: publishComplete, remaining: 0 },
  };

  const order: Gate[] = ['photos', 'rooms', 'tags', 'story', 'publish'];
  const nextGate = order.find(g => !gates[g].complete) ?? 'publish';

  // CTA state machine (spec §2). tags depends on rooms — never offer "Tag
  // products" while uncategorized photos exist.
  let ctaLabel: string;
  let ctaAction: CtaAction;
  if (!photosComplete) {
    ctaLabel = 'Add photos';
    ctaAction = 'openUploader';
  } else if (uncategorized.length > 0) {
    ctaLabel = `Sort rooms (${uncategorized.length} left)`;
    ctaAction = 'scrollToUncategorized';
  } else if (untagged.length > 0) {
    ctaLabel = `Tag products (${untagged.length} left)`;
    // No tags anywhere yet → start at the Materials step; otherwise resume review.
    ctaAction = taggedItemCount === 0 ? 'openMaterials' : 'openTagReview';
  } else if (!storyComplete) {
    ctaLabel = 'Start interview';
    ctaAction = 'startInterview';
  } else {
    ctaLabel = 'Publish project';
    ctaAction = 'publish';
  }

  const photoCount = photos.length;
  const statusLine = `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'} · ${roomCount} ${
    roomCount === 1 ? 'room' : 'rooms'
  } · ${taggedItemCount} tagged`;

  return {
    gates,
    nextGate,
    ctaLabel,
    ctaAction,
    canPublish: publishComplete,
    statusLine,
  };
}

/** Document/spec files are not photos and never count toward the photo gates. */
export function isDocumentImage(name?: string | null): boolean {
  return Boolean(name && /\.(pdf|pptx|ppt|xlsx|xls|csv)$/i.test(name));
}

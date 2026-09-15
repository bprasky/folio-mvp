// captionScale — how big the room caption beside a photo should be.
//
// It used to be a constant (--type-h3, 28px). Beside a near-square photo the
// caption column is as tall as the photo — roughly 490px — and the text cluster
// in it was about 170px, so the caption looked marooned in its own column. A
// bigger constant just moves the problem to the next room.
//
// Two inputs decide the size instead:
//
//   1. The column. The size is a fraction of the tile's own inline size, emitted
//      as a container-query unit, so it tracks the column across breakpoints
//      with no measure-and-resize pass on the client.
//   2. The caption's length. Scaling to the container says nothing about how
//      much text goes in it — 30 characters and 250 characters fill the same box
//      very differently — so a step chosen from the length does the other half.
//
// Deliberately NOT anchored to the photo's height, which is what the column's
// height actually is. That needs one of two things we don't have:
//   - width/height on ProjectImage. The columns don't exist (schema.prisma:568),
//     so useImageAspect resolves the ratio by loading the image on the client and
//     any size derived from it would snap into place after the image loads.
//   - container-type: size on the tile, which brings size containment: the tile
//     stops growing to fit its own content, so a long caption in a short (16:9)
//     row overflows into the next row instead of pushing the row taller as it
//     does today.
// Anchoring to the photo needs the dimensions persisted at upload first.

import type { CSSProperties } from "react";

/** Fractions are of the tile's inline size. folio-design-system: off-scale — the
 *  whole point is that these resolve between the scale's steps. */
interface CaptionBucket {
  /** Longest caption, in characters, that still lands in this bucket. */
  upTo: number;
  /** Preferred size as a percentage of the tile's inline size. */
  percent: number;
  /** Floor, for narrow columns (mobile, where the tile is full width). */
  minPx: number;
  /** Ceiling, so a two-word caption doesn't turn into a headline. */
  maxPx: number;
}

// At the ~523px desktop column these resolve to roughly 51px / 39px / 31px.
// The middle value is the one the approved study showed beside a square photo;
// the outer two are that value stepped by the length multipliers it used.
const BUCKETS: readonly CaptionBucket[] = [
  { upTo: 60, percent: 9.8, minPx: 26, maxPx: 52 },
  { upTo: 160, percent: 7.5, minPx: 24, maxPx: 40 },
  { upTo: Number.POSITIVE_INFINITY, percent: 5.9, minPx: 22, maxPx: 34 },
];

/** Looser than a headline's, because these run to several lines at large sizes. */
const CAPTION_LEADING = "1.35"; /* folio-design-system: off-scale */

/**
 * The tile publishes the resolved values as custom properties and every caption
 * branch reads them, so the three renderings can't drift apart. React's
 * CSSProperties has no room for custom properties, hence the widening.
 */
export interface CaptionStyle extends CSSProperties {
  "--caption-size"?: string;
  "--caption-leading"?: string;
}

export interface CaptionScale {
  /** CSS length for --caption-size. */
  size: string;
  /** Unitless line-height for --caption-leading. */
  leading: string;
}

/**
 * `captionLength` is the rendered caption's character count. Callers that have
 * no caption to render can pass 0 — the value is unused in that case, and the
 * shortest bucket is the harmless answer.
 */
export function captionScale(captionLength: number): CaptionScale {
  const bucket =
    BUCKETS.find((candidate) => captionLength <= candidate.upTo) ?? BUCKETS[BUCKETS.length - 1];
  return {
    size: `clamp(${bucket.minPx}px, ${bucket.percent}cqi, ${bucket.maxPx}px)`,
    leading: CAPTION_LEADING,
  };
}

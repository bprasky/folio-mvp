'use client';

import { useMemo } from 'react';

interface ExpansionPosition {
  left: number;
  top: number;
  transformOrigin: string;
}

/**
 * Calculate viewport-aware position for an inline expansion card.
 * Card expands from the tag point, flipping direction near edges.
 * 12px minimum margin from image bounds.
 */
export function useExpansionPosition(
  xPercent: number,
  yPercent: number,
  containerRect: DOMRect | null,
  cardWidth: number,
  cardHeight: number
): ExpansionPosition | null {
  return useMemo(() => {
    if (!containerRect) return null;

    const margin = 12;
    const cw = containerRect.width;
    const ch = containerRect.height;

    // Tag position in pixels relative to container
    const tagX = (xPercent / 100) * cw;
    const tagY = (yPercent / 100) * ch;

    // Default: expand right and below the tag
    let left = tagX;
    let top = tagY;
    let originX = '0%';
    let originY = '0%';

    // Flip left if card would overflow right edge
    if (tagX + cardWidth + margin > cw) {
      left = tagX - cardWidth;
      originX = '100%';
    }

    // Flip up if card would overflow bottom edge
    if (tagY + cardHeight + margin > ch) {
      top = tagY - cardHeight;
      originY = '100%';
    }

    // Clamp to container bounds
    left = Math.max(margin, Math.min(left, cw - cardWidth - margin));
    top = Math.max(margin, Math.min(top, ch - cardHeight - margin));

    return {
      left,
      top,
      transformOrigin: `${originX} ${originY}`,
    };
  }, [xPercent, yPercent, containerRect, cardWidth, cardHeight]);
}

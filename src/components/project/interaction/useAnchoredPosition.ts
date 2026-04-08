'use client';

import { useMemo } from 'react';
import type { NormalizedTag } from './types';

interface AnchoredPosition {
  x: number;       // px from container left
  y: number;       // px from container top
  width: number;   // px
  height: number;  // px
  edge: 'left' | 'right' | 'top' | 'bottom';
  connectionLine: {
    x1: number; y1: number; // from product center in photo
    x2: number; y2: number; // to panel center
  };
}

/**
 * Calculate where to position the anchored lift-off panel adjacent to the product.
 * Expands toward the nearest edge with the most space, capped at 30% photo coverage.
 */
export function useAnchoredPosition(
  tag: NormalizedTag,
  containerRect: DOMRect | null
): AnchoredPosition | null {
  return useMemo(() => {
    if (!containerRect) return null;

    const cw = containerRect.width;
    const ch = containerRect.height;

    // Product center in pixels
    const productX = (tag.xPercent / 100) * cw;
    const productY = (tag.yPercent / 100) * ch;

    // Product region size (from bounding box or default 15%)
    const bbox = tag.meshBoundingBox;
    const regionW = bbox ? bbox.width * cw : cw * 0.15;
    const regionH = bbox ? bbox.height * ch : ch * 0.15;

    // Find edge with most space
    const distances = {
      left: productX - regionW / 2,
      right: cw - productX - regionW / 2,
      top: productY - regionH / 2,
      bottom: ch - productY - regionH / 2,
    };

    const edge = (Object.entries(distances) as [typeof distances extends Record<infer K, any> ? K : never, number][])
      .sort((a, b) => b[1] - a[1])[0][0] as AnchoredPosition['edge'];

    // Panel size: 30-40% of image, capped at 30% coverage
    let panelWidth = Math.min(cw * 0.4, Math.max(cw * 0.3, 200));
    let panelHeight = panelWidth * 1.1; // slightly taller for info panel below mesh

    // Enforce 30% max coverage
    const maxArea = cw * ch * 0.3;
    if (panelWidth * panelHeight > maxArea) {
      const scale = Math.sqrt(maxArea / (panelWidth * panelHeight));
      panelWidth *= scale;
      panelHeight *= scale;
    }

    // Position panel adjacent to product region
    const gap = 16;
    let x: number;
    let y: number;

    switch (edge) {
      case 'right':
        x = productX + regionW / 2 + gap;
        y = productY - panelHeight / 2;
        break;
      case 'left':
        x = productX - regionW / 2 - panelWidth - gap;
        y = productY - panelHeight / 2;
        break;
      case 'bottom':
        x = productX - panelWidth / 2;
        y = productY + regionH / 2 + gap;
        break;
      case 'top':
        x = productX - panelWidth / 2;
        y = productY - regionH / 2 - panelHeight - gap;
        break;
    }

    // Clamp to container bounds
    x = Math.max(8, Math.min(x, cw - panelWidth - 8));
    y = Math.max(8, Math.min(y, ch - panelHeight - 8));

    // Connection line from product center to panel center
    const connectionLine = {
      x1: productX,
      y1: productY,
      x2: x + panelWidth / 2,
      y2: y + panelHeight / 2,
    };

    return { x, y, width: panelWidth, height: panelHeight, edge, connectionLine };
  }, [tag, containerRect]);
}

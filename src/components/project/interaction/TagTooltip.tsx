'use client';

import { useRef, useState, useEffect } from 'react';
import type { NormalizedTag } from './types';
import { getProductCompleteness } from './productCompleteness';

interface TagTooltipProps {
  tag: NormalizedTag | null;
  cursorPosition: { x: number; y: number };
  containerRef: React.RefObject<HTMLElement | null>;
}

/**
 * Near-cursor glass-badge tooltip showing product name and vendor.
 * Follows the cursor within the image container, clamped to avoid overflow.
 * 150ms debounce to prevent flicker during fast mouse movement.
 */
export function TagTooltip({ tag, cursorPosition, containerRef }: TagTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [debouncedTag, setDebouncedTag] = useState<NormalizedTag | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 150ms debounce on tag changes
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!tag) {
      // Disappear immediately when leaving a tag
      setDebouncedTag(null);
      return;
    }

    timerRef.current = setTimeout(() => {
      setDebouncedTag(tag);
    }, 150);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [tag]);

  if (!debouncedTag) return null;

  // Calculate tooltip position, clamped within container
  const container = containerRef.current;
  const containerWidth = container?.clientWidth || 400;
  const containerHeight = container?.clientHeight || 300;
  const tooltipWidth = 200; // approximate
  const tooltipHeight = 40;
  const offset = 16;

  let x = cursorPosition.x + offset;
  let y = cursorPosition.y + offset;

  // Flip left if would overflow right edge
  if (x + tooltipWidth > containerWidth) {
    x = cursorPosition.x - offset - tooltipWidth;
  }
  // Flip up if would overflow bottom edge
  if (y + tooltipHeight > containerHeight) {
    y = cursorPosition.y - offset - tooltipHeight;
  }
  // Clamp to container
  x = Math.max(4, Math.min(x, containerWidth - tooltipWidth - 4));
  y = Math.max(4, Math.min(y, containerHeight - tooltipHeight - 4));

  return (
    <div
      ref={tooltipRef}
      className="absolute z-[20] pointer-events-none transition-all duration-100 ease-out"
      style={{ left: x, top: y }}
    >
      <div className="glass-badge px-3 py-1.5 flex flex-col gap-0.5 max-w-[200px]">
        <span className="text-xs font-medium text-folio-text-primary truncate">
          {debouncedTag.label}
        </span>
        {debouncedTag.vendorName && (
          <span className="text-[9px] uppercase tracking-[0.16em] text-folio-text-secondary truncate">
            {debouncedTag.vendorName}
          </span>
        )}
        {getProductCompleteness(debouncedTag) === 'partial' && (
          <span className="text-[8px] italic text-folio-text-tertiary">
            Limited info
          </span>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';

type CursorState = 'default' | 'crosshair' | 'pointer';

/**
 * Sets the cursor style on a container element based on mask hit-test state.
 * - default: mouse is outside the image
 * - crosshair: mouse is over tagged image but not on a product
 * - pointer: mouse is over a product mask region
 */
export function useTaggedImageCursor(
  containerRef: React.RefObject<HTMLElement | null>,
  isOverTaggedImage: boolean,
  isOverAnyTag: boolean
) {
  const cursorState: CursorState = isOverAnyTag
    ? 'pointer'
    : isOverTaggedImage
    ? 'crosshair'
    : 'default';

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.cursor = cursorState;
    return () => {
      el.style.cursor = '';
    };
  }, [containerRef, cursorState]);

  return cursorState;
}

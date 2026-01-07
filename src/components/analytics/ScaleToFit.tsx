'use client';
import React, { useLayoutEffect, useRef, useState } from 'react';

type Props = {
  children: React.ReactNode;
  /** Minimum visual height of the tile (unscaled) */
  minHeight?: number;      // default 260
  /** Maximum visual height of the tile (unscaled); card can grow up to this */
  maxHeight?: number;      // default 560
  /** Padding inside tile that reduces available area for content */
  padX?: number;           // default 0
  padY?: number;           // default 0
  /** Never upscale above 1 (keeps charts crisp) */
  allowUpscale?: boolean;  // default false
  className?: string;
};

/**
 * Measures the child's natural size, then scales it down to fit the wrapper.
 * Avoids cropping by using CSS transform with transform-origin: top left.
 * Works with HTML, SVG, and <canvas>.
 */
export default function ScaleToFit({
  children,
  minHeight = 260,
  maxHeight = 560,
  padX = 0,
  padY = 0,
  allowUpscale = false,
  className = ''
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    if (!wrapRef.current || !innerRef.current) return;

    const ro = new ResizeObserver(() => {
      const wrap = wrapRef.current!;
      const inner = innerRef.current!;

      // Measure available space
      const availW = Math.max(0, wrap.clientWidth - padX);
      const availH = Math.max(0, wrap.clientHeight - padY);

      // Measure child's *natural* size
      // Use scroll sizes so we capture full content footprint even if it would overflow.
      const naturalW = inner.scrollWidth || inner.clientWidth || 1;
      const naturalH = inner.scrollHeight || inner.clientHeight || 1;

      let s = Math.min(availW / naturalW, availH / naturalH);
      if (!allowUpscale) s = Math.min(1, s);
      // guard against NaN/Infinity
      if (!isFinite(s) || s <= 0) s = 1;

      setScale(s);
    });

    ro.observe(wrapRef.current);
    ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, [allowUpscale, padX, padY]);

  return (
    <div
      ref={wrapRef}
      className={[
        'relative w-full',
        // the wrapper defines the *visual* window the content must fit inside
        `min-h-[${minHeight}px]`,
        `max-h-[${maxHeight}px]`,
        'overflow-visible', // we scale instead of cropping
        className
      ].join(' ')}
      style={{ minHeight, maxHeight }}
    >
      <div
        // inner renders at natural size, then we scale it down
        ref={innerRef}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: 'fit-content',
          height: 'fit-content'
        }}
      >
        {children}
      </div>
    </div>
  );
}







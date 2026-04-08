'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { NormalizedTag } from './types';

interface MaskData {
  imageData: ImageData;
  width: number;
  height: number;
}

interface HitTestResult {
  hitTag: NormalizedTag | null;
  isOverAnyTag: boolean;
  isOverTaggedImage: boolean;
  cursorPosition: { x: number; y: number };
}

const CIRCLE_FALLBACK_RADIUS_PCT = 8; // 8% of image width

/**
 * Canvas-based mask alpha hit-testing.
 * Loads mask PNGs into offscreen canvases, samples alpha at cursor position.
 * Falls back to circle hit-testing for tags without masks.
 */
export function useMaskHitTest(
  containerRef: React.RefObject<HTMLElement | null>,
  tags: NormalizedTag[]
) {
  const maskCache = useRef<Map<string, MaskData>>(new Map());
  const loadingRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number | null>(null);
  const [result, setResult] = useState<HitTestResult>({
    hitTag: null,
    isOverAnyTag: false,
    isOverTaggedImage: false,
    cursorPosition: { x: 0, y: 0 },
  });

  // Lazy-load mask PNGs into offscreen canvases
  const loadMask = useCallback((tag: NormalizedTag) => {
    if (!tag.meshMaskUrl || maskCache.current.has(tag.id) || loadingRef.current.has(tag.id)) return;
    loadingRef.current.add(tag.id);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 256; // Standardized resolution for hit-testing
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        maskCache.current.set(tag.id, { imageData, width: size, height: size });
      }
      loadingRef.current.delete(tag.id);
    };
    img.onerror = () => loadingRef.current.delete(tag.id);
    img.src = tag.meshMaskUrl;
  }, []);

  // Load masks when tags change
  useEffect(() => {
    tags.forEach((tag) => {
      if (tag.meshMaskUrl) loadMask(tag);
    });
  }, [tags, loadMask]);

  // Hit-test at a given normalized position (0-1)
  const hitTestAt = useCallback(
    (normX: number, normY: number): NormalizedTag | null => {
      let bestHit: NormalizedTag | null = null;
      let bestDepth = Infinity;

      for (const tag of tags) {
        const maskData = maskCache.current.get(tag.id);

        if (maskData) {
          // Mask-based hit test: sample alpha at position
          const px = Math.floor(normX * (maskData.width - 1));
          const py = Math.floor(normY * (maskData.height - 1));
          const idx = (py * maskData.width + px) * 4 + 3; // Alpha channel
          const alpha = maskData.imageData.data[idx];

          if (alpha > 128) {
            const depth = tag.meshDepthEstimate ?? 0.5;
            if (depth < bestDepth) {
              bestDepth = depth;
              bestHit = tag;
            }
          }
        } else {
          // Circle fallback: check distance from tag center
          const tagNormX = tag.xPercent / 100;
          const tagNormY = tag.yPercent / 100;
          const dx = normX - tagNormX;
          const dy = normY - tagNormY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const radius = CIRCLE_FALLBACK_RADIUS_PCT / 100;

          if (dist <= radius) {
            const depth = tag.meshDepthEstimate ?? 0.5;
            if (depth < bestDepth) {
              bestDepth = depth;
              bestHit = tag;
            }
          }
        }
      }

      return bestHit;
    },
    [tags]
  );

  // Mouse move handler
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const normX = x / rect.width;
        const normY = y / rect.height;
        const isInside = normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1;

        if (!isInside) {
          setResult({
            hitTag: null,
            isOverAnyTag: false,
            isOverTaggedImage: false,
            cursorPosition: { x, y },
          });
          return;
        }

        const hit = hitTestAt(normX, normY);
        setResult({
          hitTag: hit,
          isOverAnyTag: !!hit,
          isOverTaggedImage: true,
          cursorPosition: { x, y },
        });
      });
    },
    [containerRef, hitTestAt]
  );

  const handleMouseLeave = useCallback(() => {
    setResult((prev) => ({
      ...prev,
      hitTag: null,
      isOverAnyTag: false,
      isOverTaggedImage: false,
    }));
  }, []);

  // Attach/detach listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [containerRef, handleMouseMove, handleMouseLeave]);

  // Cleanup
  useEffect(() => {
    return () => {
      maskCache.current.clear();
      loadingRef.current.clear();
    };
  }, []);

  return result;
}

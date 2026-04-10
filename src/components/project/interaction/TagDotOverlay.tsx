'use client';

import { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { NormalizedTag } from './types';

interface TagDotOverlayProps {
  tags: NormalizedTag[];
  visible: boolean;
  compact?: boolean; // 6px dots for feed cards < 200px wide
  onTagActivate: (tag: NormalizedTag) => void;
}

/**
 * Desktop tag dot overlay — invisible until mouse enters image.
 * Renders minimal white dots at each tag position.
 * 600ms hover dwell OR click triggers expansion.
 */
export function TagDotOverlay({
  tags,
  visible,
  compact = false,
  onTagActivate,
}: TagDotOverlayProps) {
  const hoverTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleDotMouseEnter = useCallback(
    (tag: NormalizedTag) => {
      const timer = setTimeout(() => {
        onTagActivate(tag);
        hoverTimers.current.delete(tag.id);
      }, 600);
      hoverTimers.current.set(tag.id, timer);
    },
    [onTagActivate]
  );

  const handleDotMouseLeave = useCallback((tagId: string) => {
    const timer = hoverTimers.current.get(tagId);
    if (timer) {
      clearTimeout(timer);
      hoverTimers.current.delete(tagId);
    }
  }, []);

  const handleDotClick = useCallback(
    (e: React.MouseEvent, tag: NormalizedTag) => {
      e.stopPropagation();
      // Clear any pending hover timer
      const timer = hoverTimers.current.get(tag.id);
      if (timer) {
        clearTimeout(timer);
        hoverTimers.current.delete(tag.id);
      }
      onTagActivate(tag);
    },
    [onTagActivate]
  );

  const dotSize = compact ? 6 : 8;
  const hoverSize = compact ? 8 : 10;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-0 z-[4] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: visible ? 0.15 : 0.2,
            ease: visible ? 'easeOut' : 'easeIn',
          }}
        >
          {tags.map((tag) => (
            <motion.button
              key={tag.id}
              type="button"
              className="absolute pointer-events-auto rounded-full"
              style={{
                left: `${tag.xPercent}%`,
                top: `${tag.yPercent}%`,
                transform: 'translate(-50%, -50%)',
                width: dotSize,
                height: dotSize,
                backgroundColor: 'var(--tag-dot-color)',
                border: 'var(--tag-dot-border)',
                boxShadow: 'var(--tag-dot-shadow)',
              }}
              whileHover={{
                width: hoverSize,
                height: hoverSize,
                transition: { duration: 0.1 },
              }}
              onMouseEnter={() => handleDotMouseEnter(tag)}
              onMouseLeave={() => handleDotMouseLeave(tag.id)}
              onClick={(e) => handleDotClick(e, tag)}
              aria-label={`View ${tag.label}`}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

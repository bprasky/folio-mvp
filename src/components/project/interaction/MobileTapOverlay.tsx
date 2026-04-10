'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { NormalizedTag } from './types';

interface MobileTapOverlayProps {
  tags: NormalizedTag[];
  onTagTap: (tag: NormalizedTag) => void;
}

/**
 * Mobile touch interaction for tagged images.
 * Tap image: white dots reveal for 3 seconds, then fade.
 * Long-press: dots stay until tap-away.
 * Tap a dot: fires onTagTap immediately.
 */
export function MobileTapOverlay({ tags, onTagTap }: MobileTapOverlayProps) {
  const [showDots, setShowDots] = useState(false);
  const [persistent, setPersistent] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const clearTimers = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return clearTimers;
  }, [clearTimers]);

  const handleTouchStart = useCallback(() => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      // Long press: show dots persistently
      longPressTriggered.current = true;
      setShowDots(true);
      setPersistent(true);
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }
    }, 300);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (longPressTriggered.current) return;

    // Short tap
    if (showDots && !persistent) {
      // Already showing from previous tap — dismiss
      setShowDots(false);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      return;
    }

    if (persistent) {
      // Persistent mode — tap away dismisses
      setShowDots(false);
      setPersistent(false);
      return;
    }

    // First tap: show dots for 3 seconds
    setShowDots(true);
    setPersistent(false);
    dismissTimer.current = setTimeout(() => {
      setShowDots(false);
    }, 3000);
  }, [showDots, persistent]);

  const handleDotTap = useCallback(
    (e: React.MouseEvent, tag: NormalizedTag) => {
      e.stopPropagation();
      setShowDots(false);
      setPersistent(false);
      clearTimers();
      onTagTap(tag);
    },
    [onTagTap, clearTimers]
  );

  return (
    <div
      className="absolute inset-0 z-[2] md:hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <AnimatePresence>
        {showDots && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="absolute z-[21] pointer-events-auto rounded-full"
                style={{
                  left: `${tag.xPercent}%`,
                  top: `${tag.yPercent}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 8,
                  height: 8,
                  backgroundColor: 'var(--tag-dot-color)',
                  border: 'var(--tag-dot-border)',
                  boxShadow: 'var(--tag-dot-shadow)',
                }}
                onClick={(e) => handleDotTap(e, tag)}
                aria-label={`View ${tag.label}`}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

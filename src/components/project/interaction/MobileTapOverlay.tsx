'use client';

import { useState, useEffect, useCallback } from 'react';
import type { NormalizedTag } from './types';

interface MobileTapOverlayProps {
  tags: NormalizedTag[];
  onTagTap: (tag: NormalizedTag) => void;
}

/**
 * Mobile touch interaction for tagged images.
 * Single tap: all tag labels appear as glass-badges for 3 seconds.
 * Tap a specific label: fires onTagTap (triggers lift-off/expand/navigate).
 */
export function MobileTapOverlay({ tags, onTagTap }: MobileTapOverlayProps) {
  const [showLabels, setShowLabels] = useState(false);
  const [dismissTimer, setDismissTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleContainerTap = useCallback(() => {
    if (showLabels) {
      // Already showing — dismiss
      setShowLabels(false);
      if (dismissTimer) clearTimeout(dismissTimer);
      return;
    }

    setShowLabels(true);
    const timer = setTimeout(() => setShowLabels(false), 3000);
    setDismissTimer(timer);
  }, [showLabels, dismissTimer]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, [dismissTimer]);

  const handleLabelTap = useCallback(
    (e: React.MouseEvent, tag: NormalizedTag) => {
      e.stopPropagation();
      setShowLabels(false);
      if (dismissTimer) clearTimeout(dismissTimer);
      onTagTap(tag);
    },
    [onTagTap, dismissTimer]
  );

  return (
    <div
      className="absolute inset-0 z-[2] md:hidden"
      onClick={handleContainerTap}
    >
      {showLabels &&
        tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className="absolute z-[21] glass-badge px-2.5 py-1 text-[10px] font-medium animate-in fade-in duration-200"
            style={{
              left: `${tag.xPercent}%`,
              top: `${tag.yPercent}%`,
              transform: 'translate(-50%, -50%)',
            }}
            onClick={(e) => handleLabelTap(e, tag)}
          >
            {tag.label}
          </button>
        ))}
    </div>
  );
}

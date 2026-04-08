'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const SESSION_KEY = 'folio-shimmer-seen';

interface GoldBorderShimmerProps {
  isActive: boolean; // true when mouse enters tagged image
}

/**
 * Animated 1px gold border shimmer that plays once per session.
 * Teaches users that images are explorable without permanent decoration.
 * Uses a clockwise conic-gradient animation over 600ms.
 */
export function GoldBorderShimmer({ isActive }: GoldBorderShimmerProps) {
  const [shouldPlay, setShouldPlay] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = sessionStorage.getItem(SESSION_KEY);
    if (seen) {
      setHasPlayed(true);
    }
  }, []);

  useEffect(() => {
    if (isActive && !hasPlayed && !shouldPlay) {
      setShouldPlay(true);
    }
  }, [isActive, hasPlayed, shouldPlay]);

  useEffect(() => {
    if (shouldPlay) {
      const timer = setTimeout(() => {
        setHasPlayed(true);
        sessionStorage.setItem(SESSION_KEY, 'true');
      }, 700); // slightly after 600ms animation
      return () => clearTimeout(timer);
    }
  }, [shouldPlay]);

  if (hasPlayed || !shouldPlay) return null;

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none rounded-[inherit] z-[3]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          border: '1px solid transparent',
          background: 'linear-gradient(#00000000, #00000000) padding-box, conic-gradient(from var(--shimmer-angle, 0deg), transparent 0%, #c9a96e66 25%, transparent 50%) border-box',
        }}
        animate={{
          '--shimmer-angle': ['0deg', '360deg'],
        } as any}
        transition={{ duration: 0.6, ease: 'linear' }}
      />
    </motion.div>
  );
}

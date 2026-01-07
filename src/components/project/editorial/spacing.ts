/**
 * spacing.ts - Fibonacci spacing tokens for editorial rhythm
 * 
 * Golden ratio-inspired spacing system for magazine-style layouts.
 * Values approximate Fibonacci sequence: 8, 13, 21, 34, 55
 */

export const SPACING = {
  SP_8: '2rem',   // 32px - Inside caption typography
  SP_13: '3.25rem', // 52px - Between image and caption inside spread
  SP_21: '5.25rem', // 84px - Between spreads within a room
  SP_34: '8.5rem',  // 136px - Between room chapters
  SP_55: '13.75rem', // 220px - Major section breaks
} as const;

// Tailwind class equivalents (if using Tailwind)
export const SPACING_CLASSES = {
  SP_8: 'space-y-8',
  SP_13: 'space-y-13', // May need custom Tailwind config
  SP_21: 'space-y-21',
  SP_34: 'space-y-34',
  SP_55: 'space-y-55',
} as const;









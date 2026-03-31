'use client';

/**
 * CinematicBackground — DEPRECATED
 *
 * Page-level gradient washes are no longer used.
 * Warmth now lives inside glass elements via the dimensional mesh
 * in glass-tokens.css (::before pseudo-element on .glass-surface).
 *
 * This component is kept as a no-op to avoid breaking imports.
 */

interface CinematicBackgroundProps {
  primary?: string;
  accent?: string;
}

export default function CinematicBackground(_props: CinematicBackgroundProps) {
  return null;
}

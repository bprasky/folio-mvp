import type { CSSProperties } from 'react';

/** Quiet tonal placeholders. No shimmer, imagery, or extra font requests. */
export function SkeletonBlock({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`bg-surface-elevated rounded ${className}`} style={style} />;
}

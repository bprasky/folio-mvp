/**
 * Loading skeleton component for vendor dashboard
 * Maintains glassmorphic styling consistent with Folio brand
 * Improved border contrast for visibility
 */
export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-2xl bg-surface-canvas/40 border border-folio-border-subtle ${className}`} />
);


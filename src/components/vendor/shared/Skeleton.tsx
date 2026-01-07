/**
 * Loading skeleton component for vendor dashboard
 * Maintains glassmorphic styling consistent with Folio brand
 * Improved border contrast for visibility
 */
export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-2xl bg-white/40 border border-neutral-300/50 ${className}`} />
);


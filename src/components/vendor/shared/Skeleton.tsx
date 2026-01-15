/**
 * Loading skeleton component for vendor dashboard
 * Maintains glassmorphic styling consistent with Folio brand
 * Improved border contrast for visibility
 */
export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-2xl bg-[var(--bg-base)]/40 border border-[var(--ridge-outer)] ${className}`} />
);


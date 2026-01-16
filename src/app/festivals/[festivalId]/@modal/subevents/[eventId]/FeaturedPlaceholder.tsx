"use client";

/**
 * FeaturedPlaceholder - Loading skeleton for featured products
 * Folio Design System: Uses accent-tinted placeholders and folio-body text
 */
export default function FeaturedPlaceholder() {
  return (
    <div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="shrink-0 w-[220px]">
            <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-[var(--accent)]/10">
              <div className="absolute inset-0 animate-pulse bg-[var(--accent)]/20" />
            </div>
            <div className="mt-2 h-3 w-4/5 rounded bg-[var(--accent)]/15 animate-pulse" />
            <div className="mt-2 h-3 w-2/5 rounded bg-[var(--accent)]/15 animate-pulse" />
          </div>
        ))}
      </div>
      <p className="mt-3 folio-body opacity-80 text-white">
        No featured products yet. Vendors can feature products here - saves count toward event
        insights.
      </p>
    </div>
  );
}











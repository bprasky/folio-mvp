"use client";

export default function FeaturedPlaceholder() {
  return (
    <div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="shrink-0 w-[220px]">
            <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-white/5">
              <div className="absolute inset-0 animate-pulse bg-white/10" />
            </div>
            <div className="mt-2 h-3 w-4/5 rounded bg-white/10 animate-pulse" />
            <div className="mt-2 h-3 w-2/5 rounded bg-white/10 animate-pulse" />
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm opacity-80">
        No featured products yet. Vendors can feature products here — saves count toward event
        insights.
      </p>
    </div>
  );
}



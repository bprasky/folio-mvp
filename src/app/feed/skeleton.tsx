// src/app/feed/skeleton.tsx

import { RidgeCard } from "@/components/ui/ridge-card";

export function FeedSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-6 animate-pulse">
      <div className="col-span-12 lg:col-span-9 space-y-6">
        <RidgeCard padding="none" className="overflow-hidden">
          <div className="aspect-[3/2] w-full bg-[var(--bg-elevated)]" />
        </RidgeCard>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RidgeCard padding="none" className="overflow-hidden">
            <div className="aspect-[4/3] w-full bg-[var(--bg-elevated)]" />
          </RidgeCard>

          <RidgeCard padding="none" className="overflow-hidden">
            <div className="aspect-[4/3] w-full bg-[var(--bg-elevated)]" />
          </RidgeCard>
        </div>
      </div>
      <div className="col-span-12 lg:col-span-3 space-y-6">
        <RidgeCard padding="sm">
          <div className="h-6 bg-[var(--bg-elevated)] rounded w-3/4" />
        </RidgeCard>

        <RidgeCard padding="none" className="overflow-hidden">
          <div className="aspect-[4/5] w-full bg-[var(--bg-elevated)]" />
        </RidgeCard>

        <RidgeCard padding="none" className="overflow-hidden">
          <div className="aspect-[4/5] w-full bg-[var(--bg-elevated)]" />
        </RidgeCard>
      </div>
    </div>
  );
}

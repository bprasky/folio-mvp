// src/app/feed/skeleton.tsx

import { GlassCard } from "@/components/ui/glass";

export function FeedSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-6 animate-pulse">
      <div className="col-span-12 lg:col-span-9 space-y-6">
        <GlassCard variant="subtle" padding="none" rounded="2xl" className="overflow-hidden">
          <div className="aspect-[3/2] w-full bg-gray-200/50" />
        </GlassCard>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassCard variant="subtle" padding="none" rounded="2xl" className="overflow-hidden">
            <div className="aspect-[4/3] w-full bg-gray-200/50" />
          </GlassCard>

          <GlassCard variant="subtle" padding="none" rounded="2xl" className="overflow-hidden">
            <div className="aspect-[4/3] w-full bg-gray-200/50" />
          </GlassCard>
        </div>
      </div>
      <div className="col-span-12 lg:col-span-3 space-y-6">
        <GlassCard variant="subtle" padding="sm" rounded="xl">
          <div className="h-6 bg-gray-200/50 rounded w-3/4" />
        </GlassCard>

        <GlassCard variant="subtle" padding="none" rounded="2xl" className="overflow-hidden">
          <div className="aspect-[4/5] w-full bg-gray-200/50" />
        </GlassCard>

        <GlassCard variant="subtle" padding="none" rounded="2xl" className="overflow-hidden">
          <div className="aspect-[4/5] w-full bg-gray-200/50" />
        </GlassCard>
      </div>
    </div>
  );
}



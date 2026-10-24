// src/app/feed/skeleton.tsx

import { SkeletonBlock as Block } from "@/components/loading/SkeletonBlock";
import { RidgeCard } from "@/components/ui/ridge-card";

export function FeedSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-9 space-y-6">
        <RidgeCard padding="none" className="overflow-hidden">
          <div className="aspect-[3/2] w-full bg-surface-ground" />
          <CardText />
        </RidgeCard>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RidgeCard padding="none" className="overflow-hidden">
            <div className="aspect-[4/3] w-full bg-surface-ground" />
            <CardText />
          </RidgeCard>

          <RidgeCard padding="none" className="overflow-hidden">
            <div className="aspect-[4/3] w-full bg-surface-ground" />
            <CardText />
          </RidgeCard>
        </div>
      </div>
      <div className="col-span-12 lg:col-span-3 space-y-6">
        {[0, 1].map(section => (
          <section key={section} className="space-y-3">
            <div className="h-5 bg-surface-elevated rounded w-3/4" />
            {[0, 1].map(card => <RidgeCard key={card} padding="none" className="overflow-hidden"><div className="aspect-[4/5] w-full bg-surface-ground" /></RidgeCard>)}
          </section>
        ))}
      </div>
    </div>
  );
}

function CardText() {
  return <div className="p-5 space-y-2"><div className="h-8 w-3/4 bg-surface-elevated rounded" /><div className="h-4 w-1/3 bg-surface-elevated rounded" /><div className="h-5 w-full bg-surface-elevated rounded" /><div className="h-5 w-2/3 bg-surface-elevated rounded" /></div>;
}

/** Includes the updates strip so the nested feed boundary matches the route boundary. */
export function FeedContentSkeleton({ updates = false }: { updates?: boolean }) {
  return (
    <div aria-hidden="true">
      {updates ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="rounded-[20px] overflow-hidden bg-surface-canvas"><Block className="h-[220px] rounded-none" /><div className="p-3 space-y-2"><Block className="h-5 w-3/4" /><Block className="h-4" /><Block className="h-4 w-2/3" /><Block className="h-3 w-1/3 mt-2" /></div></div>)}
            </div>
          ) : (
            <div className="space-y-8">
              <section className="space-y-3">
                <div className="flex items-center justify-between"><Block className="h-5 w-20" /><Block className="h-4 w-1/3" /></div>
                <div className="flex gap-4 overflow-hidden pb-2">
                  {Array.from({ length: 5 }, (_, i) => <div key={i} className="flex-1 min-w-0 space-y-2"><Block className="h-[120px] rounded-lg" /><Block className="h-3 w-4/5 mx-auto" /></div>)}
                </div>
              </section>
              <FeedSkeleton />
            </div>
          )}
    </div>
  );
}

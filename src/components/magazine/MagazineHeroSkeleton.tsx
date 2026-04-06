// src/components/magazine/MagazineHeroSkeleton.tsx
//
// Hero Skeleton Component
//
// Glass skeleton card for when no hero editorial is available.
// Maintains consistent layout and magazine feel.

export default function MagazineHeroSkeleton() {
  return (
    <article className="ridge-card overflow-hidden rounded-[20px]">
      <div className="relative aspect-[16/7] w-full animate-pulse bg-surface-canvas" />
      <div className="space-y-2 px-5 py-4">
        <div className="h-4 w-24 rounded-full bg-surface-ground" />
        <div className="h-5 w-2/3 rounded-full bg-surface-ground" />
        <div className="h-3 w-1/3 rounded-full bg-surface-ground" />
      </div>
    </article>
  );
}





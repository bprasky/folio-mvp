// src/components/magazine/MagazineHeroSkeleton.tsx
//
// Hero Skeleton Component
//
// Glass skeleton card for when no hero editorial is available.
// Maintains consistent layout and magazine feel.

export default function MagazineHeroSkeleton() {
  return (
    <article className="overflow-hidden rounded-3xl bg-white/50 backdrop-blur-xl border border-white/60 shadow-[0_18px_50px_rgba(0,0,0,0.08)]">
      <div className="relative aspect-[16/7] w-full animate-pulse bg-neutral-100" />
      <div className="space-y-2 px-5 py-4">
        <div className="h-4 w-24 rounded-full bg-neutral-200" />
        <div className="h-5 w-2/3 rounded-full bg-neutral-200" />
        <div className="h-3 w-1/3 rounded-full bg-neutral-200" />
      </div>
    </article>
  );
}





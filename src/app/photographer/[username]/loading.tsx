export default function PhotographerLoading() {
  return (
    <div className="min-h-screen bg-surface-ground">
      <div className="max-w-5xl mx-auto px-6 py-24">
        {/* Profile header skeleton */}
        <div className="text-center space-y-4 mb-16">
          <div className="w-24 h-24 rounded-full bg-stone-200 animate-pulse mx-auto" />
          <div className="h-8 w-64 bg-stone-200 animate-pulse mx-auto rounded" />
          <div className="h-4 w-48 bg-stone-100 animate-pulse mx-auto rounded" />
          <div className="flex justify-center gap-3 mt-4">
            <div className="h-10 w-24 bg-stone-200 animate-pulse rounded-full" />
            <div className="h-10 w-24 bg-stone-100 animate-pulse rounded-full" />
          </div>
        </div>
        {/* Grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-[4/3] bg-stone-200 animate-pulse rounded-[20px]" />
          ))}
        </div>
      </div>
    </div>
  );
}

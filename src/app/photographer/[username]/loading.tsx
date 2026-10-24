import { LoadingSurface } from '@/components/loading/LoadingBrand';
import { SkeletonBlock as Block } from '@/components/loading/SkeletonBlock';

export default function PhotographerLoading() {
  return (
    <LoadingSurface label="Loading photographer portfolio">
      <div className="min-h-screen bg-surface-ground">
        <div className="max-w-5xl mx-auto px-6 pt-24 pb-16">
          <div className="text-center space-y-6">
            <Block className="w-28 h-28 rounded-full mx-auto border-2 border-white shadow-lg" />
            <Block className="h-9 md:h-10 lg:h-12 w-72 max-w-full mx-auto" />
            <Block className="h-5 w-48 max-w-full mx-auto" />
            <div className="flex justify-center gap-3 pt-2"><Block className="h-10 w-28 rounded-full" /><Block className="h-10 w-28 rounded-full" /></div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-6"><Block className="h-px" /></div>
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="mb-8 space-y-3"><Block className="h-4 w-16" /><Block className="h-5" /><Block className="h-5 w-4/5" /></div>
          <div className="mb-6 space-y-3"><Block className="h-4 w-16" /><div className="flex gap-2"><Block className="h-7 w-20 rounded-full" /><Block className="h-7 w-24 rounded-full" /></div></div>
          <Block className="h-4 w-16 mb-3" /><Block className="h-5 w-32" />
        </div>
        <div className="max-w-5xl mx-auto px-6"><Block className="h-px" /></div>
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="flex justify-between mb-8"><Block className="h-4 w-24" /><Block className="h-4 w-16" /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }, (_, i) => <Block key={i} className="aspect-[4/3] rounded-[20px]" />)}
          </div>
        </div>
      </div>
    </LoadingSurface>
  );
}

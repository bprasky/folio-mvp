import { SkeletonBlock as Block } from '@/components/loading/SkeletonBlock';

// Mirrors HomepagePage and HomepageHeroXL, including the tall desktop hero.
export function HomepageSkeleton() {
  return (
    <div className="bg-surface-canvas min-h-screen pb-12 sm:pb-24">
      <section className="pt-2">
        <div className="px-4 sm:px-10 max-w-[1440px] mx-auto">
          <div data-skeleton-hero className="relative overflow-hidden rounded-lg sm:rounded-3xl aspect-[4/3] sm:aspect-[21/10] min-h-0 sm:min-h-[600px] bg-surface-ground">
            <Block className="hidden sm:block absolute top-9 left-9 h-7 w-28 rounded-full" />
            <div className="hidden sm:block absolute left-9 right-9 bottom-9 space-y-3">
              <Block className="h-7 sm:h-12 w-4/5" />
              <Block className="h-7 sm:h-12 w-3/5" />
              <Block className="h-4 w-1/3" />
            </div>
          </div>
          <div className="sm:hidden mt-4 space-y-3">
            <Block className="h-3 w-32" />
            <Block className="h-8 w-full" /><Block className="h-8 w-4/5" /><Block className="h-8 w-3/5" />
            <div className="flex justify-between"><Block className="h-4 w-28" /><Block className="h-4 w-20" /></div>
          </div>
        </div>
      </section>
      <section className="px-4 sm:px-10 mt-6 sm:mt-4 max-w-[1440px] mx-auto">
        <div className="sm:hidden flex justify-between items-center border-t border-folio-border-subtle pt-4 mb-3 h-[73px]"><Block className="h-6 w-32" /><Block className="h-4 w-20" /></div>
        <div className="flex sm:grid sm:grid-cols-8 gap-3 sm:gap-4 overflow-hidden -mx-4 px-4 pb-2 sm:mx-0 sm:px-0 sm:pb-0">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="w-[104px] shrink-0 sm:w-auto min-w-0">
              <Block className="aspect-square rounded-md sm:rounded-xl" />
              <div className="mt-2 px-0.5 space-y-2"><Block className="h-4 w-4/5" /><Block className="h-3 w-3/5" /></div>
            </div>
          ))}
        </div>
      </section>
      <div className="border-y border-folio-border-subtle mt-6 sm:mt-12">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-10 py-3 sm:py-4 flex gap-2 overflow-hidden">
          {[24, 32, 28, 24].map((width, i) => <Block key={i} className="h-9 rounded-full shrink-0" style={{ width: `${width * 4}px` }} />)}
        </div>
      </div>
      <section className="px-4 sm:px-10 max-w-[1440px] mx-auto mt-6 sm:mt-8">
        <div className="grid grid-flow-dense grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 auto-rows-[8px]">
          <Block className="rounded-[20px] col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4 [grid-row:span_30] lg:[grid-row:span_32] xl:[grid-row:span_34]" />
          {[0, 1, 2].map(i => <Block key={i} className="rounded-[20px] col-span-1 sm:col-span-2 [grid-row:span_24] lg:[grid-row:span_26]" />)}
          <Block className="rounded-[20px] [grid-row:span_18]" />
        </div>
      </section>
    </div>
  );
}

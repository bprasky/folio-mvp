import { LoadingSurface } from '@/components/loading/LoadingBrand';
import { SkeletonBlock as Block } from '@/components/loading/SkeletonBlock';

export default function Loading() {
  return (
    <LoadingSurface label="Loading events">
      <div className="pt-6 md:pt-8 pb-12">
        {/* Current festival timeline: large landscape cards, never a sidebar. */}
        <section className="mb-12 overflow-hidden mx-[calc(50%-50vw)]">
          <div className="flex gap-4 pl-[10%] pr-8">
            {[0, 1].map(i => <Block key={i} className="shrink-0 w-[85vw] md:w-[640px] lg:w-[880px] aspect-[16/9] rounded-[20px] shadow-sm" />)}
          </div>
        </section>
        <section>
          <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Block className="h-7 w-64 max-w-full" />
            <div className="flex gap-2 flex-wrap"><Block className="h-9 w-52 rounded-full" /><Block className="h-9 w-36 rounded-full" /></div>
          </div>
          <div className="mx-[calc(50%-50vw)] px-4 md:px-6 lg:px-8">
            <div className="grid grid-flow-dense gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 auto-rows-[8px]">
              {/* FlowMosaic uses 8px rows with 12px gaps: 34/26/18-row tiles. */}
              {[34, 26, 18, 26, 18, 26].map((rows, i) => <Block key={i} className={`rounded-[20px] ${rows === 34 ? 'col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4' : rows === 26 ? 'col-span-1 sm:col-span-2' : 'col-span-1'}`} style={{ gridRowEnd: `span ${rows}` }} />)}
            </div>
          </div>
        </section>
      </div>
    </LoadingSurface>
  );
}

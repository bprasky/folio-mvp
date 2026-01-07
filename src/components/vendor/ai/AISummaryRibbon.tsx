'use client';

import { useDemoState } from '@/lib/vendor-data/demoState';
import { computeAIBundle } from '@/lib/vendor-data/ai/engine';
import { useAIUnlocked } from './useAIAccess';

/**
 * AI Summary Ribbon - Shows key AI insights at the top of the dashboard
 * Only visible when AI is unlocked
 */
export function AISummaryRibbon() {
  const { state } = useDemoState();
  const aiUnlocked = useAIUnlocked();
  
  if (!aiUnlocked) return null;

  const bundle = computeAIBundle(state);
  const topEvent = bundle.opportunityMap.find(n => n.type === 'event');
  const hotDesigner = bundle.designerFunnel.hotDesigners[0];
  const rev = bundle.revenueProjection;

  return (
    <div className="mb-6 rounded-3xl bg-black text-white px-6 py-3 shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs md:text-sm">
      <span className="font-semibold uppercase tracking-wide text-[11px] opacity-90">AI Summary for Today</span>
      <div className="flex flex-col md:flex-row gap-3 md:gap-6">
        <span className="opacity-90">
          • {topEvent ? `${topEvent.label} running hot at ${topEvent.score} score` : 'Event momentum stable.'}
        </span>
        <span className="opacity-90">
          • {hotDesigner ? `${hotDesigner.name} is ${hotDesigner.score}% likely to spec next.` : 'Designer affinity stable.'}
        </span>
        <span className="opacity-90">
          • {`Projected influence ${rev.changePct > 0 ? '+' : ''}${rev.changePct}% (${Math.round(rev.projectedInfluenceUsd / 1_000_000)}M)`}
        </span>
      </div>
    </div>
  );
}


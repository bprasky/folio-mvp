'use client';

import { useAIUnlocked } from './useAIAccess';
import { computeAIBundle } from '@/lib/vendor-data/ai/engine';
import { AIBadge } from '../shared/AIBadge';
import { fmtUsd } from '@/lib/vendor-data/common';
import { useDemoState } from '@/lib/vendor-data/demoState';

/**
 * AI Revenue Projection - Shows projected quarterly influence value
 */
export function RevenueProjectionSection() {
  const aiUnlocked = useAIUnlocked();
  const { state } = useDemoState();
  const bundle = aiUnlocked ? computeAIBundle(state) : null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-neutral-800">AI Revenue Projection</h3>
        <AIBadge />
      </div>
      <p className="text-sm text-neutral-600">
        Estimated influence value for the next quarter, based on designer and event activity.
      </p>

      {!aiUnlocked || !bundle ? (
        <div className="rounded-2xl p-4 border border-neutral-300/50 bg-white/60 backdrop-blur-xl flex items-center justify-between shadow-sm">
          <span className="text-sm text-neutral-600">
            Unlock AI to see projected quarterly influence and the drivers behind it.
          </span>
          <button 
            className="rounded-xl px-4 py-2 bg-black text-white hover:bg-neutral-800 transition text-sm"
            onClick={() => {
              // TODO: Wire to upgrade/payment flow
              console.log('[AI REVENUE] Unlock AI clicked');
            }}
          >
            Unlock AI
          </button>
        </div>
      ) : (
        <div className="rounded-2xl p-4 border border-neutral-300/60 bg-white/70 backdrop-blur-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-600 mb-1">
              {bundle.revenueProjection.quarter}
            </div>
            <div className="text-2xl font-semibold text-neutral-800">
              {fmtUsd(bundle.revenueProjection.projectedInfluenceUsd)}
              <span className="ml-2 text-sm font-normal text-emerald-700">
                (+{bundle.revenueProjection.changePct}%)
              </span>
            </div>
          </div>
          <ul className="text-xs text-neutral-600 space-y-1">
            {bundle.revenueProjection.drivers.map((d, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="text-emerald-600">•</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}


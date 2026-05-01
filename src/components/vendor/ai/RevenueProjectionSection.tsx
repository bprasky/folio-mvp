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
        <h3 className="text-lg font-semibold text-folio-text-primary">AI Revenue Projection</h3>
        <AIBadge />
      </div>
      <p className="folio-ui text-folio-text-secondary">
        Estimated influence value for the next quarter, based on designer and event activity.
      </p>

      {!aiUnlocked || !bundle ? (
        <div className="ridge-card p-4 flex items-center justify-between">
          <span className="folio-ui text-folio-text-secondary">
            Unlock AI to see projected quarterly influence and the drivers behind it.
          </span>
          <button
            className="rounded-xl px-4 py-2 bg-[var(--text-primary)] text-[var(--surface-canvas)] hover:opacity-90 transition text-sm"
            onClick={() => {
              // TODO: Wire to upgrade/payment flow
              console.log('[AI REVENUE] Unlock AI clicked');
            }}
          >
            Unlock AI
          </button>
        </div>
      ) : (
        <div className="ridge-card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="folio-meta uppercase tracking-wide text-folio-text-secondary mb-1">
              {bundle.revenueProjection.quarter}
            </div>
            <div className="text-2xl font-semibold text-folio-text-primary">
              {fmtUsd(bundle.revenueProjection.projectedInfluenceUsd)}
              <span className="ml-2 text-sm font-normal text-emerald-700">
                (+{bundle.revenueProjection.changePct}%)
              </span>
            </div>
          </div>
          <ul className="folio-meta text-folio-text-secondary space-y-1">
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


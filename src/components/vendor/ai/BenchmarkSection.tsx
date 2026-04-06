'use client';

import { useAIUnlocked } from './useAIAccess';
import { computeAIBundle } from '@/lib/vendor-data/ai/engine';
import { AIBadge } from '../shared/AIBadge';
import { useDemoState } from '@/lib/vendor-data/demoState';

/**
 * AI Competitor Benchmarks - Anonymous comparison vs peers
 */
export function BenchmarkSection() {
  const aiUnlocked = useAIUnlocked();
  const { state } = useDemoState();
  const bundle = aiUnlocked ? computeAIBundle(state) : null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-folio-text-primary">AI Competitor Benchmarks</h3>
        <AIBadge />
      </div>
      <p className="folio-ui text-folio-text-secondary">
        Anonymous comparison vs. peers in your category.
      </p>

      {!aiUnlocked || !bundle ? (
        <div className="ridge-card p-4 flex items-center justify-between">
          <span className="folio-ui text-folio-text-secondary">
            Unlock AI to compare your saves, tags, and active designers against category averages.
          </span>
          <button
            className="rounded-xl px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-base)] hover:opacity-90 transition text-sm"
            onClick={() => {
              // TODO: Wire to upgrade/payment flow
              console.log('[AI BENCHMARKS] Unlock AI clicked');
            }}
          >
            Unlock AI
          </button>
        </div>
      ) : (
        <div className="ridge-card p-4 grid md:grid-cols-3 gap-4 text-sm">
          {bundle.benchmarks.map(b => (
            <div key={b.category} className="space-y-2 p-3 rounded-lg bg-surface-ground/50">
              <div className="folio-meta uppercase tracking-wide text-folio-text-secondary">{b.category}</div>
              <div className="flex items-center justify-between">
                <span className="text-folio-text-primary">You</span>
                <span className="font-semibold text-folio-text-primary">{b.you.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between folio-meta">
                <span className="text-folio-text-secondary">Peers avg</span>
                <span className="text-folio-text-secondary">{b.peersAvg.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between folio-meta">
                <span className="text-folio-text-secondary">Top quartile</span>
                <span className="text-folio-text-secondary">{b.topQuartile.toLocaleString()}</span>
              </div>
              <div className="h-1 rounded-full bg-[var(--ridge-inner)] mt-2">
                <div
                  className="h-1 rounded-full bg-[var(--text-primary)]"
                  style={{ width: `${Math.min(100, (b.you / b.topQuartile) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}


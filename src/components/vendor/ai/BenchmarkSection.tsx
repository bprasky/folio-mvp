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
        <h3 className="text-lg font-semibold text-neutral-800">AI Competitor Benchmarks</h3>
        <AIBadge />
      </div>
      <p className="text-sm text-neutral-600">
        Anonymous comparison vs. peers in your category.
      </p>

      {!aiUnlocked || !bundle ? (
        <div className="rounded-2xl p-4 border border-neutral-300/50 bg-white/60 backdrop-blur-xl flex items-center justify-between shadow-sm">
          <span className="text-sm text-neutral-600">
            Unlock AI to compare your saves, tags, and active designers against category averages.
          </span>
          <button 
            className="rounded-xl px-4 py-2 bg-black text-white hover:bg-neutral-800 transition text-sm"
            onClick={() => {
              // TODO: Wire to upgrade/payment flow
              console.log('[AI BENCHMARKS] Unlock AI clicked');
            }}
          >
            Unlock AI
          </button>
        </div>
      ) : (
        <div className="rounded-2xl p-4 border border-neutral-300/60 bg-white/70 backdrop-blur-xl grid md:grid-cols-3 gap-4 text-sm shadow-sm">
          {bundle.benchmarks.map(b => (
            <div key={b.category} className="space-y-2 p-3 rounded-lg bg-neutral-50/50">
              <div className="text-xs uppercase tracking-wide text-neutral-600">{b.category}</div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-700">You</span>
                <span className="font-semibold text-neutral-800">{b.you.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-600">Peers avg</span>
                <span className="text-neutral-600">{b.peersAvg.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-600">Top quartile</span>
                <span className="text-neutral-600">{b.topQuartile.toLocaleString()}</span>
              </div>
              <div className="h-1 rounded-full bg-neutral-200 mt-2">
                <div 
                  className="h-1 rounded-full bg-neutral-800" 
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


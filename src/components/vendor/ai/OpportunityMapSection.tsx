'use client';

import { useAIUnlocked } from './useAIAccess';
import { computeAIBundle, type OpportunityNode } from '@/lib/vendor-data/ai/engine';
import { AIBadge } from '../shared/AIBadge';
import { useDemoState } from '@/lib/vendor-data/demoState';

/**
 * AI Opportunity Map - Shows ranked opportunities by type (events, designers, SKUs)
 */
export function OpportunityMapSection() {
  const aiUnlocked = useAIUnlocked();
  const { state } = useDemoState();
  const bundle = aiUnlocked ? computeAIBundle(state) : null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-neutral-800">AI Opportunity Map</h3>
        <AIBadge />
      </div>
      <p className="text-sm text-neutral-600">
        Where to focus events, designers, and products for the next quarter.
      </p>

      {!aiUnlocked || !bundle ? (
        <div className="rounded-2xl p-4 border border-neutral-300/50 bg-white/60 backdrop-blur-xl flex items-center justify-between shadow-sm">
          <span className="text-sm text-neutral-600">
            Unlock AI to see a ranked map of events, designers, and SKUs by impact score.
          </span>
          <button 
            className="rounded-xl px-4 py-2 bg-black text-white hover:bg-neutral-800 transition text-sm"
            onClick={() => {
              // TODO: Wire to upgrade/payment flow
              console.log('[AI OPPORTUNITY] Unlock AI clicked');
            }}
          >
            Unlock AI
          </button>
        </div>
      ) : (
        <div className="rounded-2xl p-4 border border-neutral-300/60 bg-white/70 backdrop-blur-xl grid md:grid-cols-3 gap-4 shadow-sm">
          <Column 
            title="Events" 
            items={bundle.opportunityMap.filter(n => n.type === 'event')} 
          />
          <Column 
            title="Designers" 
            items={bundle.opportunityMap.filter(n => n.type === 'designer')} 
          />
          <Column 
            title="SKUs" 
            items={bundle.opportunityMap.filter(n => n.type === 'sku')} 
          />
        </div>
      )}
    </section>
  );
}

type Item = { id: string; label: string; score: number };

function Column({ title, items }: { title: string; items: Item[] }) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-neutral-600">{title}</div>
      <ul className="space-y-1.5">
        {items.slice(0, 4).map(item => (
          <li 
            key={item.id} 
            className="flex items-center justify-between text-sm p-2 rounded-lg bg-neutral-50/50 hover:bg-neutral-100/50 transition"
          >
            <span className="truncate flex-1 text-neutral-700">{item.label}</span>
            <span className="ml-2 text-xs font-mono text-neutral-600 font-semibold">{item.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}


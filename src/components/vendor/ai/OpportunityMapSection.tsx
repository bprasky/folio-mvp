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
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">AI Opportunity Map</h3>
        <AIBadge />
      </div>
      <p className="folio-ui text-[var(--text-secondary)]">
        Where to focus events, designers, and products for the next quarter.
      </p>

      {!aiUnlocked || !bundle ? (
        <div className="ridge-card p-4 flex items-center justify-between">
          <span className="folio-ui text-[var(--text-secondary)]">
            Unlock AI to see a ranked map of events, designers, and SKUs by impact score.
          </span>
          <button
            className="rounded-xl px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-base)] hover:opacity-90 transition text-sm"
            onClick={() => {
              // TODO: Wire to upgrade/payment flow
              console.log('[AI OPPORTUNITY] Unlock AI clicked');
            }}
          >
            Unlock AI
          </button>
        </div>
      ) : (
        <div className="ridge-card p-4 grid md:grid-cols-3 gap-4">
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
      <div className="folio-meta uppercase tracking-wide text-[var(--text-secondary)]">{title}</div>
      <ul className="space-y-1.5">
        {items.slice(0, 4).map(item => (
          <li
            key={item.id}
            className="flex items-center justify-between text-sm p-2 rounded-lg bg-[var(--bg-elevated)]/50 hover:bg-[var(--bg-elevated)] transition"
          >
            <span className="truncate flex-1 text-[var(--text-primary)]">{item.label}</span>
            <span className="ml-2 folio-meta font-mono text-[var(--text-secondary)] font-semibold">{item.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}


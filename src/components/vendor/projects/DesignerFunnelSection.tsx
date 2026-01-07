'use client';

import { computeAIBundle } from '@/lib/vendor-data/ai/engine';
import { useAIUnlocked } from '../ai/useAIAccess';
import { AIBadge } from '../shared/AIBadge';
import { useDemoState } from '@/lib/vendor-data/demoState';
import { AIInlinePane } from '../ai/AIInlinePane';

/**
 * Designer Funnel Section - Standard funnel + AI "Hot Designers"
 * Standard part visible to all, AI part gated
 */
export function DesignerFunnelSection() {
  const aiUnlocked = useAIUnlocked();
  const { state } = useDemoState();
  const bundle = computeAIBundle(state);
  const f = bundle.designerFunnel;

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-neutral-800">Designer Activity Funnel (Standard)</h3>
      <p className="text-sm text-neutral-600">
        How designers move from exploring your catalog to closing projects.
      </p>
      <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm p-4 grid md:grid-cols-5 gap-3 text-sm">
        <Stage label="Exploring" value={f.exploring} total={f.total} />
        <Stage label="Warming" value={f.warming} total={f.total} />
        <Stage label="High intent" value={f.highIntent} total={f.total} />
        <Stage label="Closed (90 days)" value={f.closedLast90d} total={f.total} />
        <Stage label="Total designers" value={f.total} total={f.total} />
      </div>

      {/* AI Hot Designers */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-neutral-800">AI: Hot Designers</h4>
          <AIBadge />
        </div>
        {!aiUnlocked ? (
          <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm p-3 flex items-center justify-between text-sm">
            <span className="text-neutral-600">
              Unlock AI to see which designers are most likely to spec your products next.
            </span>
            <button 
              className="rounded-xl px-3 py-1 bg-black text-white hover:bg-neutral-800 transition text-xs"
              onClick={() => {
                // TODO: Wire to upgrade/payment flow
                console.log('[AI HOT DESIGNERS] Unlock AI clicked');
              }}
            >
              Unlock AI
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm p-3 text-sm">
            <ul className="space-y-1.5">
              {f.hotDesigners.map(d => (
                <li 
                  key={d.name} 
                  className="flex items-center justify-between p-2 rounded-lg bg-neutral-50/50 hover:bg-neutral-100/50 transition"
                >
                  <span className="text-neutral-700">{d.name}</span>
                  <span className="text-xs font-mono text-neutral-600">{d.score}% likelihood</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 text-[11px] text-neutral-500">
              Based on saves, tags, and event activity for your products.
            </div>
          </div>
        )}
        {/* Inline AI Pane for Designer Funnel */}
        <AIInlinePane sectionId="designerFunnel" />
      </section>
    </section>
  );
}

function Stage({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-neutral-600">{label}</div>
      <div className="text-base font-semibold text-neutral-800">{value.toLocaleString()}</div>
      <div className="h-1 rounded-full bg-neutral-200">
        <div 
          className="h-1 rounded-full bg-neutral-800 transition-all" 
          style={{ width: `${pct}%` }} 
        />
      </div>
      <div className="text-[11px] text-neutral-500">{pct}% of designers</div>
    </div>
  );
}


'use client';

import { useEffect, useState } from 'react';
import { computeAIBundle, type AIInsight } from '@/lib/vendor-data/ai/engine';
import { AIBadge } from '../shared/AIBadge';
import { ActionModal } from './ActionModal';
import { useAIUnlocked } from './useAIAccess';
import { useDemoState } from '@/lib/vendor-data/demoState';

/**
 * AI Insights Panel - Shows AI-generated insights with actionable CTAs
 * Locked when AI is not unlocked, shows live insights when unlocked
 */
export function AIInsightsPanel() {
  const [bundle, setBundle] = useState<ReturnType<typeof computeAIBundle> | null>(null);
  const [action, setAction] = useState<{ action: AIInsight['actions'][number]; insight: AIInsight } | null>(null);
  const aiUnlocked = useAIUnlocked();
  const { state } = useDemoState();

  useEffect(() => {
    if (aiUnlocked) {
      const computed = computeAIBundle(state);
      setBundle(computed);
    } else {
      setBundle(null);
    }
  }, [aiUnlocked, state]);

  const handleAction = (action: AIInsight['actions'][number], insight: AIInsight) => {
    setAction({ action, insight });
  };

  const closeModal = () => setAction(null);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">AI Insights & Actions</h3>
        <AIBadge />
      </div>
      
      {!aiUnlocked ? (
        <LockedTeaser />
      ) : (
        <>
          {bundle && bundle.insights.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              {bundle.insights.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onAction={(action) => handleAction(action, insight)}
                />
              ))}
            </div>
          ) : (
            <div className="ridge-card p-4 text-center folio-ui text-[var(--text-secondary)]">
              Computing insights...
            </div>
          )}
        </>
      )}

      {action && (
        <ActionModal
          action={{
            ...action.action,
            insightId: action.insight.id,
            insightTitle: action.insight.title
          }}
          onClose={closeModal}
        />
      )}
    </section>
  );
}

/**
 * Locked teaser - shown when AI insights are not unlocked
 */
function LockedTeaser() {
  return (
    <div className="ridge-card p-4 flex items-center justify-between shadow-md">
      <div className="folio-ui text-[var(--text-secondary)]">
        Predictive demand, affinity targeting, and budget optimization.
      </div>
      <div className="flex gap-2">
        <button className="rounded-xl px-4 py-2 border border-[var(--ridge-outer)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] transition">
          Preview
        </button>
        <button className="rounded-xl px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-base)] hover:opacity-90 transition">
          Unlock AI
        </button>
      </div>
    </div>
  );
}

/**
 * Insight Card - Displays a single AI insight with action buttons
 */
function InsightCard({
  insight,
  onAction
}: {
  insight: AIInsight;
  onAction: (action: AIInsight['actions'][number]) => void;
}) {
  const impactColors = {
    low: 'bg-blue-100/50 text-blue-800 border-blue-200',
    medium: 'bg-yellow-100/50 text-yellow-800 border-yellow-200',
    high: 'bg-green-100/50 text-green-800 border-green-200'
  };

  return (
    <div className="ridge-card p-4 space-y-2">
      <div className={`folio-meta uppercase tracking-wide px-2 py-1 rounded-full border inline-block ${impactColors[insight.impact]}`}>
        Impact: {insight.impact}
      </div>
      <div className="font-semibold text-[var(--text-primary)]">{insight.title}</div>
      <p className="folio-ui text-[var(--text-secondary)]">{insight.summary}</p>
      <div className="folio-meta font-mono text-[var(--text-secondary)]">
        {Object.entries(insight.metrics)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' . ')}
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        {insight.actions.map((a) => (
          <button
            key={a.id}
            onClick={() => onAction(a)}
            className="rounded-xl px-3 py-1.5 border border-[var(--ridge-outer)] hover:bg-[var(--bg-elevated)] folio-ui text-[var(--text-primary)] transition"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}



'use client';

import { useState } from 'react';
import { computeAIBundle } from '@/lib/vendor-data/ai/engine';
import { AIBadge } from '../shared/AIBadge';
import { useDemoState } from '@/lib/vendor-data/demoState';

type Props = { triggerClassName?: string };

/**
 * Hook for managing forecast preview modal state
 */
export function useForecastPreview() {
  const [open, setOpen] = useState(false);
  const Modal = open ? <ForecastPreviewModal onClose={() => setOpen(false)} /> : null;
  return { open: () => setOpen(true), close: () => setOpen(false), Modal };
}

/**
 * Forecast Preview Button - Opens the preview modal
 */
export function ForecastPreviewButton({ className }: Props) {
  const { open, Modal } = useForecastPreview();

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={className ?? 'rounded-xl px-4 py-2 border border-[var(--ridge-outer)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] transition'}
      >
        Preview
      </button>
      {Modal}
    </>
  );
}

/**
 * Forecast Preview Modal - Shows Standard vs AI comparison and sample insights
 */
export function ForecastPreviewModal({ onClose }: { onClose: () => void }) {
  const { state } = useDemoState();
  const bundle = computeAIBundle(state);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl bg-[var(--bg-base)]/95 backdrop-blur-xl border border-[var(--ridge-outer)] shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">AI Forecast Preview</h3>
              <AIBadge />
            </div>
            <p className="folio-ui text-[var(--text-secondary)] mt-1">
              Example of the insights and actions available with the AI Analytics membership.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="folio-ui text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            Close
          </button>
        </div>

        {/* Standard vs AI comparison */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[var(--ridge-outer)] bg-[var(--bg-elevated)]/50 p-4 space-y-2">
            <div className="folio-meta uppercase tracking-wide text-[var(--text-secondary)]">Current (Standard)</div>
            <ul className="folio-ui list-disc list-inside space-y-1 text-[var(--text-primary)]">
              <li>Past performance metrics (RSVPs, saves, tags)</li>
              <li>Event- and portfolio-level totals</li>
              <li>Basic charts and exportable CSV report</li>
            </ul>
          </div>
          <div className="ridge-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="folio-meta uppercase tracking-wide text-[var(--text-secondary)]">With AI Forecast</div>
              <AIBadge />
            </div>
            <ul className="folio-ui list-disc list-inside space-y-1 text-[var(--text-primary)]">
              <li>Predictive demand for key SKUs by event and quarter</li>
              <li>Designer affinity targeting based on real usage data</li>
              <li>Budget optimization suggestions for events and editorial</li>
              <li>One-click actions to spin forecasts into tasks and campaigns</li>
            </ul>
          </div>
        </div>

        {/* Sample insights */}
        <div className="space-y-2">
          <div className="folio-meta uppercase tracking-wide text-[var(--text-secondary)]">Sample Forecast</div>
          <div className="grid gap-3 md:grid-cols-3">
            {bundle.insights.slice(0, 3).map((insight) => {
              const impactColors = {
                low: 'bg-blue-100/50 text-blue-800 border-blue-200',
                medium: 'bg-yellow-100/50 text-yellow-800 border-yellow-200',
                high: 'bg-green-100/50 text-green-800 border-green-200'
              };

              return (
                <div
                  key={insight.id}
                  className="rounded-2xl border border-[var(--ridge-outer)] bg-[var(--bg-elevated)]/50 p-3 space-y-1"
                >
                  <div className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full border inline-block ${impactColors[insight.impact]}`}>
                    Impact: {insight.impact}
                  </div>
                  <div className="folio-ui font-semibold text-[var(--text-primary)]">{insight.title}</div>
                  <p className="folio-meta text-[var(--text-secondary)] line-clamp-3">{insight.summary}</p>
                  <div className="text-[10px] font-mono text-[var(--text-secondary)] mt-1">
                    {Object.entries(insight.metrics)
                      .slice(0, 2)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' . ')}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] italic">
            Numbers shown are examples based on your demo data. Live forecasts will update continuously as
            designers interact with your products.
          </p>
        </div>

        {/* CTA row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2 border-t border-[var(--ridge-outer)]">
          <p className="folio-meta md:folio-ui text-[var(--text-secondary)]">
            Upgrade to AI Analytics to enable this forecast panel, exportable AI reports, and action buttons
            directly from your dashboard.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 border border-[var(--ridge-outer)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] transition text-sm"
            >
              Maybe later
            </button>
            <button
              type="button"
              className="rounded-xl px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-base)] hover:opacity-90 transition text-sm"
              onClick={() => {
                // TODO: Wire to upgrade/payment flow
                console.log('[AI PREVIEW] Unlock AI clicked');
                onClose();
              }}
            >
              Unlock AI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


'use client';

import { useState } from 'react';
import { useAIUnlocked } from './useAIAccess';

/**
 * QBR Export Button - Exports AI Quarterly Business Review
 */
export function QBRExportButton() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const aiUnlocked = useAIUnlocked();

  async function handleClick() {
    if (!aiUnlocked) return;
    setLoading(true);
    try {
      const res = await fetch('/api/vendor/qbr');
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      } else {
        throw new Error('Failed to fetch QBR');
      }
    } catch (error) {
      console.error('[QBR] Failed to export:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={!aiUnlocked || loading}
        className="rounded-xl px-4 py-2 bg-[var(--text-primary)] text-[var(--surface-canvas)] hover:opacity-90 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Preparing…' : 'Export AI Report'}
      </button>
      {preview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-surface-canvas/95 backdrop-blur-xl border border-folio-border-subtle shadow-2xl p-5 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-folio-text-primary">AI QBR Overview (Preview)</h4>
              <button
                onClick={() => setPreview(null)}
                className="folio-meta text-folio-text-secondary hover:text-folio-text-primary transition"
              >
                Close
              </button>
            </div>
            <p className="folio-meta text-folio-text-secondary">{preview.period}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="RSVPs" value={preview.totals.rsvps} />
              <Stat label="Saves" value={preview.totals.saves} />
              <Stat label="Tags" value={preview.totals.tags} />
              <Stat 
                label="Influence value" 
                value={`$${Math.round(preview.totals.influenceUsd / 1_000_000)}M`} 
              />
            </div>
            <div className="space-y-1">
              <div className="folio-meta uppercase tracking-wide text-folio-text-secondary">Key Insights</div>
              <ul className="list-disc list-inside folio-meta text-folio-text-secondary space-y-0.5">
                {preview.topInsights.map((t: string, i: number) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
            <p className="text-[var(--type-eyebrow)] text-folio-text-secondary italic">
              In the full product this will export as a branded PDF for your internal reporting.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-folio-border-subtle bg-surface-ground px-3 py-2">
      <div className="text-[var(--type-eyebrow)] uppercase tracking-wide text-folio-text-secondary">{label}</div>
      <div className="folio-ui font-semibold text-folio-text-primary">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}



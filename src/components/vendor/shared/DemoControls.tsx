'use client';

import { useState } from 'react';
import { useDemoState } from '@/lib/vendor-data/demoState';

/**
 * Demo Controls v2 - Comprehensive sliders for all key metrics
 * Updates DemoState context which drives all panels reactively
 */
export function DemoControls() {
  const { state, setState } = useDemoState();
  const [open, setOpen] = useState(false);

  function update(path: string, value: number) {
    setState(prev => {
      const next = structuredClone(prev);
      const segs = path.split('.');
      let obj: any = next;
      for (let i = 0; i < segs.length - 1; i++) {
        obj = obj[segs[i]];
      }
      obj[segs[segs.length - 1]] = value;
      return next;
    });
  }

  function handleReset() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('folio.vendor.demo.v2');
      window.location.reload();
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setOpen(o => !o)}
        className="rounded-full px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-base)] shadow-lg hover:opacity-90 transition text-sm font-medium"
      >
        {open ? 'Close Demo' : 'Demo Controls'}
      </button>

      {open && (
        <div className="mt-2 w-[340px] max-h-[80vh] overflow-y-auto rounded-2xl bg-[var(--bg-base)]/95 backdrop-blur-xl border border-[var(--ridge-outer)] shadow-2xl p-4 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-sm text-[var(--text-primary)]">Adjust Inputs</div>
            <button
              className="folio-meta text-[var(--text-secondary)] underline hover:text-[var(--text-primary)] transition"
              onClick={handleReset}
            >
              Reset
            </button>
          </div>

          {/* Events */}
          <Section title="Events">
            <Slider
              label="Total RSVPs"
              value={state.events.portfolioTotals.totalRsvps ?? 0}
              min={0}
              max={30000}
              step={100}
              onChange={v => update('events.portfolioTotals.totalRsvps', v)}
            />
            <Slider
              label="Products Saved"
              value={state.events.portfolioTotals.productsSaved ?? 0}
              min={0}
              max={10000}
              step={50}
              onChange={v => update('events.portfolioTotals.productsSaved', v)}
            />
            <Slider
              label="Est. Project Value (M)"
              value={(state.events.portfolioTotals.estProjectValueUsd ?? 0) / 1_000_000}
              min={0}
              max={100}
              step={1}
              onChange={v => update('events.portfolioTotals.estProjectValueUsd', v * 1_000_000)}
            />
            <Slider
              label="Event → Project %"
              value={state.events.bridge.conversionPct ?? 0}
              min={0}
              max={100}
              step={1}
              onChange={v => update('events.bridge.conversionPct', v)}
            />
          </Section>

          {/* Projects */}
          <Section title="Projects">
            <Slider
              label="Product Saves"
              value={state.projects.kpi.saves ?? 0}
              min={0}
              max={10000}
              step={50}
              onChange={v => update('projects.kpi.saves', v)}
            />
            <Slider
              label="Project Tags"
              value={state.projects.kpi.tags ?? 0}
              min={0}
              max={5000}
              step={10}
              onChange={v => update('projects.kpi.tags', v)}
            />
            <Slider
              label="Influence Value (M)"
              value={(state.projects.kpi.influenceValueUsd ?? 0) / 1_000_000}
              min={0}
              max={100}
              step={1}
              onChange={v => update('projects.kpi.influenceValueUsd', v * 1_000_000)}
            />
            <Slider
              label="Saves → Tags %"
              value={state.projects.kpi.conversionPct ?? 0}
              min={0}
              max={100}
              step={1}
              onChange={v => update('projects.kpi.conversionPct', v)}
            />
          </Section>

          {/* Designers */}
          <Section title="Designers">
            <Slider
              label="Active Designers"
              value={state.events.portfolioTotals.activeDesigners ?? 0}
              min={0}
              max={5000}
              step={10}
              onChange={v => update('events.portfolioTotals.activeDesigners', v)}
            />
            {/* Individual affinity scores for top 3 designers */}
            {state.designers.affinityCandidates.slice(0, 3).map((d, idx) => (
              <Slider
                key={d.designerId}
                label={`${d.name} match %`}
                value={Math.round(d.match * 100)}
                min={0}
                max={100}
                step={1}
                onChange={v => update(`designers.affinityCandidates.${idx}.match`, v / 100)}
              />
            ))}
          </Section>

          {/* Toggle demo (keeps ?demo=1 in URL) */}
          <div className="pt-2 border-t border-[var(--ridge-outer)]">
            <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                className="rounded"
                defaultChecked={typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1'}
                onChange={e => {
                  const url = new URL(window.location.href);
                  if (e.currentTarget.checked) {
                    url.searchParams.set('demo', '1');
                  } else {
                    url.searchParams.delete('demo');
                  }
                  window.location.href = url.toString();
                }}
              />
              <span>Demo mode (unlocks AI)</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">{title}</div>
      {children}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[var(--text-primary)]">
        <span className="folio-meta">{label}</span>
        <span className="font-mono folio-meta">{typeof value === 'number' ? value.toLocaleString() : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.currentTarget.value))}
        className="w-full h-2 bg-[var(--ridge-inner)] rounded-lg appearance-none cursor-pointer accent-[var(--text-primary)]"
      />
    </div>
  );
}

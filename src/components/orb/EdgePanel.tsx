"use client";

import { EDGE_META } from "./edgeMeta";
import { NODES, type EdgeId } from "./timeline";

interface EdgePanelProps {
  edgeId: EdgeId;
}

export function EdgePanel({ edgeId }: EdgePanelProps) {
  const meta = EDGE_META[edgeId];

  if (!meta) {
    return (
      <div className="h-full flex items-center justify-center px-6 text-center text-[var(--type-eyebrow)] text-slate-500">
        This connection is not yet documented. We'll enrich it as the system evolves.
      </div>
    );
  }

  const fromNode = NODES.find((n) => n.id === meta.from);
  const toNode = NODES.find((n) => n.id === meta.to);

  return (
    <div className="h-full flex flex-col text-xs text-slate-100">
      <div className="border-b border-slate-800 px-4 py-3 flex-shrink-0">
        <div className="text-[var(--type-eyebrow)] uppercase tracking-[0.14em] text-slate-400 mb-1"> /* folio-design-system: off-scale */
          Connection
        </div>
        <h2 className="text-sm font-semibold text-slate-50">
          {fromNode?.label ?? meta.from} ↔ {toNode?.label ?? meta.to}
        </h2>
        <p className="text-[var(--type-eyebrow)] text-slate-400 mt-1">{meta.label}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <section>
          <h3 className="text-[var(--type-eyebrow)] font-semibold text-slate-300 uppercase tracking-[var(--ls-wide)] mb-1">
            What this connection does
          </h3>
          <p className="text-[var(--type-eyebrow)] text-slate-200 leading-relaxed">
            {meta.description}
          </p>
        </section>

        {meta.valueForDesigners && (
          <EdgeList title="Value for designers" items={[meta.valueForDesigners]} />
        )}
        {meta.valueForVendors && (
          <EdgeList title="Value for vendors" items={[meta.valueForVendors]} />
        )}
        {meta.valueForFolio && (
          <EdgeList title="Value for Folio" items={[meta.valueForFolio]} />
        )}
        {meta.metricsExamples && meta.metricsExamples.length > 0 && (
          <EdgeList title="Example KPIs" items={meta.metricsExamples} />
        )}
        {meta.scenarioExample && (
          <EdgeList title="Example scenario" items={[meta.scenarioExample]} />
        )}
      </div>
    </div>
  );
}

function EdgeList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="text-[var(--type-eyebrow)] font-semibold text-slate-300 uppercase tracking-[var(--ls-wide)] mb-1">
        {title}
      </h3>
      <ul className="space-y-0.5">
        {items.map((item, idx) => (
          <li key={idx} className="text-[var(--type-eyebrow)] text-slate-400 leading-snug">
            • {item}
          </li>
        ))}
      </ul>
    </section>
  );
}


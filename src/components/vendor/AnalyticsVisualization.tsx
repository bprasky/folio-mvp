"use client";

import { VisualizationSpec } from "@/lib/vendorAnalyticsVisualization";

interface AnalyticsVisualizationProps {
  spec: VisualizationSpec;
}

export const AnalyticsVisualization: React.FC<AnalyticsVisualizationProps> = ({
  spec,
}) => {
  if (!spec) return null;

  const { type } = spec;

  if (type === "stat") {
    return (
      <div className="ridge-card p-4">
        <h3 className="folio-meta uppercase tracking-wide text-folio-text-secondary">
          {spec.title}
        </h3>
        <p className="mt-3 folio-ui text-folio-text-secondary">
          {spec.primaryStatLabel}
        </p>
        <p className="text-2xl font-semibold text-folio-text-primary">
          {spec.primaryStatValue}
        </p>
        {spec.secondaryStatLabel && spec.secondaryStatValue && (
          <p className="mt-1 folio-meta text-folio-text-secondary">
            {spec.secondaryStatLabel}: {spec.secondaryStatValue}
          </p>
        )}
      </div>
    );
  }

  if (type === "bar" && spec.series && spec.series[0]) {
    const s = spec.series[0];
    const max = Math.max(...s.values, 1);
    return (
      <div className="ridge-card p-4">
        <h3 className="folio-meta uppercase tracking-wide text-folio-text-secondary">
          {spec.title}
        </h3>
        <div className="mt-4 flex items-end gap-2">
          {s.values.map((v, idx) => {
            const h = (v / max) * 80;
            return (
              <div key={idx} className="flex flex-1 flex-col items-center">
                <div
                  className="w-full rounded-t-md bg-[var(--text-tertiary)]"
                  style={{ height: `${h}px` }}
                />
                {s.labels && s.labels[idx] && (
                  <span className="mt-1 text-[10px] text-folio-text-secondary text-center">
                    {s.labels[idx]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "table" && spec.columns && spec.rows) {
    return (
      <div className="ridge-card p-4 overflow-x-auto">
        <h3 className="folio-meta uppercase tracking-wide text-folio-text-secondary mb-3">
          {spec.title}
        </h3>
        <table className="min-w-full text-xs text-left">
          <thead className="border-b border-folio-border-subtle text-[11px] uppercase tracking-wide text-folio-text-secondary">
            <tr>
              {spec.columns.map((col) => (
                <th key={col} className="px-2 py-1">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ridge-inner)]">
            {spec.rows.map((row, idx) => (
              <tr key={idx}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-2 py-1 text-folio-text-primary">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Fallback
  return null;
};


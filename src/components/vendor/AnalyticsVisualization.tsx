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
      <div className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {spec.title}
        </h3>
        <p className="mt-3 text-sm text-neutral-500">
          {spec.primaryStatLabel}
        </p>
        <p className="text-2xl font-semibold text-neutral-900">
          {spec.primaryStatValue}
        </p>
        {spec.secondaryStatLabel && spec.secondaryStatValue && (
          <p className="mt-1 text-xs text-neutral-500">
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
      <div className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {spec.title}
        </h3>
        <div className="mt-4 flex items-end gap-2">
          {s.values.map((v, idx) => {
            const h = (v / max) * 80;
            return (
              <div key={idx} className="flex flex-1 flex-col items-center">
                <div
                  className="w-full rounded-t-md bg-neutral-300"
                  style={{ height: `${h}px` }}
                />
                {s.labels && s.labels[idx] && (
                  <span className="mt-1 text-[10px] text-neutral-500 text-center">
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
      <div className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-sm overflow-x-auto">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">
          {spec.title}
        </h3>
        <table className="min-w-full text-xs text-left">
          <thead className="border-b border-neutral-200 text-[11px] uppercase tracking-wide text-neutral-500">
            <tr>
              {spec.columns.map((col) => (
                <th key={col} className="px-2 py-1">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {spec.rows.map((row, idx) => (
              <tr key={idx}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-2 py-1 text-neutral-800">
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


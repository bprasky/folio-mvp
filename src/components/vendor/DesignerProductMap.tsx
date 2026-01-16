"use client";

import {
  VendorAnalyticsData,
  Product,
  DesignerEngagement,
} from "@/lib/vendorAnalyticsMock";

interface DesignerProductMapProps {
  data: VendorAnalyticsData;
}

export const DesignerProductMap: React.FC<DesignerProductMapProps> = ({
  data,
}) => {
  // Simple heuristic: show top 5 products by tags and top 6 designers by influencedProjectBudget
  const topProducts = [...data.productStats]
    .sort((a, b) => b.tags - a.tags)
    .slice(0, 5)
    .map((ps) => data.products.find((p) => p.productId === ps.productId))
    .filter(Boolean) as Product[];

  const topDesigners = [...data.designerEngagement]
    .sort((a, b) => b.influencedProjectBudget - a.influencedProjectBudget)
    .slice(0, 6);

  // For now, we fake a simple engagement score matrix using existing totals
  return (
    <section className="mt-8 ridge-card p-4">
      <h2 className="folio-ui font-semibold text-[var(--text-primary)]">
        Designer × Product map
      </h2>
      <p className="mt-1 folio-meta text-[var(--text-secondary)]">
        A high-level view of how your key designers and products relate. Darker
        cells indicate stronger engagement.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr>
              <th className="px-2 py-2 text-left text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                Product / Designer
              </th>
              {topDesigners.map((d) => {
                const designer = data.designers.find((des) => des.designerId === d.designerId);
                return (
                  <th
                    key={d.designerId}
                    className="px-2 py-2 text-[11px] uppercase tracking-wide text-[var(--text-secondary)] text-left"
                  >
                    {designer?.name || d.designerId}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {topProducts.map((p) => (
              <tr key={p.productId} className="border-t border-[var(--ridge-inner)]">
                <td className="px-2 py-2 text-[var(--text-primary)]">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    {p.collectionName}
                  </div>
                </td>
                {topDesigners.map((d) => {
                  // crude heat heuristic: combine aligned scores with random-ish variation
                  const engagement = d.alignmentScore * d.totalSaves;
                  const capped = Math.min(engagement / 50, 1);
                  const bg = `rgba(0,0,0,${0.05 + capped * 0.25})`;
                  return (
                    <td key={d.designerId} className="px-2 py-2">
                      <div
                        className="h-6 w-12 rounded-md"
                        style={{ backgroundColor: bg }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};



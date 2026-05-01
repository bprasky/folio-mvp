"use client";

import { useEffect, useState } from "react";
import { PinnedInsight } from "@/lib/vendorInsights";
import { VisualizationSpec } from "@/lib/vendorAnalyticsVisualization";
import AnalyticsVisualization from "./AnalyticsVisualization";

interface PinnedInsightCardProps {
  vendorId: string;
  insight: PinnedInsight;
  onUnpin?: () => void;
}

interface PinnedInsightSnapshot {
  visualization?: VisualizationSpec;
  answer?: string;
}

const PinnedInsightCard: React.FC<PinnedInsightCardProps> = ({
  vendorId,
  insight,
  onUnpin,
}) => {
  const [snapshot, setSnapshot] = useState<PinnedInsightSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const payload = {
          vendorId,
          messages: [{ role: "user" as const, content: insight.question }],
        };

        const res = await fetch("/api/vendor-analytics/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error("Request failed");

        const data = (await res.json()) as PinnedInsightSnapshot;
        if (!cancelled) {
          setSnapshot(data);
        }
      } catch (e) {
        if (!cancelled) setError("Could not refresh this insight.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [vendorId, insight.question]);

  return (
    <article className="ridge-card p-4 relative">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="folio-ui font-medium text-folio-text-primary pr-8">
          {insight.question}
        </h3>
        {onUnpin && (
          <button
            type="button"
            onClick={onUnpin}
            className="absolute top-3 right-3 text-folio-text-tertiary hover:text-folio-text-secondary transition-colors"
            aria-label="Unpin insight"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      <p className="text-[var(--type-eyebrow)] uppercase tracking-wide text-folio-text-tertiary mb-3">
        Pinned {new Date(insight.pinnedAt).toLocaleString()}
      </p>

      {isLoading && (
        <p className="mt-3 folio-meta text-folio-text-secondary">Refreshing insight...</p>
      )}

      {error && (
        <p className="mt-3 text-xs text-red-500">{error}</p>
      )}

      {snapshot?.visualization && (
        <div className="mt-3">
          <AnalyticsVisualization spec={snapshot.visualization} />
        </div>
      )}

      {!snapshot?.visualization && !isLoading && !error && (
        <p className="mt-3 folio-meta text-folio-text-secondary">
          No visual available for this insight yet.
        </p>
      )}
    </article>
  );
};

export default PinnedInsightCard;



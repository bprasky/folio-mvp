'use client';

import { useState, useEffect } from 'react';
import { RidgeCard } from '@/components/ui/ridge-card';

interface AnalyticsData {
  volume: {
    total: number;
    byType: Record<string, number>;
    changePercent: number | null;
    previousTotal: number;
  };
  designers: { activeCount: number };
  response: {
    avgResponseHours: number | null;
    offPlatformRate: number;
  };
  topProducts: Array<{
    productId: string;
    productName: string;
    category: string | null;
    requestCount: number;
  }>;
  shadowProfile: {
    totalProducts: number;
    totalProjects: number;
    totalDesigners: number;
    geoDistribution: Record<string, number> | null;
  } | null;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  QUOTE_REQUEST: 'Quotes',
  SAMPLE_REQUEST: 'Samples',
  BULK_QUOTE_REQUEST: 'Bulk Quotes',
  LEAD_TIME_REQUEST: 'Lead Times',
  AVAILABILITY_CHECK: 'Availability',
  GENERAL_MESSAGE: 'General',
};

export default function ActionItemsAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/vendor/analytics/action-items')
      .then(res => res.ok ? res.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <RidgeCard padding="lg">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-surface-ground rounded w-1/3" />
          <div className="h-8 bg-surface-ground rounded w-1/2" />
          <div className="h-4 bg-surface-ground rounded w-2/3" />
        </div>
      </RidgeCard>
    );
  }

  if (!data || data.volume.total === 0) {
    return (
      <RidgeCard padding="lg">
        <h3 className="text-sm font-semibold text-folio-text-primary mb-2">Specification Activity</h3>
        <p className="text-sm text-folio-text-tertiary">
          No designer activity yet. When designers request quotes, samples, or lead times for your products, analytics will appear here.
        </p>
      </RidgeCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Volume Summary */}
      <RidgeCard padding="lg">
        <h3 className="text-sm font-semibold text-folio-text-primary mb-3">Specification Activity (30 days)</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-2xl font-semibold text-folio-text-primary" style={{ fontFamily: 'var(--font-headline)' }}>
              {data.volume.total}
            </div>
            <div className="text-xs text-folio-text-tertiary">
              Total requests
              {data.volume.changePercent !== null && (
                <span className={data.volume.changePercent >= 0 ? ' text-green-600' : ' text-red-500'}>
                  {' '}{data.volume.changePercent >= 0 ? '+' : ''}{data.volume.changePercent}%
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-folio-text-primary" style={{ fontFamily: 'var(--font-headline)' }}>
              {data.designers.activeCount}
            </div>
            <div className="text-xs text-folio-text-tertiary">Active designers</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-folio-text-primary" style={{ fontFamily: 'var(--font-headline)' }}>
              {data.response.avgResponseHours !== null
                ? data.response.avgResponseHours < 24
                  ? `${data.response.avgResponseHours}h`
                  : `${Math.round(data.response.avgResponseHours / 24)}d`
                : '—'}
            </div>
            <div className="text-xs text-folio-text-tertiary">Avg response time</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-folio-text-primary" style={{ fontFamily: 'var(--font-headline)' }}>
              {100 - data.response.offPlatformRate}%
            </div>
            <div className="text-xs text-folio-text-tertiary">On-platform rate</div>
          </div>
        </div>

        {/* By Type */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.volume.byType)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <span
                key={type}
                className="px-2.5 py-1 rounded-full text-xs bg-surface-ground text-folio-text-secondary"
              >
                {ACTION_TYPE_LABELS[type] || type}: {count}
              </span>
            ))}
        </div>
      </RidgeCard>

      {/* Top Products */}
      {data.topProducts.length > 0 && (
        <RidgeCard padding="lg">
          <h3 className="text-sm font-semibold text-folio-text-primary mb-3">Most Requested Products</h3>
          <div className="space-y-2">
            {data.topProducts.slice(0, 8).map((product, i) => (
              <div key={product.productId} className="flex items-center gap-3 text-sm">
                <span className="text-xs text-folio-text-tertiary w-5 text-right">{i + 1}.</span>
                <span className="text-folio-text-primary flex-grow truncate">{product.productName}</span>
                {product.category && (
                  <span className="text-xs text-folio-text-tertiary">{product.category}</span>
                )}
                <span className="text-xs font-medium text-[var(--accent)]">{product.requestCount} requests</span>
              </div>
            ))}
          </div>
        </RidgeCard>
      )}

      {/* Shadow Profile Summary (for unclaimed vendors or as bonus insight) */}
      {data.shadowProfile && (
        <RidgeCard padding="lg">
          <h3 className="text-sm font-semibold text-folio-text-primary mb-3">Ecosystem Overview</h3>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <div className="text-lg font-semibold text-folio-text-primary">{data.shadowProfile.totalProducts}</div>
              <div className="text-xs text-folio-text-tertiary">Products specified</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-folio-text-primary">{data.shadowProfile.totalProjects}</div>
              <div className="text-xs text-folio-text-tertiary">Projects</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-folio-text-primary">{data.shadowProfile.totalDesigners}</div>
              <div className="text-xs text-folio-text-tertiary">Designers</div>
            </div>
          </div>

          {data.shadowProfile.geoDistribution && (
            <div className="mt-3">
              <div className="text-xs font-medium text-folio-text-tertiary mb-1">Geographic Distribution</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(data.shadowProfile.geoDistribution as Record<string, number>)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([location, pct]) => (
                    <span key={location} className="text-xs px-2 py-0.5 rounded-full bg-surface-ground text-folio-text-secondary">
                      {location} {Math.round(pct * 100)}%
                    </span>
                  ))}
              </div>
            </div>
          )}
        </RidgeCard>
      )}
    </div>
  );
}

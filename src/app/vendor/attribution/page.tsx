'use client';

import { useState, useEffect } from 'react';
import { AttributionFlowChart } from '@/components/vendor/charts/AttributionFlowChart';
import { ProductAttributionDetail } from '@/components/vendor/charts/ProductAttributionDetail';
import SafeImage from '@/components/common/SafeImage';
import { TrendingUp, Users, Package, DollarSign } from 'lucide-react';

interface TopProduct {
  id: string;
  name: string;
  imageUrl?: string | null;
  category?: string | null;
  tags: number;
  likes: number;
  saves: number;
  specs: number;
  orders: number;
  revenueCents: number;
  engagementScore: number;
}

interface TopDesigner {
  id: string;
  name: string;
  profileImage?: string | null;
  tagCount: number;
}

interface OrgOverview {
  totals: {
    tags: number;
    likes: number;
    saves: number;
    specs: number;
    orders: number;
    revenueCents: number;
  };
  conversionRates: {
    tagToSave: number;
    saveToSpec: number;
    specToOrder: number;
  };
}

interface AttributionOverviewData {
  orgOverview: OrgOverview;
  topProducts: TopProduct[];
  topDesigners: TopDesigner[];
}

export default function VendorAttributionPage() {
  const [data, setData] = useState<AttributionOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/vendor/attribution-tree')
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 403 ? 'Access denied' : 'Failed to load');
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center py-20">
          <h2 className="text-xl font-serif text-[#2C2825] mb-2">Attribution Analytics</h2>
          <p className="text-[#8C8278]">
            {error === 'Access denied'
              ? 'This feature requires a Growth plan or higher.'
              : 'Failed to load attribution data.'}
          </p>
        </div>
      </div>
    );
  }

  // Product detail view
  if (selectedProductId) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <ProductAttributionDetail
          productId={selectedProductId}
          onBack={() => setSelectedProductId(null)}
        />
      </div>
    );
  }

  if (!data) return null;

  const { orgOverview, topProducts, topDesigners } = data;
  const { totals } = orgOverview;

  const funnelStages = [
    { label: 'Tagged', count: totals.tags },
    { label: 'Saved', count: totals.saves },
    { label: 'Specified', count: totals.specs },
    { label: 'Ordered', count: totals.orders, revenueCents: totals.revenueCents },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif text-[#2C2825]">Product Attribution</h1>
        <p className="text-sm text-[#8C8278] mt-1">
          How your products flow through designer projects — from discovery to purchase
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Package, label: 'Products Tagged', value: totals.tags, color: '#DAD2CA' },
          { icon: TrendingUp, label: 'Saves', value: totals.saves, color: '#C9B99A' },
          { icon: Users, label: 'Specifications', value: totals.specs, color: '#B8A580' },
          { icon: DollarSign, label: 'Revenue', value: `$${(totals.revenueCents / 100).toLocaleString()}`, color: 'var(--folio-gold-ornament)' },
        ].map((card) => (
          <div key={card.label} className="p-4 rounded-2xl bg-[var(--surface-ground)] border border-[#E5E0D7]/50">
            <card.icon className="w-5 h-5 mb-2" style={{ color: card.color }} />
            <div className="text-xl font-semibold text-[#2C2825]">
              {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
            </div>
            <div className="text-xs text-[#8C8278] uppercase tracking-wider">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Org-wide funnel */}
      <div className="p-6 rounded-2xl bg-[var(--surface-ground)] border border-[#E5E0D7]/50">
        <h2 className="text-sm font-semibold text-[#2C2825] uppercase tracking-wider mb-4">
          Overall Attribution Funnel
        </h2>
        <AttributionFlowChart stages={funnelStages} />
      </div>

      {/* Top products */}
      <div>
        <h2 className="text-sm font-semibold text-[#2C2825] uppercase tracking-wider mb-4">
          Top Products by Engagement
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => setSelectedProductId(product.id)}
              className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--surface-ground)] border border-[#E5E0D7]/50 hover:border-[var(--folio-gold-ornament)]/30 transition-colors text-left group"
            >
              {product.imageUrl ? (
                <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0">
                  <SafeImage src={product.imageUrl} alt={product.name} fill className="object-cover" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-xl bg-[#E5E0D7] flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-[#8C8278]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#2C2825] truncate group-hover:text-[var(--folio-gold-ornament)] transition-colors">
                  {product.name}
                </div>
                <div className="text-xs text-[#8C8278] mt-0.5">
                  {product.tags} tags · {product.saves} saves · {product.specs} specs
                  {product.orders > 0 && ` · ${product.orders} orders`}
                </div>
                {product.revenueCents > 0 && (
                  <div className="text-xs font-medium text-[var(--folio-gold-ornament)] mt-0.5">
                    ${(product.revenueCents / 100).toLocaleString()} revenue
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-semibold text-[#B8A580]">{product.engagementScore}</div>
                <div className="text-[10px] text-[#8C8278] uppercase">Score</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Top designers */}
      {topDesigners.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#2C2825] uppercase tracking-wider mb-4">
            Top Influencing Designers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {topDesigners.map((designer, i) => (
              <div
                key={designer.id}
                className="flex items-center gap-3 p-4 rounded-2xl bg-[var(--surface-ground)] border border-[#E5E0D7]/50"
              >
                <div className="w-10 h-10 rounded-full bg-[#E5E0D7] flex items-center justify-center text-sm font-semibold text-[#8C8278] shrink-0">
                  {designer.profileImage ? (
                    <SafeImage
                      src={designer.profileImage}
                      alt={designer.name}
                      width={40}
                      height={40}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    i + 1
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#2C2825] truncate">{designer.name}</div>
                  <div className="text-xs text-[#8C8278]">
                    {designer.tagCount} product{designer.tagCount !== 1 ? 's' : ''} tagged
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

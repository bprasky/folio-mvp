'use client';

import { useState, useEffect } from 'react';
import { AttributionFlowChart } from './AttributionFlowChart';
import { ArrowLeft, Tag, Heart, Bookmark, ClipboardList, FileText, ShoppingBag, User } from 'lucide-react';
import SafeImage from '@/components/common/SafeImage';

interface TimelineEvent {
  type: string;
  date: string;
  actor?: string;
  detail?: string;
}

interface Influencer {
  id: string;
  name: string;
  tags: number;
  saves: number;
  specs: number;
  orders: number;
  creditCents: number;
  influenceScore: number;
}

interface ProductAttributionData {
  product: { id: string; name: string; imageUrl?: string | null; category?: string | null; brand?: string | null };
  stages: {
    tagged: { count: number };
    viewed: { count: number };
    liked: { count: number };
    saved: { count: number; convertedCount: number };
    specified: { count: number };
    quoted: { count: number; totalAmount: number };
    ordered: { count: number; totalRevenueCents: number };
  };
  conversionRates: Record<string, number>;
  timeline: TimelineEvent[];
  topInfluencers: Influencer[];
}

interface ProductAttributionDetailProps {
  productId: string;
  onBack: () => void;
}

const EVENT_ICONS: Record<string, typeof Tag> = {
  tagged: Tag,
  saved: Bookmark,
  liked: Heart,
  specified: ClipboardList,
  quoted: FileText,
  ordered: ShoppingBag,
};

const EVENT_COLORS: Record<string, string> = {
  tagged: '#DAD2CA',
  saved: '#C9B99A',
  liked: '#C9B99A',
  specified: '#B8A580',
  quoted: '#A89060',
  ordered: 'var(--folio-gold-ornament)',
};

export function ProductAttributionDetail({ productId, onBack }: ProductAttributionDetailProps) {
  const [data, setData] = useState<ProductAttributionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/vendor/attribution-tree?productId=${productId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [productId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.product) {
    return <div className="py-10 text-center text-stone-500">Product not found</div>;
  }

  const { product, stages, timeline, topInfluencers } = data;

  const funnelStages = [
    { label: 'Tagged', count: stages.tagged.count },
    { label: 'Saved', count: stages.saved.count },
    { label: 'Specified', count: stages.specified.count },
    { label: 'Quoted', count: stages.quoted.count },
    { label: 'Ordered', count: stages.ordered.count, revenueCents: stages.ordered.totalRevenueCents },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={onBack} className="mt-1 p-1 rounded hover:bg-stone-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-stone-500" />
        </button>
        <div className="flex items-center gap-4 flex-1">
          {product.imageUrl && (
            <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0">
              <SafeImage src={product.imageUrl} alt={product.name} fill className="object-cover" />
            </div>
          )}
          <div>
            <h2 className="text-xl font-serif text-[#2C2825]">{product.name}</h2>
            <div className="flex gap-3 text-sm text-[#8C8278]">
              {product.brand && <span>{product.brand}</span>}
              {product.category && <span>· {product.category}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Views', value: stages.viewed.count },
          { label: 'Likes', value: stages.liked.count },
          { label: 'Saves', value: stages.saved.count },
          { label: 'Specs', value: stages.specified.count },
          { label: 'Orders', value: stages.ordered.count },
        ].map((stat) => (
          <div key={stat.label} className="text-center p-3 rounded-xl bg-[#FAF8F5]">
            <div className="text-lg font-semibold text-[#2C2825]">{stat.value}</div>
            <div className="text-xs text-[#8C8278] uppercase tracking-wider">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Attribution funnel */}
      <div>
        <h3 className="text-sm font-semibold text-[#2C2825] uppercase tracking-wider mb-4">Attribution Funnel</h3>
        <AttributionFlowChart stages={funnelStages} />
      </div>

      {/* Top influencers */}
      {topInfluencers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#2C2825] uppercase tracking-wider mb-4">Top Influencers</h3>
          <div className="space-y-2">
            {topInfluencers.slice(0, 8).map((inf, i) => (
              <div key={inf.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#FAF8F5]">
                <div className="w-8 h-8 rounded-full bg-[#E5E0D7] flex items-center justify-center text-xs font-semibold text-[#8C8278]">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#2C2825] truncate">{inf.name}</div>
                  <div className="text-xs text-[#8C8278]">
                    {inf.tags} tags · {inf.saves} saves · {inf.specs} specs
                    {inf.orders > 0 && ` · ${inf.orders} orders`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-[var(--folio-gold-ornament)]">{inf.influenceScore}</div>
                  <div className="text-[10px] text-[#8C8278] uppercase">Score</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#2C2825] uppercase tracking-wider mb-4">Attribution Timeline</h3>
          <div className="relative pl-6 space-y-0">
            {/* Vertical line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[#E5E0D7]" />

            {timeline.map((event, i) => {
              const Icon = EVENT_ICONS[event.type] || Tag;
              const color = EVENT_COLORS[event.type] || '#DAD2CA';
              const date = new Date(event.date);

              return (
                <div key={i} className="relative flex items-start gap-3 py-2">
                  {/* Dot */}
                  <div
                    className="absolute left-[-13px] mt-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: color }}
                  >
                    <Icon className="w-2.5 h-2.5 text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#2C2825]">
                      {event.actor && <span className="font-medium">{event.actor}</span>}
                      {event.actor && ' — '}
                      {event.detail}
                    </div>
                    <div className="text-xs text-[#8C8278]">
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

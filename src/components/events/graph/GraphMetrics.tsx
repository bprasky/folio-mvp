"use client";

import { Users, Mail, TrendingUp, DollarSign } from 'lucide-react';

interface GraphMetricsProps {
  metrics: any;
  summary: {
    totalDesigners: number;
    totalVendors: number;
    totalProducts: number;
    totalReps: number;
    totalRelationships: number;
  };
}

export default function GraphMetrics({ metrics, summary }: GraphMetricsProps) {
  const metricCards = [
    {
      label: 'Total Invites',
      value: metrics.totalInvites || 0,
      icon: Mail,
      color: 'text-blue-600',
    },
    {
      label: 'Total RSVPs',
      value: metrics.totalRSVPs || 0,
      icon: Users,
      color: 'text-green-600',
    },
    {
      label: 'Total Attendees',
      value: metrics.totalAttendees || 0,
      icon: TrendingUp,
      color: 'text-purple-600',
    },
    {
      label: 'Estimated Revenue',
      value: metrics.estimatedRevenue 
        ? `$${(metrics.estimatedRevenue / 1000).toFixed(1)}k`
        : 'N/A',
      icon: DollarSign,
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metricCards.map((card, idx) => (
        <div
          key={idx}
          className="bg-white rounded-xl border border-stone-200 shadow-sm p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <card.icon className={`w-5 h-5 ${card.color}`} />
            <span className="text-2xl font-serif font-medium text-ink">
              {card.value}
            </span>
          </div>
          <p className="text-sm text-stone-500">{card.label}</p>
        </div>
      ))}

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
        <h4 className="text-sm font-medium text-ink mb-3">Graph Summary</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-500">Designers</span>
            <span className="font-medium text-ink">{summary.totalDesigners}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Vendors</span>
            <span className="font-medium text-ink">{summary.totalVendors}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Products</span>
            <span className="font-medium text-ink">{summary.totalProducts}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Reps</span>
            <span className="font-medium text-ink">{summary.totalReps}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-stone-200">
            <span className="text-stone-500">Relationships</span>
            <span className="font-medium text-ink">{summary.totalRelationships}</span>
          </div>
        </div>
      </div>
    </div>
  );
}





import { Section } from './Section';
import { flags } from '@/lib/flags';
import { fmtPct } from '@/lib/vendor-data/common';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { AIInlinePane } from '../ai/AIInlinePane';

interface VendorBridgeProps {
  activeTab: 'events' | 'projects';
  bridgeData?: { conversionPct: number | null; avgDays: number | null } | null;
  loading?: boolean;
}

/**
 * Event → Project Bridge - Visual representation of conversion funnel
 * Shows how exposure at events turns into live project tags
 */
export function VendorBridge({ activeTab, bridgeData, loading = false }: VendorBridgeProps) {
  const conversion = bridgeData?.conversionPct ?? null;
  const avgDays = bridgeData?.avgDays ?? null;

  return (
    <Section 
      title="Event → Project Conversion" 
      ai={flags.vendorAIInsights} 
      subtitle="Shows how exposure at events turns into live project tags."
    >
      {loading ? (
        <div className="rounded-2xl p-4 md:p-6 bg-white border border-neutral-200 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="mt-4 h-1 w-full" />
        </div>
      ) : conversion == null && avgDays == null ? (
        <EmptyState 
          title="Conversion data will appear here" 
          subtitle="Once you have events with project tags, we'll show your conversion funnel."
        />
      ) : (
        <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm p-4 md:p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="text-sm text-neutral-600">Conversion Rate</div>
            <div className="text-3xl font-semibold text-neutral-800">{fmtPct(conversion)}</div>
            <div className="text-sm text-neutral-600">
              Avg. Time: {avgDays == null ? '—' : `${avgDays} days`}
            </div>
          </div>
          {/* Flow line with actual conversion percentage */}
          <div className="mt-4 h-1 rounded-full bg-neutral-200/60">
            <div 
              className={`h-1 rounded-full bg-neutral-800 transition-all`} 
              style={{ width: conversion != null ? `${Math.min(conversion, 100)}%` : '0%' }} 
            />
          </div>
          <div className="mt-2 text-xs text-neutral-600">
            Events → Saves → Project Tags → Editorial Mentions
          </div>
          {/* Inline AI Pane for Events Section */}
          <AIInlinePane sectionId="events" />
        </div>
      )}
    </Section>
  );
}


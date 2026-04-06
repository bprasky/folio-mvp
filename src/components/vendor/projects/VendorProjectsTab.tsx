'use client';

import { useEffect, useState } from 'react';
import { Section } from '../shared/Section';
import { AIBadge } from '../shared/AIBadge';
import { fetchProjectKPI } from '@/lib/vendor-data/projectsAdapter';
import { fmtInt, fmtUsd, fmtPct } from '@/lib/vendor-data/common';
import { Skeleton } from '../shared/Skeleton';
import { EmptyState } from '../shared/EmptyState';
import { computeAIBundle } from '@/lib/vendor-data/ai/engine';
import { useAIUnlocked } from '../ai/useAIAccess';
import { DesignerFunnelSection } from './DesignerFunnelSection';
import { useDemoState } from '@/lib/vendor-data/demoState';
import { AIInlinePane } from '../ai/AIInlinePane';

/**
 * Vendor Projects Tab - Standard and AI-powered project analytics
 */
export function VendorProjectsTab({ vendorId }: { vendorId?: string | null }) {
  const [projectKPI, setProjectKPI] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const aiUnlocked = useAIUnlocked();
  const { state } = useDemoState();
  const bundle = aiUnlocked ? computeAIBundle(state) : null;
  const affinityInsight = bundle?.insights.find(i => i.id === 'designer-affinity');

  useEffect(() => {
    // In demo mode, read from demo state
    const isDemoMode = typeof window !== 'undefined' && (
      new URLSearchParams(window.location.search).get('demo') === '1'
    );
    
    if (isDemoMode) {
      setProjectKPI({
        saves: state.projects.kpi.saves,
        tags: state.projects.kpi.tags,
        influenceValueUsd: state.projects.kpi.influenceValueUsd,
        conversionPct: state.projects.kpi.conversionPct,
      });
      setLoading(false);
      return;
    }
    
    if (!vendorId) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const kpi = await fetchProjectKPI(vendorId);
        setProjectKPI(kpi);
      } catch (error) {
        console.error('[VendorProjectsTab] Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [vendorId, state]);
  return (
    <div className="space-y-6">
      {/* Standard */}
      <Section 
        title="Projects & Collaborations (Standard)" 
        subtitle="Which designers and projects are actively tagging your products."
      >
        {loading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : projectKPI ? (
          <>
            <PlaceholderCard 
              label="Product Saves" 
              value={fmtInt(projectKPI.saves)} 
            />
            <PlaceholderCard 
              label="Project Tags" 
              value={fmtInt(projectKPI.tags)} 
            />
            <PlaceholderCard 
              label="Conversion Rate (Saves → Tags)" 
              value={fmtPct(projectKPI.conversionPct)} 
            />
            <PlaceholderCard 
              label="Estimated Influence Value" 
              value={fmtUsd(projectKPI.influenceValueUsd)} 
            />
            {/* Inline AI Pane for Projects Section */}
            <AIInlinePane sectionId="projects" />
          </>
        ) : (
          <EmptyState 
            title="No project data yet" 
            subtitle="Project tags and collaboration metrics will appear here once designers start tagging your products."
          />
        )}
      </Section>

      {/* Designer Funnel (Standard + AI Hot Designers) */}
      <DesignerFunnelSection />
    </div>
  );
}

function PlaceholderCard({ label, value = '—' }: { label: string; value?: string | React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4 ridge-card">
      <div className="text-sm text-folio-text-secondary">{label}</div>
      <div className="text-2xl font-semibold text-folio-text-primary">{value}</div>
    </div>
  );
}


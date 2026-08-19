'use client';

import { useState, useEffect, useCallback } from 'react';
import { VendorEventsTab } from './events/VendorEventsTab';
import { VendorProjectsTab } from './projects/VendorProjectsTab';
import { VendorBridge } from './shared/VendorBridge';
import { AIBadge } from './shared/AIBadge';
import { flags } from '@/lib/flags';
import { useVendorId } from '@/hooks/useVendorId';
import { fetchEventKPI, fetchEventToProjectBridge } from '@/lib/vendor-data/eventsAdapter';
import { fetchProjectKPI } from '@/lib/vendor-data/projectsAdapter';
import { fmtInt, fmtUsd, fmtPct } from '@/lib/vendor-data/common';
import { Skeleton } from './shared/Skeleton';
import { DemoControls } from './shared/DemoControls';
import { useAIUnlocked } from './ai/useAIAccess';
import { QBRExportButton } from './ai/QBRExportButton';
import { AISummaryRibbon } from './ai/AISummaryRibbon';
import { useOptionalDemoState } from '@/lib/vendor-data/demoState';
import { computeAIBundle } from '@/lib/vendor-data/ai/engine';
import { AIInlinePane } from './ai/AIInlinePane';

/**
 * Glassmorphic container component - Improved visual hierarchy
 */
const Card: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className, children }) => (
  <div className={`ridge-card p-4 md:p-6 ${className ?? ''}`}>
    {children}
  </div>
);

/**
 * New Vendor Dashboard - Dual-tab structure with Events and Projects views
 * Feature-flagged and non-destructive wrapper around existing dashboard
 */
export function VendorDashboardNew() {
  const [activeTab, setActiveTab] = useState<'events' | 'projects'>('events');
  const vendorId = useVendorId();
  const aiUnlocked = useAIUnlocked();
  
  // Check if demo mode is active
  const isDemoMode = typeof window !== 'undefined' && (
    flags.vendorDemoData || 
    new URLSearchParams(window.location.search).get('demo') === '1'
  );
  
  // Called unconditionally, then discarded when not in demo mode. Calling it
  // inside `if (isDemoMode)` changed the hook order the moment demo mode
  // toggled, which is the failure rules-of-hooks exists to prevent.
  //
  // useOptionalDemoState rather than useDemoState: the latter THROWS without a
  // provider, which is why the original wrapped it in a try/catch. The optional
  // form calls useContext unconditionally and returns null instead.
  const demoStateValue = useOptionalDemoState();
  const demoState = isDemoMode ? demoStateValue : null;
  
  const [eventKPI, setEventKPI] = useState<any>(null);
  const [projectKPI, setProjectKPI] = useState<any>(null);
  const [bridge, setBridge] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    // In demo mode, read directly from demo state
    if (isDemoMode && demoState) {
      const state = demoState.state;
      setEventKPI({
        totalRsvps: state.events.portfolioTotals.totalRsvps,
        productsSaved: state.events.portfolioTotals.productsSaved,
        estProjectValueUsd: state.events.portfolioTotals.estProjectValueUsd,
        activeDesigners: state.events.portfolioTotals.activeDesigners,
      });
      setProjectKPI({
        saves: state.projects.kpi.saves,
        tags: state.projects.kpi.tags,
        influenceValueUsd: state.projects.kpi.influenceValueUsd,
        conversionPct: state.projects.kpi.conversionPct,
      });
      setBridge({
        conversionPct: state.events.bridge.conversionPct,
        avgDays: state.events.bridge.avgDays,
      });
      setLoading(false);
      return;
    }
    
    // Non-demo mode: use existing adapter fetches
    if (!vendorId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [event, project, bridgeData] = await Promise.all([
        fetchEventKPI(vendorId),
        fetchProjectKPI(vendorId),
        fetchEventToProjectBridge(vendorId),
      ]);
      setEventKPI(event);
      setProjectKPI(project);
      setBridge(bridgeData);
    } catch (error) {
      console.error('[VendorDashboardNew] Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [vendorId, isDemoMode, demoState]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // In demo mode, recompute when state changes
  useEffect(() => {
    if (isDemoMode && demoState) {
      fetchData();
    }
  }, [demoState?.state, isDemoMode, fetchData]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 space-y-6 relative">
      {/* AI Summary Ribbon */}
      {isDemoMode && <AISummaryRibbon />}
      {/* Dark Mode Toggle (dev/testing only) */}
      {process.env.NODE_ENV === 'development' && (
        <button
          className="fixed bottom-4 right-4 z-50 rounded-full px-3 py-1 bg-black text-white text-xs opacity-80 hover:opacity-100 shadow-lg transition"
          onClick={() => document.documentElement.classList.toggle('dark')}
          aria-label="Toggle dark mode"
        >
          Toggle Dark
        </button>
      )}
      {/* Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <KPI 
            label="Impressions" 
            value={loading ? <Skeleton className="h-8 w-20" /> : fmtInt(eventKPI?.totalRsvps ?? null)}
            id="kpi-impressions" 
            data-testid="kpi-impressions" 
          />
        </Card>
        <Card>
          <KPI 
            label="Saves" 
            value={loading ? <Skeleton className="h-8 w-20" /> : fmtInt(projectKPI?.saves ?? eventKPI?.productsSaved ?? null)}
            id="kpi-saves" 
            data-testid="kpi-saves" 
          />
        </Card>
        <Card>
          <KPI 
            label="Project Tags" 
            value={loading ? <Skeleton className="h-8 w-20" /> : fmtInt(projectKPI?.tags ?? null)}
            id="kpi-tags" 
            data-testid="kpi-tags" 
          />
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <KPI 
              label="Event → Project" 
              value={loading ? <Skeleton className="h-8 w-20" /> : fmtPct(bridge?.conversionPct ?? null)}
              id="kpi-e2p" 
              data-testid="kpi-e2p" 
            />
            {flags.vendorAIInsights && <AIBadge />}
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <TabButton 
          active={activeTab === 'events'} 
          onClick={() => setActiveTab('events')}
        >
          Events
        </TabButton>
        <TabButton 
          active={activeTab === 'projects'} 
          onClick={() => setActiveTab('projects')}
        >
          Projects & Collaborations
        </TabButton>
      </div>

      {/* Bridge (always visible, softly morphs with tab) */}
      <VendorBridge activeTab={activeTab} bridgeData={bridge} loading={loading} />

      {/* Main Panels */}
      {activeTab === 'events' ? (
        <VendorEventsTab vendorId={vendorId} />
      ) : (
        <VendorProjectsTab vendorId={vendorId} />
      )}

      {/* Reports / Exports */}
      <div className="flex flex-col md:flex-row gap-3">
        <Card className="flex-1">
          <h3 className="font-semibold mb-2 text-folio-text-primary">Standard Report</h3>
          <p className="folio-ui text-folio-text-secondary">Export your current period metrics.</p>
          <div className="mt-3">
            <button className="rounded-xl px-4 py-2 border border-folio-border-subtle hover:bg-surface-ground text-folio-text-primary transition">
              Export CSV
            </button>
          </div>
        </Card>
        <Card className="flex-1 relative">
          <div className="absolute right-4 top-4">
            {aiUnlocked && <AIBadge />}
          </div>
          <h3 className="font-semibold mb-2 text-folio-text-primary">AI Forecast Report</h3>
          <p className="folio-ui text-folio-text-secondary">
            Predictive demand, designer affinity, and budget optimization.
          </p>
          <div className="mt-3 flex items-center justify-between">
            {aiUnlocked ? (
              <>
                <span className="folio-meta text-folio-text-secondary">
                  Export the current AI forecast/QBR as a report for your internal meetings.
                </span>
                <QBRExportButton />
              </>
            ) : (
              <>
                <span className="folio-meta text-folio-text-secondary">
                  Unlock to generate AI-powered quarterly business review reports.
                </span>
                <button
                  className="rounded-xl px-4 py-2 bg-[var(--text-primary)] text-[var(--surface-canvas)] hover:opacity-90 transition text-sm"
                  data-testid="unlock-ai-button"
                  onClick={() => {
                    // TODO: Wire to upgrade/payment flow
                    console.log('[AI FORECAST] Unlock AI clicked');
                  }}
                >
                  Unlock AI
                </button>
              </>
            )}
          </div>
          {/* Inline AI Pane for Revenue/Forecast */}
          <AIInlinePane sectionId="revenue" />
        </Card>
      </div>

      {/* Demo Controls (floating panel) */}
      <DemoControls />
      </div>
    </div>
  );
}

function KPI({ 
  label, 
  value, 
  sublabel,
  id, 
  'data-testid': testId 
}: { 
  label: string; 
  value: string | React.ReactNode; 
  sublabel?: string;
  id?: string;
  'data-testid'?: string;
}) {
  return (
    <div aria-labelledby={id} data-testid={testId}>
      <div className="folio-meta text-folio-text-secondary mb-1 font-medium" id={id}>
        {label}
      </div>
      <div className="text-2xl md:text-3xl font-semibold text-folio-text-primary mb-0.5">
        {value}
      </div>
      {sublabel && (
        <div className="text-[var(--type-eyebrow)] text-folio-text-secondary">{sublabel}</div>
      )}
    </div>
  );
}

function TabButton({ 
  active, 
  onClick, 
  children 
}: { 
  active: boolean; 
  onClick(): void; 
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-4 py-2 rounded-xl border text-folio-text-primary transition',
        active
          ? 'bg-surface-canvas/50 border-folio-border-subtle shadow-md text-folio-text-primary font-medium'
          : 'bg-surface-canvas/30 border-[var(--ridge-inner)] hover:bg-surface-canvas/40 text-folio-text-primary'
      ].join(' ')}
    >
      {children}
    </button>
  );
}


"use client";

import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, Share, ExternalLink } from "lucide-react";

// Demo mode imports
import { useDemoDerived } from "@/lib/demo/demoDerived";
import { DemoControlPanel } from "@/components/vendor/demo/DemoControlPanel";
import { DemoModeIndicator } from "@/components/vendor/demo/DemoModeIndicator";
import { SavesOverTimeDemo } from "@/components/vendor/charts/SavesOverTimeDemo";
import { RoomPhaseHeatmapDemo } from "@/components/vendor/charts/RoomPhaseHeatmapDemo";
import { CompactFunnelDemo } from "@/components/vendor/charts/CompactFunnelDemo";

import { ChartCard } from "@/components/analytics/ChartCard";
import { AiBreakdown } from "@/components/analytics/AiBreakdown";
import { KpiStrip } from "@/components/analytics/KpiStrip";
import { InfluenceFlowFull } from "@/components/analytics/InfluenceFlowFull";
import { CompactFunnel } from "@/components/analytics/CompactFunnel";
import { LeakDrivers } from "@/components/analytics/LeakDrivers";
import { OpportunityQuadrant } from "@/components/analytics/OpportunityQuadrant";
import { OpportunityMini } from "@/components/analytics/OpportunityMini";
import TimeToSpecCard from "@/components/analytics/TimeToSpecCard";
import TimeToSpecFlat from "@/components/analytics/TimeToSpecFlat";
import { TimeToSpecChart } from "@/components/analytics/TimeToSpecChart";
import { RoomPhaseHeatmap } from "@/components/analytics/RoomPhaseHeatmap";
import ScaleToFit from "@/components/analytics/ScaleToFit";
import MetricsLayout from '@/components/layout/MetricsLayout';
import MetricsCard from '@/components/metrics/MetricsCard';
import KpiNumber from '@/components/metrics/KpiNumber';
import ActionPill from '@/components/metrics/ActionPill';

// Existing components
import { SavesOverTime } from "@/components/vendor/events/SavesOverTime";
import { SavesOverTimeDaily } from "@/components/analytics/SavesOverTimeDaily";
import { GeoPopularity } from "@/components/vendor/events/GeoPopularity";
import { TopDesignersTable } from "@/components/vendor/events/TopDesignersTable";
import { TopProductsPost } from "@/components/vendor/events/post/TopProductsPost";
import { BenchmarksStrip } from "@/components/vendor/events/post/BenchmarksStrip";
import { TrendMaterials } from "@/components/vendor/events/TrendMaterials";
import { InsightCard } from "@/components/vendor/events/ai/InsightCard";
import { TopClientsAggressive } from "@/components/accounts/TopClientsAggressive";
import { LowestProducts } from "@/components/products/LowestProducts";
import { BenchmarksEnhanced } from "@/components/analytics/BenchmarksEnhanced";

import { getEventPostReport } from "@/lib/mock/eventPost";
import { generateAiInsights } from "@/lib/ai/insightEngine";
import { buildModuleInsights } from "@/lib/ai/moduleInsights";
import { formatDateRange } from "@/lib/format";
import { driverDelta } from "@/lib/benchmarks/driverDelta";

interface ProAnalyticsDashboardProps {
  eventId: string;
}

export function ProAnalyticsDashboard({ eventId }: ProAnalyticsDashboardProps) {
  const report = useMemo(() => getEventPostReport(eventId), [eventId]);
  const insights = useMemo(() => generateAiInsights(report), [report]);
  const modules = useMemo(() => buildModuleInsights(report), [report]);
  const drivers = useMemo(() => driverDelta(report), [report]);
  const { demoMode } = useDemoDerived();

  // Adapt data for existing components
  const timelineData = [
    { date: report.dates.start, saves: Math.floor(report.outcome.productsSaved * 0.1) },
    { date: report.dates.end, saves: report.outcome.productsSaved }
  ];

  const geoData = report.markets.map(market => ({
    city: market.city,
    count: market.saves
  }));

  const designersData = report.firms.map(firm => ({
    id: `d-${firm.firm.toLowerCase().replace(/\s+/g, '-')}`,
    name: firm.firm,
    firm: firm.firm,
    saves: Math.floor(firm.valueUsd / 10000),
    estProjectValueUsd: firm.valueUsd
  }));

  const handleExport = () => {
    console.log('Exporting PDF...');
  };

  const handleShare = () => {
    console.log('Sharing report...');
  };

  const handleViewEvent = () => {
    window.open(`/events/${eventId}`, '_blank');
  };

  return (
    <MetricsLayout title={`Folio Metrics — ${report.name}`}>
      {/* Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight mb-2">
              {report.name}
            </h1>
            <p className="text-sm subtle">
              {formatDateRange(report.dates.start, report.dates.end)} • {report.location.city}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DemoModeIndicator />
            <ActionPill label="Export" onClick={handleExport} />
            <ActionPill label="Share" onClick={handleShare} />
            <ActionPill label="View Event" onClick={handleViewEvent} />
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <KpiStrip outcome={report.outcome} />

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-white border border-[var(--grid)]">
          <TabsTrigger value="overview" className="data-[state=active]:bg-[var(--ink)] data-[state=active]:text-white">
            Overview
          </TabsTrigger>
          <TabsTrigger value="engagement" className="data-[state=active]:bg-[var(--ink)] data-[state=active]:text-white">
            Engagement
          </TabsTrigger>
          <TabsTrigger value="markets" className="data-[state=active]:bg-[var(--ink)] data-[state=active]:text-white">
            Markets
          </TabsTrigger>
          <TabsTrigger value="accounts" className="data-[state=active]:bg-[var(--ink)] data-[state=active]:text-white">
            Accounts & Products
          </TabsTrigger>
          <TabsTrigger value="benchmarks" className="data-[state=active]:bg-[var(--ink)] data-[state=active]:text-white">
            Benchmarks
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab — Stacked Two Sections */}
        <TabsContent value="overview" className="space-y-8">
          {/* Section 1: Compact Funnel + Leak Drivers + AI */}
          <section className="grid grid-cols-12 gap-8">
            <div className="col-span-12 xl:col-span-7 space-y-4">
              {demoMode ? (
                <CompactFunnelDemo
                  data={{
                    steps: {
                      Saves: report.flowMetrics.saves,
                      Boards: report.flowMetrics.boards,
                      Tags: report.flowMetrics.tags,
                      Value: report.flowMetrics.value
                    },
                    conv: report.flowMetrics.conv,
                    cohort: {
                      savesBoards: 0.32,
                      boardsTags: 0.41,
                      tagsValue: 0.12
                    }
                  }}
                />
              ) : (
                <CompactFunnel
                  data={{
                    steps: {
                      Saves: report.flowMetrics.saves,
                      Boards: report.flowMetrics.boards,
                      Tags: report.flowMetrics.tags,
                      Value: report.flowMetrics.value
                    },
                    conv: report.flowMetrics.conv,
                    cohort: {
                      savesBoards: 0.32,
                      boardsTags: 0.41,
                      tagsValue: 0.12
                    },
                    fixes: {
                      savesBoards: { label: "Share moodboards", estLiftPts: 12 },
                      boardsTags: { label: "Add spec pack", estLiftPts: 9 },
                      tagsValue: { label: "Run 3-5% close", estLiftPts: 6 }
                    }
                  }}
                  onFix={(transition) => console.log('Queue action:', transition)}
                />
              )}
              
              <LeakDrivers drivers={report.leakDrivers} />
              
              {/* Expandable full flow */}
              <details className="chart-card">
                <summary className="px-4 py-3 cursor-pointer text-sm text-[#1F2937] font-medium hover:bg-[var(--grid)]/20 rounded transition-colors">
                  Expand full flow chart
                </summary>
                <div className="p-4 border-t border-[var(--grid)]">
                  <InfluenceFlowFull 
                    nodes={report.sankeyFlow.nodes} 
                    links={report.sankeyFlow.links} 
                  />
                </div>
              </details>
            </div>
            <div className="col-span-12 xl:col-span-5">
              <AiBreakdown 
                what="Flow analysis shows conversion patterns"
                why="Understanding where users drop off helps optimize the funnel"
                next={["Add CAD tab prominence", "Auto-suggest similar SKUs", "Surface designer quotes"]}
              />
            </div>
          </section>

          {/* Section 2: Time-to-Spec + Opportunity (stacked) + ONE AI panel */}
          <section className="grid grid-cols-12 gap-8">
            <div className="col-span-12 xl:col-span-7 space-y-6">
              <TimeToSpecFlat data={report.timeToSpec} />
              <OpportunityMini opportunities={report.opportunities} />
            </div>
            <div className="col-span-12 xl:col-span-5">
              <AiBreakdown 
                what="Opportunity analysis reveals high-value segments"
                why="Targeting the right segments maximizes ROI and engagement"
                next={["VIP dinner invites", "Boost their posts", "Capsule collaboration"]}
              />
            </div>
          </section>

          {/* Top AI Insights */}
          <div>
            <h3 className="text-lg font-semibold text-[var(--ink)] mb-4">
              Top AI Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {insights.slice(0, 6).map(insight => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="space-y-6">
          <MetricsCard
            title="Room × Phase Heatmap"
            tone="opp"
            right={<ActionPill label="Export heatmap" onClick={()=>{}}/>}
            footer="Conversion patterns across design workflows"
          >
            <ScaleToFit minHeight={360} maxHeight={600} padX={0} padY={0}>
              {demoMode ? (
                <RoomPhaseHeatmapDemo 
                  matrix={report.roomPhase} 
                  rooms={['Kitchen', 'Bath', 'Outdoor', 'Living']} 
                  phases={['Concept', 'Schematic', 'FF&E', 'Procurement']} 
                />
              ) : (
                <RoomPhaseHeatmap data={report.roomPhase} />
              )}
            </ScaleToFit>
            <AiBreakdown 
              what="Room-phase analysis shows conversion patterns"
              why="Different design workflows have varying engagement levels"
              next={["Spin up regional editorial", "Targeted showroom invites", "Bundle sample kits"]}
            />
          </MetricsCard>

          <MetricsCard
            title="Saves Over Time"
            tone="perf"
            right={<ActionPill label="Pin hero SKUs 14d" onClick={()=>{}}/>}
            footer="Daily engagement with spike annotations"
          >
            <ScaleToFit minHeight={300} maxHeight={520} padX={0} padY={0}>
              {demoMode ? (
                <SavesOverTimeDemo 
                  data={[
                    { date: '2024-01-15', saves: 45, tags: 23, savesCum: 45 },
                    { date: '2024-01-16', saves: 67, tags: 34, savesCum: 112 },
                    { date: '2024-01-17', saves: 89, tags: 45, savesCum: 201 },
                    { date: '2024-01-18', saves: 123, tags: 67, savesCum: 324 },
                    { date: '2024-01-19', saves: 98, tags: 56, savesCum: 422 },
                    { date: '2024-01-20', saves: 156, tags: 89, savesCum: 578 },
                    { date: '2024-01-21', saves: 134, tags: 78, savesCum: 712 }
                  ]}
                />
              ) : (
                <SavesOverTimeDaily 
                  eventDates={report.dates}
                  totalSaves={report.outcome.productsSaved}
                  totalTags={report.outcome.tags}
                />
              )}
            </ScaleToFit>
            <AiBreakdown 
              what="Timeline analysis reveals engagement patterns"
              why="Understanding peak activity helps optimize content timing"
              next={["Schedule post-event email", "Pin hero SKUs for 14 days", "Retarget abandoners"]}
            />
          </MetricsCard>

          <MetricsCard
            title="Trend Materials"
            tone="opp"
            right={<ActionPill label="Feature materials" onClick={()=>{}}/>}
            footer="Most popular materials and finishes"
          >
            <div className="col-span-7">
              <TrendMaterials materials={[]} />
            </div>
            <AiBreakdown 
              what="Material trends show designer preferences"
              why="Popular materials indicate market direction and opportunities"
              next={["Feature trending materials", "Create material showcases", "Partner with top brands"]}
            />
          </MetricsCard>
        </TabsContent>

        {/* Markets Tab */}
        <TabsContent value="markets" className="space-y-6">
          <MetricsCard
            title="Geographic Distribution"
            tone="opp"
            right={<ActionPill label="Localize content" onClick={()=>{}}/>}
            footer="Market presence and growth opportunities"
          >
            <div className="col-span-7">
              <GeoPopularity data={geoData} />
            </div>
            <AiBreakdown 
              what="Geographic analysis shows market presence"
              why="Understanding regional engagement helps target growth opportunities"
              next={["Expand in high-engagement regions", "Localize content", "Partner with regional vendors"]}
            />
          </MetricsCard>
        </TabsContent>

        {/* Accounts & Products Tab */}
        <TabsContent value="accounts" className="space-y-6">
          <ChartCard
            title="Top Clients — Aggressive Plays"
            subtitle="High-value accounts with causal WHY and expected lift"
          >
            <TopClientsAggressive firms={report.firms} />
            <AiBreakdown 
              what="Designer analysis reveals key influencers"
              why="Top designers drive significant engagement and conversions"
              next={["DM top designers", "Create exclusive content", "Offer early access"]}
            />
          </ChartCard>

          <ChartCard
            title="Product Performance"
            subtitle="Top products by save-to-tag conversion"
          >
            <div className="col-span-7">
              <TopProductsPost products={report.products} />
            </div>
            <AiBreakdown 
              what="Product analysis shows conversion performance"
              why="Top-performing products indicate market preferences"
              next={["Feature top products", "Bundle related items", "Create product stories"]}
            />
          </ChartCard>

          <ChartCard
            title="Lowest Converting Products"
            subtitle="Fix conversion gaps with targeted actions"
          >
            <LowestProducts products={report.productFunnels || report.products} />
            <AiBreakdown 
              what="Low-converting products need optimization"
              why="Improving underperforming products can boost overall conversion"
              next={["Improve product images", "Add detailed specs", "Create usage examples"]}
            />
          </ChartCard>
        </TabsContent>

        {/* Benchmarks Tab */}
        <TabsContent value="benchmarks" className="space-y-6">
          <ChartCard
            title="Performance Benchmarks"
            subtitle="Visual gaps + what drove each delta"
          >
            <BenchmarksEnhanced 
              benchmarks={report.benchmarks}
              drivers={drivers}
            />
            <AiBreakdown 
              what="Benchmark analysis shows performance gaps"
              why="Comparing against industry standards reveals improvement opportunities"
              next={["Document winning tactics", "Share case studies", "Scale successful patterns"]}
            />
          </ChartCard>
        </TabsContent>
      </Tabs>

      {/* Demo Control Panel */}
      <DemoControlPanel />
    </MetricsLayout>
  );
}

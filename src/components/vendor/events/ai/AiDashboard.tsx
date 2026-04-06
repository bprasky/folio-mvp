'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Share, ExternalLink, Calendar, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { getEventPostReport } from "@/lib/mock/eventPost";
import { formatDateRange } from "@/lib/format";
import { generateAiInsights } from "@/lib/ai/insightEngine";

// AI-first components
import { ExecutiveSummary } from "./ExecutiveSummary";
import { InsightCard } from "./InsightCard";
import { CohortMini } from "./CohortMini";
import { TopFirmsPills } from "./TopFirmsPills";
import { ExportButton } from "./ExportButton";
import { InfluenceFlow } from "@/components/vendor/events/post/InfluenceFlow";
import { OpportunityMap } from "@/components/vendor/events/post/OpportunityMap";
import { TimeToSpec } from "@/components/vendor/events/post/TimeToSpec";
import { AnalyticsDrawer } from "./AnalyticsDrawer";
import { useAnalyticsDrawer } from "./useAnalyticsDrawer";
import type { AiInsight } from "@/lib/ai/types";

interface AiDashboardProps {
  eventId: string;
  onExport?: () => void;
  onShare?: () => void;
  onViewEvent?: () => void;
}

export function AiDashboard({ eventId, onExport, onShare, onViewEvent }: AiDashboardProps) {
  const report = useMemo(() => getEventPostReport(eventId), [eventId]);
  const [showMoreInsights, setShowMoreInsights] = useState(false);
  const { openDrawer } = useAnalyticsDrawer();
  
  const insights = useMemo(() => {
    const generatedInsights = generateAiInsights(report);
    // Update the report with generated insights for consistency
    (report as any).aiInsights = generatedInsights;
    return generatedInsights;
  }, [report]);
  const visibleInsights = showMoreInsights ? insights : insights.slice(0, 5);

  const handleInsightAction = useCallback((insight: AiInsight) => {
    console.log('Executing insight action:', insight.action);
    // In real app, this would trigger the appropriate playbook or action
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card className="bg-white border-folio-border-strong">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-serif text-folio-text-primary mb-2">
                {report.name}
              </h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm text-folio-text-secondary">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDateRange(report.dates.start, report.dates.end)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4" />
                  <span>{report.location.city}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <ExportButton />
              <Button 
                variant="outline" 
                size="sm"
                onClick={onShare}
                className="border-folio-border-strong"
              >
                <Share className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button 
                size="sm"
                onClick={onViewEvent}
                className="bg-[#2B2B2B] hover:bg-[#8C8278] text-white"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Event
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Executive Summary */}
      <ExecutiveSummary outcome={report.outcome} />
      
      {/* Cohort Benchmarks mini */}
      <CohortMini data={report.benchmarksMini} />

      {/* Three Key Visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Influence Flow (mini) */}
        <div className="lg:col-span-2">
          <Card className="bg-white border-folio-border-strong hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-folio-text-primary mb-1">
                  Conversion Funnel
                </h3>
                <p className="text-xs text-folio-text-secondary leading-relaxed">
                  How designer attention flows from initial engagement to project decisions
                </p>
              </div>
              
              <div className="relative">
                <div className="scale-90 origin-top-left">
                  <InfluenceFlow 
                    nodes={report.sankeyFlow.nodes} 
                    links={report.sankeyFlow.links} 
                    variant="bars"
                  />
                </div>
                
                {/* Flow explanation overlay */}
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm border border-folio-border-strong rounded-lg p-3 text-xs max-w-[200px]">
                  <div className="font-medium text-folio-text-primary mb-1">What you're seeing:</div>
                  <div className="text-folio-text-secondary leading-relaxed">
                    Wider bars = higher engagement. Follow the flow to identify where attention leaks or converts.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Time-to-Spec mini */}
        <div className="lg:col-span-1">
          <Card className="bg-white border-folio-border-strong hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-folio-text-primary mb-1">
                  Response Timing
                </h3>
                <p className="text-xs text-folio-text-secondary leading-relaxed">
                  When designers are most likely to engage with follow-ups
                </p>
              </div>
              
              <div className="space-y-5">
                <div className="text-center p-4 bg-surface-elevated rounded-lg">
                  <div className="text-3xl font-bold text-folio-text-primary mb-1">
                    {report.timeToSpec.medianHours}h
                  </div>
                  <div className="text-xs text-folio-text-secondary mb-2">Median response time</div>
                  <div className="text-xs text-folio-text-secondary">
                    {report.timeToSpec.medianHours < 24 
                      ? "🔥 Fast responders - strike while hot!" 
                      : report.timeToSpec.medianHours < 72 
                      ? "⚡ Good engagement velocity"
                      : "⏰ Slower response - needs warming"
                    }
                  </div>
                </div>
                
                <div>
                  <div className="text-xs font-medium text-folio-text-secondary mb-3">Optimal contact windows:</div>
                  <div className="space-y-2">
                    {report.timeToSpec.bestHours.map((window, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-white border border-folio-border-strong rounded">
                        <div className="text-sm font-medium text-folio-text-primary capitalize">{window.dow}</div>
                        <div className="text-sm text-folio-text-secondary">{String(window.hour).padStart(2, '0')}:00</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Opportunity Quadrant (2×2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <OpportunityMap opportunities={report.opportunities} />
        </div>
      </div>

      {/* Top Firms Pills */}
      <section className="mt-6">
        <TopFirmsPills firms={report.topFirmsMini} />
      </section>

      {/* AI Insight Cards */}
      <div className="mt-8">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xl font-serif text-folio-text-primary">
                AI-Powered Action Plan
              </h2>
              <p className="text-sm text-folio-text-secondary mt-1">
                Data-driven recommendations with expected impact and urgency indicators
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-folio-text-secondary">Total expected lift</div>
              <div className="text-lg font-bold text-folio-text-primary">
                ${(insights.reduce((sum, i) => sum + i.impact.expectedLiftUsd, 0) / 1000).toFixed(0)}k
              </div>
            </div>
          </div>
          {insights.length > 5 && (
            <div className="flex justify-center mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMoreInsights(!showMoreInsights)}
                className="text-folio-text-secondary"
              >
                {showMoreInsights ? (
                  <>
                    Show less <ChevronUp className="w-4 h-4 ml-1" />
                  </>
                ) : (
                  <>
                    Show more insights ({insights.length - 5}) <ChevronDown className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleInsights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
            />
          ))}
        </div>
      </div>

      {/* More Analytics Button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          onClick={() => openDrawer({ section: 'roomPhase' })}
          className="border-folio-border-strong text-folio-text-secondary"
        >
          More Analytics
        </Button>
      </div>

      {/* Analytics Drawer */}
      <AnalyticsDrawer data={report} />
    </div>
  );
}

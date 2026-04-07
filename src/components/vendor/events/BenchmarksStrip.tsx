'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, MapPin } from "lucide-react";
import { Benchmarks, EventSummary } from "@/lib/mock/eventsPortfolio";

interface BenchmarksStripProps {
  benchmarks: Benchmarks;
  events: EventSummary[];
}

export function BenchmarksStrip({ benchmarks, events }: BenchmarksStripProps) {
  const bestEvent = events.find(e => e.id === benchmarks.bestEventId);
  const mostImprovedEvent = events.find(e => e.id === benchmarks.mostImprovedId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Best Performing Event */}
      <Card className="bg-surface-canvas border-folio-border-strong">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Trophy className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-folio-text-primary mb-1">
                Best Performing Event
              </h4>
              <p className="text-sm font-semibold text-folio-text-primary truncate">
                {bestEvent?.name || 'N/A'}
              </p>
              <p className="text-xs text-folio-text-secondary">
                {bestEvent ? `${bestEvent.saves} saves` : 'No data'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Most Improved Event */}
      <Card className="bg-surface-canvas border-folio-border-strong">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-folio-text-primary mb-1">
                Most Improved Event
              </h4>
              <p className="text-sm font-semibold text-folio-text-primary truncate">
                {mostImprovedEvent?.name || 'N/A'}
              </p>
              <p className="text-xs text-folio-text-secondary">
                {mostImprovedEvent ? `+18% vs. last period` : 'No data'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Market */}
      <Card className="bg-surface-canvas border-folio-border-strong">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-[var(--accent)]/10 rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-folio-text-primary mb-1">
                Top Market by Saves
              </h4>
              <p className="text-sm font-semibold text-folio-text-primary truncate">
                {benchmarks.topMarket.city}
              </p>
              <Badge className="text-xs bg-[#8C8278]/10 text-folio-text-secondary border-[#8C8278]/20">
                {benchmarks.topMarket.sharePct}% share
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}










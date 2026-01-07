"use client";

import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp } from "lucide-react";
import type { TimeToSpecDist } from "@/lib/mock/eventPost";

interface TimeToSpecChartProps {
  data: TimeToSpecDist;
}

export function TimeToSpecChart({ data }: TimeToSpecChartProps) {
  const isUrgent = data.medianHours < 24;
  const maxBinCount = Math.max(...data.bins.map(b => b.count));

  return (
    <div className="col-span-7 space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 bg-[var(--grid)]/30 rounded-lg">
          <div className="text-3xl font-bold h-kpi h-num text-[var(--ink)]">
            {data.medianHours}h
          </div>
          <div className="text-xs text-[var(--slate)] mt-1">Median Response</div>
          {isUrgent && (
            <Badge className="mt-2 bg-[var(--rose)]/10 text-[var(--rose)] border-[var(--rose)]/20">
              🔥 Fast responders
            </Badge>
          )}
        </div>

        <div className="text-center p-4 bg-[var(--grid)]/30 rounded-lg">
          <div className="text-3xl font-bold h-kpi h-num text-[var(--ink)]">
            {data.p90Hours}h
          </div>
          <div className="text-xs text-[var(--slate)] mt-1">90th Percentile</div>
        </div>

        <div className="text-center p-4 bg-[var(--teal)]/10 rounded-lg border border-[var(--teal)]/20">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-[var(--teal)]" />
            <span className="text-xs font-semibold text-[var(--teal)]">Best Windows</span>
          </div>
          {data.bestHours.slice(0, 2).map((window, index) => (
            <div key={index} className="text-sm font-medium text-[var(--ink)]">
              {window.dow} {String(window.hour).padStart(2, '0')}:00
            </div>
          ))}
        </div>
      </div>

      {/* Distribution Bars */}
      <div>
        <div className="text-sm font-semibold text-[var(--ink)] mb-3">
          Response Time Distribution
        </div>
        <div className="space-y-2">
          {data.bins.map((bin, index) => {
            const widthPct = (bin.count / maxBinCount) * 100;
            const isNow = bin.bucket.includes('0-') || bin.bucket.includes('< ');
            
            return (
              <div key={index} className="flex items-center gap-3">
                <div className="w-20 text-xs text-[var(--slate)] text-right">
                  {bin.bucket}
                </div>
                <div className="flex-1 relative h-8 bg-[var(--grid)] rounded overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                      isNow ? 'bg-[var(--teal)]' : 'bg-[var(--ink)]'
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-3">
                    <span className="text-xs font-medium text-white mix-blend-difference">
                      {bin.count} designers
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insight */}
      <div className="flex items-start gap-3 p-4 bg-[var(--emerald)]/5 border-l-2 border-[var(--emerald)] rounded-r-lg">
        <TrendingUp className="w-5 h-5 text-[var(--emerald)] mt-0.5 flex-shrink-0" />
        <div>
          <div className="text-sm font-medium text-[var(--ink)] mb-1">
            Timing Strategy
          </div>
          <p className="text-xs text-[var(--slate)] leading-relaxed">
            {isUrgent 
              ? "Fast response times indicate hot leads. Schedule immediate follow-ups within 12-24h to maximize conversion."
              : "Standard response pattern. Follow up within 48-72h during peak engagement windows for best results."
            }
          </p>
        </div>
      </div>
    </div>
  );
}









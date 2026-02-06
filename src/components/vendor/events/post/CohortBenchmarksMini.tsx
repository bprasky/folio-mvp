'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import type { CohortBenchmarks } from "@/lib/mock/eventPost";

interface CohortBenchmarksMiniProps {
  benchmarks: CohortBenchmarks;
}

export function CohortBenchmarksMini({ benchmarks }: CohortBenchmarksMiniProps) {
  const getComparisonColor = (you: number, baseline: number) => {
    if (you > baseline) return 'text-green-600';
    if (you < baseline) return 'text-red-600';
    return 'text-[var(--text-secondary)]';
  };

  const getComparisonIcon = (you: number, baseline: number) => {
    if (you > baseline) return <TrendingUp className="w-3 h-3" />;
    if (you < baseline) return <TrendingDown className="w-3 h-3" />;
    return null;
  };

  const formatValue = (value: number, type: 'percentage' | 'currency') => {
    if (type === 'percentage') {
      return `${value.toFixed(1)}%`;
    }
    return `$${value.toFixed(1)}M`;
  };

  const barWidth = 80; // Fixed width for bars

  const renderComparison = (
    label: string,
    you: number,
    prev3: number,
    cohort: number,
    type: 'percentage' | 'currency',
    unit?: string
  ) => {
    const maxValue = Math.max(you, prev3, cohort);
    const youWidth = (you / maxValue) * barWidth;
    const prev3Width = (prev3 / maxValue) * barWidth;
    const cohortWidth = (cohort / maxValue) * barWidth;

    return (
      <div className="space-y-3">
        <div className="text-sm font-medium text-[#2B2B2B]">
          {label}
        </div>
        
        <div className="space-y-2">
          {/* You */}
          <div className="flex items-center space-x-3">
            <div className="w-16 text-xs text-[#8C8278]">You</div>
            <div className="flex-1 flex items-center space-x-2">
              <div className="bg-[#F7F4F1] rounded-full h-3 relative overflow-hidden" style={{ width: barWidth + 40 }}>
                <div 
                  className="h-3 rounded-full bg-[#8C8278] transition-all duration-500"
                  style={{ width: `${youWidth}px` }}
                />
              </div>
              <div className={`text-xs font-medium flex items-center space-x-1 ${getComparisonColor(you, Math.max(prev3, cohort))}`}>
                {formatValue(you, type)}
                {getComparisonIcon(you, Math.max(prev3, cohort))}
              </div>
            </div>
          </div>

          {/* Prev 3 */}
          <div className="flex items-center space-x-3">
            <div className="w-16 text-xs text-[#8C8278]">Prev 3</div>
            <div className="flex-1 flex items-center space-x-2">
              <div className="bg-[#F7F4F1] rounded-full h-3 relative overflow-hidden" style={{ width: barWidth + 40 }}>
                <div 
                  className="h-3 rounded-full bg-[#8C8278]/60 transition-all duration-500"
                  style={{ width: `${prev3Width}px` }}
                />
              </div>
              <div className="text-xs text-[#8C8278]">
                {formatValue(prev3, type)}
              </div>
            </div>
          </div>

          {/* Cohort */}
          <div className="flex items-center space-x-3">
            <div className="w-16 text-xs text-[#8C8278]">Cohort</div>
            <div className="flex-1 flex items-center space-x-2">
              <div className="bg-[#F7F4F1] rounded-full h-3 relative overflow-hidden" style={{ width: barWidth + 40 }}>
                <div 
                  className="h-3 rounded-full bg-[#DAD2CA] transition-all duration-500"
                  style={{ width: `${cohortWidth}px` }}
                />
              </div>
              <div className="text-xs text-[#8C8278]">
                {formatValue(cohort, type)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-white border-[#DAD2CA]">
      <CardHeader>
        <CardTitle className="text-lg font-serif text-[#2B2B2B] flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-[#8C8278]" />
          <span>Performance in context</span>
        </CardTitle>
        <p className="text-sm text-[#8C8278]">
          You vs previous 3 events vs vendor cohort median
        </p>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderComparison(
            'Save → Tag Rate',
            benchmarks.saveToTag.you,
            benchmarks.saveToTag.prev3,
            benchmarks.saveToTag.cohort,
            'percentage'
          )}
          
          {benchmarks.tagToSpec && renderComparison(
            'Tag → Spec Rate',
            benchmarks.tagToSpec.you,
            benchmarks.tagToSpec.prev3,
            benchmarks.tagToSpec.cohort,
            'percentage'
          )}
          
          {renderComparison(
            'Est. Value',
            benchmarks.value.you,
            benchmarks.value.prev3,
            benchmarks.value.cohort,
            'currency'
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-[#DAD2CA]">
          <div className="flex items-center justify-between">
            <div className="text-xs text-[#8C8278]">
              Legend: You • Previous 3 Events • Vendor Cohort
            </div>
            <Badge variant="secondary" className="text-xs">
              Updated post-event
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}










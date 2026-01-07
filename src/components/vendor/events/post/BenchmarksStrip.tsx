'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Target, Users } from "lucide-react";
import type { Benchmarks } from "@/lib/mock/eventPost";
import { formatPercentage } from "@/lib/format";

interface BenchmarksStripProps {
  benchmarks: Benchmarks;
}

export function BenchmarksStrip({ benchmarks }: BenchmarksStripProps) {
  const vsPriorItems = [
    {
      label: "Saves",
      value: benchmarks.vsPrior.savesPct,
      icon: TrendingUp
    },
    {
      label: "Save→Tag Rate",
      value: benchmarks.vsPrior.saveToTagPct,
      icon: Target
    },
    {
      label: "Pipeline Value",
      value: benchmarks.vsPrior.valuePct,
      icon: TrendingUp
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* vs Prior Event */}
      <Card className="bg-white border-[#DAD2CA]">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3 mb-4">
            <TrendingUp className="w-5 h-5 text-[#8C8278]" />
            <h3 className="font-medium text-[#2B2B2B]">vs Prior Event</h3>
          </div>
          
          <div className="space-y-3">
            {vsPriorItems.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <item.icon className="w-4 h-4 text-[#8C8278]" />
                  <span className="text-sm text-[#2B2B2B]">{item.label}</span>
                </div>
                <Badge className={`text-xs ${
                  item.value >= 0 
                    ? 'bg-green-100 text-green-800 border-green-200' 
                    : 'bg-red-100 text-red-800 border-red-200'
                }`}>
                  {item.value >= 0 ? (
                    <TrendingUp className="w-3 h-3 mr-1" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-1" />
                  )}
                  {item.value >= 0 ? '+' : ''}{item.value.toFixed(1)}%
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* vs Vendor Cohort */}
      <Card className="bg-white border-[#DAD2CA]">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3 mb-4">
            <Users className="w-5 h-5 text-[#8C8278]" />
            <h3 className="font-medium text-[#2B2B2B]">vs Vendor Cohort</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#2B2B2B]">Save→Tag Rate</span>
              <Badge className={`text-xs ${
                benchmarks.vsCohort.percentileSaveToTag >= 70
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : benchmarks.vsCohort.percentileSaveToTag >= 40
                  ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                  : 'bg-red-100 text-red-800 border-red-200'
              }`}>
                {benchmarks.vsCohort.percentileSaveToTag}th percentile
              </Badge>
            </div>
            
            <div className="bg-[#F7F4F1] rounded-lg p-3">
              <p className="text-sm text-[#2B2B2B] font-medium mb-1">
                Performance Note
              </p>
              <p className="text-xs text-[#8C8278]">
                {benchmarks.vsCohort.note}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}










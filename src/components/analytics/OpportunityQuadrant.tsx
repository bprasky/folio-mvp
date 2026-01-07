"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { OpportunityPoint } from "@/lib/mock/eventPost";
import { formatCurrency } from "@/lib/format";

interface OpportunityQuadrantProps {
  opportunities: OpportunityPoint[];
  onSelect?: (opportunity: OpportunityPoint) => void;
}

export function OpportunityQuadrant({ opportunities, onSelect }: OpportunityQuadrantProps) {
  const [mode, setMode] = useState<'market' | 'room'>('market');

  // Calculate median values for quadrant boundaries
  const medianPotential = opportunities.length > 0
    ? opportunities.reduce((sum, o) => sum + o.potentialUsd, 0) / opportunities.length
    : 0;
  const medianShare = opportunities.length > 0
    ? opportunities.reduce((sum, o) => sum + o.sharePct, 0) / opportunities.length
    : 0;

  // Group opportunities by quadrant
  const quadrants = {
    underserved: opportunities.filter(o => o.potentialUsd > medianPotential && o.sharePct < medianShare),
    build: opportunities.filter(o => o.potentialUsd > medianPotential && o.sharePct >= medianShare),
    watch: opportunities.filter(o => o.potentialUsd <= medianPotential && o.sharePct < medianShare),
    maintain: opportunities.filter(o => o.potentialUsd <= medianPotential && o.sharePct >= medianShare)
  };

  const QuadrantBox = ({ 
    title, 
    items, 
    bgColor 
  }: { 
    title: string; 
    items: OpportunityPoint[]; 
    bgColor: string;
  }) => (
    <div className={`${bgColor} border border-[var(--grid)] rounded-lg p-4 min-h-[200px]`}>
      <div className="text-sm font-semibold text-[var(--ink)] mb-3">
        {title}
      </div>
      <div className="space-y-2">
        {items.slice(0, 3).map((item, index) => (
          <button
            key={index}
            onClick={() => onSelect?.(item)}
            className="w-full text-left p-2 bg-white/80 hover:bg-white rounded-lg border border-[var(--grid)] hover:border-[var(--teal)] transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-[var(--ink)]">
                {item.name}
              </span>
              <Badge variant="secondary" className="text-xs">
                {item.sharePct.toFixed(0)}%
              </Badge>
            </div>
            <div className="text-xs text-[var(--slate)]">
              {formatCurrency(item.potentialUsd, 'USD', true)} potential
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="col-span-7 space-y-4">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={mode === 'market' ? 'default' : 'outline'}
            onClick={() => setMode('market')}
            className={mode === 'market' ? 'bg-[var(--ink)]' : ''}
          >
            By Market
          </Button>
          <Button
            size="sm"
            variant={mode === 'room' ? 'default' : 'outline'}
            onClick={() => setMode('room')}
            className={mode === 'room' ? 'bg-[var(--ink)]' : ''}
          >
            By Room
          </Button>
        </div>
        
        <div className="text-xs text-[var(--slate)]">
          Click any item to filter insights
        </div>
      </div>

      {/* 2×2 Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top Left: High Potential, Low Share */}
        <QuadrantBox
          title="🎯 Most Underserved"
          items={quadrants.underserved}
          bgColor="bg-[var(--rose)]/5"
        />

        {/* Top Right: High Potential, High Share */}
        <QuadrantBox
          title="🚀 Build"
          items={quadrants.build}
          bgColor="bg-[var(--emerald)]/5"
        />

        {/* Bottom Left: Low Potential, Low Share */}
        <QuadrantBox
          title="👀 Watch"
          items={quadrants.watch}
          bgColor="bg-[var(--slate)]/5"
        />

        {/* Bottom Right: Low Potential, High Share */}
        <QuadrantBox
          title="✅ Maintain"
          items={quadrants.maintain}
          bgColor="bg-[var(--teal)]/5"
        />
      </div>

      {/* Axes labels */}
      <div className="grid grid-cols-2 gap-4 text-xs text-[var(--slate)]">
        <div className="flex items-center justify-between">
          <span>← Lower Potential</span>
          <span>Higher Potential →</span>
        </div>
        <div></div>
      </div>
    </div>
  );
}









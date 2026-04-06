'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, Target, TrendingUp, ArrowRight, AlertTriangle } from "lucide-react";
import type { PlayItem } from "@/lib/mock/eventPost";
import { getPlayItemScore } from "@/lib/modeling";
import { formatCurrency } from "@/lib/format";

interface PlaybookImpactPlannerProps {
  playItems: PlayItem[];
  onActionClick?: (item: PlayItem) => void;
}

export function PlaybookImpactPlanner({ playItems, onActionClick }: PlaybookImpactPlannerProps) {
  const [selectedItem, setSelectedItem] = useState<PlayItem | null>(null);

  // Rank by efficiency score
  const rankedItems = useMemo(() => {
    return [...playItems].sort((a, b) => getPlayItemScore(b) - getPlayItemScore(a));
  }, [playItems]);

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'High': return 'bg-green-100 text-green-800 border-green-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Test': return 'bg-[var(--accent)]/10 text-blue-800 border-[var(--accent)]/20';
      default: return 'bg-surface-ground text-folio-text-primary border-folio-border-subtle';
    }
  };

  const getGuardrailNote = (item: PlayItem) => {
    if (item.guardrails?.inventory === 'tight' && item.actionType === 'promo') {
      return 'Inventory tight — recommend specs/samples over promo';
    }
    if (item.guardrails?.margin === 'low' && item.actionType === 'promo') {
      return 'Low margin — consider spec pack instead';
    }
    return null;
  };

  return (
    <div className="sticky top-4 space-y-4">
      <Card className="bg-white border-folio-border-strong">
        <CardHeader>
          <CardTitle className="text-lg font-serif text-folio-text-primary flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-folio-text-secondary" />
            <span>Highest return actions this week</span>
          </CardTitle>
          <p className="text-sm text-folio-text-secondary">
            Ranked by expected lift vs effort, with decay urgency
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {rankedItems.map((item, index) => {
            const guardrailNote = getGuardrailNote(item);
            const score = getPlayItemScore(item);
            
            return (
              <div 
                key={item.id}
                className={`border border-folio-border-strong rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                  selectedItem?.id === item.id ? 'ring-2 ring-[#8C8278]' : ''
                }`}
                onClick={() => {
                  setSelectedItem(item);
                  onActionClick?.(item);
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-medium text-folio-text-primary text-sm">
                        {item.title}
                      </h4>
                      {index === 0 && (
                        <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                          Top Pick
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs text-folio-text-secondary mb-2">
                      <div className="flex items-center space-x-1">
                        <Target className="w-3 h-3" />
                        <span>{item.target.key} ({item.target.count})</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{item.effortHrs}h effort</span>
                      </div>
                    </div>
                  </div>
                  
                  <ArrowRight className="w-4 h-4 text-folio-text-secondary flex-shrink-0" />
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="text-lg font-semibold text-green-600">
                      {formatCurrency(item.expectedLiftUsd, 'USD', true)}
                    </div>
                    <Badge className={`text-xs ${getConfidenceColor(item.confidence)}`}>
                      {item.confidence}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="text-xs text-folio-text-secondary">
                      -{item.decayPctByDay}%/day
                    </div>
                  </div>
                </div>

                {guardrailNote && (
                  <div className="flex items-center space-x-1 text-xs text-amber-600 mb-2">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{guardrailNote}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <div className="text-xs text-folio-text-secondary">
                    ROI Score: {score.toFixed(1)}
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onActionClick?.(item);
                    }}
                  >
                    Execute
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}










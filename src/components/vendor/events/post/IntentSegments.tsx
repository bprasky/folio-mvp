'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Users, TrendingUp, Clock, ArrowRight } from "lucide-react";
import type { IntentSegments, IntentDesigner } from "@/lib/mock/eventPost";
import { formatCurrency } from "@/lib/format";
import { PlaybookSheet } from "./PlaybookSheet";

interface IntentSegmentsProps {
  segments: IntentSegments;
}

export function IntentSegments({ segments }: IntentSegmentsProps) {
  const [activeSheet, setActiveSheet] = useState<{
    type: 'close' | 'sample' | 'moodboard';
    designers: IntentDesigner[];
  } | null>(null);

  const segmentConfig = [
    {
      key: 'readyToClose' as const,
      title: 'Ready to Close',
      description: 'High-intent designers ready for closing incentives',
      icon: TrendingUp,
      action: 'Close Offer 5%',
      color: 'bg-red-100 text-red-800 border-red-200',
      designers: segments.readyToClose
    },
    {
      key: 'warmEvaluators' as const,
      title: 'Warm Evaluators', 
      description: 'Warm prospects evaluating specifications',
      icon: Users,
      action: 'Send Sample Kit',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      designers: segments.warmEvaluators
    },
    {
      key: 'earlyExplorers' as const,
      title: 'Early Explorers',
      description: 'Early-stage designers exploring concepts',
      icon: Clock,
      action: 'Share Moodboard Images',
      color: 'bg-[var(--accent)]/10 text-blue-800 border-[var(--accent)]/20',
      designers: segments.earlyExplorers
    }
  ];

  const handleSegmentAction = (type: 'close' | 'sample' | 'moodboard', designers: IntentDesigner[]) => {
    setActiveSheet({ type, designers });
  };

  const getSheetType = (action: string): 'close' | 'sample' | 'moodboard' => {
    if (action.includes('Close')) return 'close';
    if (action.includes('Sample')) return 'sample';
    return 'moodboard';
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {segmentConfig.map((segment) => (
          <Card key={segment.key} className="bg-white border-[#DAD2CA] hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full ${segment.color.replace('text-', 'bg-').replace('border-', '').replace('-800', '-100')} flex items-center justify-center`}>
                    <segment.icon className={`w-5 h-5 ${segment.color.includes('red') ? 'text-red-600' : segment.color.includes('yellow') ? 'text-yellow-600' : 'text-[var(--accent)]'}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-serif text-[#2B2B2B]">
                      {segment.title}
                    </CardTitle>
                    <p className="text-sm text-[#8C8278]">
                      {segment.designers.length} designers
                    </p>
                  </div>
                </div>
                <Badge className={segment.color}>
                  {segment.action}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-[#8C8278]">
                {segment.description}
              </p>

              {segment.designers.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-[#2B2B2B] uppercase tracking-wide">
                      Top Designers
                    </p>
                    {segment.designers.slice(0, 3).map((designer) => (
                      <div key={designer.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#2B2B2B]">
                            {designer.name}
                          </p>
                          <p className="text-xs text-[#8C8278]">
                            {designer.firm}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium text-[#2B2B2B]">
                            {formatCurrency(designer.valueEstimateUsd, 'USD', true)}
                          </p>
                          <p className="text-xs text-[#8C8278]">
                            Score: {designer.intentScore}
                          </p>
                        </div>
                      </div>
                    ))}
                    {segment.designers.length > 3 && (
                      <p className="text-xs text-[#8C8278]">
                        +{segment.designers.length - 3} more designers
                      </p>
                    )}
                  </div>
                </>
              )}

              <Button
                className="w-full bg-[#2B2B2B] hover:bg-[#8C8278] text-white"
                onClick={() => handleSegmentAction(getSheetType(segment.action), segment.designers)}
                disabled={segment.designers.length === 0}
              >
                {segment.action}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Playbook Sheet */}
      <PlaybookSheet
        isOpen={!!activeSheet}
        onClose={() => setActiveSheet(null)}
        type={activeSheet?.type}
        designers={activeSheet?.designers || []}
      />
    </>
  );
}










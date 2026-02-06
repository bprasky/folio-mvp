'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Calendar, Target, TrendingUp, MapPin, Users } from "lucide-react";
import type { PostSuggestion } from "@/lib/suggestions/postRules";
import { PlaybookSheet } from "./PlaybookSheet";
import type { IntentDesigner } from "@/lib/mock/eventPost";

interface Next7DaysPlanProps {
  suggestions: PostSuggestion[];
}

export function Next7DaysPlan({ suggestions }: Next7DaysPlanProps) {
  const [activeSheet, setActiveSheet] = useState<{
    type: 'close' | 'sample' | 'moodboard' | 'localized' | 'reviews';
    data?: any;
  } | null>(null);

  // Helper functions - defined first to avoid hoisting issues
  const getPlaybookType = (action: string): 'close' | 'sample' | 'moodboard' | 'localized' | 'reviews' => {
    if (action.includes('Close')) return 'close';
    if (action.includes('Sample')) return 'sample';
    if (action.includes('Moodboard') || action.includes('Images')) return 'moodboard';
    if (action.includes('Localize')) return 'localized';
    return 'reviews';
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'High': return 'bg-red-100 text-red-800 border-red-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Low': return 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--ridge-outer)]';
      default: return 'bg-[var(--accent)]/10 text-blue-800 border-[var(--accent)]/20';
    }
  };

  const handlePlaybookClick = (playbook: any) => {
    setActiveSheet({
      type: playbook.type,
      data: playbook
    });
  };

  // Default playbooks when no suggestions are active
  const defaultPlaybooks = [
    {
      id: 'close-offer',
      title: 'Close Offer 5%',
      description: 'Target: Ready to Close',
      icon: TrendingUp,
      expectedLift: '+15% conversion',
      target: 'High-intent designers',
      type: 'close' as const,
      color: 'bg-red-100 text-red-800 border-red-200'
    },
    {
      id: 'spec-pack',
      title: 'Send Spec Pack',
      description: 'Target: Warm Evaluators',
      icon: Target,
      expectedLift: '+8% engagement',
      target: 'Warm prospects',
      type: 'sample' as const,
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    },
    {
      id: 'sample-kit',
      title: 'Send Sample Kit',
      description: 'Target: Top SKUs',
      icon: Users,
      expectedLift: '+12% consideration',
      target: 'Material evaluation',
      type: 'sample' as const,
      color: 'bg-[var(--accent)]/10 text-blue-800 border-[var(--accent)]/20'
    },
    {
      id: 'localized-push',
      title: 'Localize Assets',
      description: 'Target: Underserved City',
      icon: MapPin,
      expectedLift: '+6% market share',
      target: 'Growth markets',
      type: 'localized' as const,
      color: 'bg-green-100 text-green-800 border-green-200'
    },
    {
      id: 'account-reviews',
      title: 'Account Reviews',
      description: 'Target: Top 5 Firms',
      icon: Calendar,
      expectedLift: '+20% relationship',
      target: 'Key accounts',
      type: 'reviews' as const,
      color: 'bg-purple-100 text-purple-800 border-purple-200'
    }
  ];

  // Show contextual suggestions if available, otherwise show defaults
  const activePlaybooks = suggestions.length > 0 ? suggestions.map(sugg => ({
    id: sugg.id,
    title: sugg.title,
    description: sugg.reason,
    icon: TrendingUp, // Default icon
    expectedLift: `Impact: ${sugg.impact}`,
    target: sugg.target || 'Selected targets',
    type: getPlaybookType(sugg.action),
    color: getImpactColor(sugg.impact)
  })) : defaultPlaybooks;

  return (
    <>
      <div className="sticky top-4 space-y-4">
        <Card className="bg-white border-[#DAD2CA]">
          <CardHeader>
            <CardTitle className="text-lg font-serif text-[#2B2B2B] flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-[#8C8278]" />
              <span>Next 7 Days Plan</span>
            </CardTitle>
            <p className="text-sm text-[#8C8278]">
              {suggestions.length > 0 
                ? 'Contextual actions based on your selection'
                : 'Prebuilt playbooks with expected lift'
              }
            </p>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {activePlaybooks.map((playbook, index) => (
              <div 
                key={playbook.id}
                className="border border-[#DAD2CA] rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handlePlaybookClick(playbook)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-[#F7F4F1] flex items-center justify-center flex-shrink-0">
                      <playbook.icon className="w-4 h-4 text-[#8C8278]" />
                    </div>
                    <div>
                      <h4 className="font-medium text-[#2B2B2B] text-sm">
                        {playbook.title}
                      </h4>
                      <p className="text-xs text-[#8C8278]">
                        {playbook.description}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#8C8278] flex-shrink-0" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge className={`text-xs ${playbook.color}`}>
                      {playbook.expectedLift}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#8C8278]">
                    {playbook.target}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Playbook Sheet */}
      <PlaybookSheet
        isOpen={!!activeSheet}
        onClose={() => setActiveSheet(null)}
        type={activeSheet?.type}
        designers={[]} // Will be populated based on the specific playbook type
      />
    </>
  );
}

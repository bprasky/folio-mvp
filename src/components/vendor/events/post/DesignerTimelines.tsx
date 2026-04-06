'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, ArrowRight } from "lucide-react";
import type { DesignerJourney } from "@/lib/mock/eventPost";
import { formatCurrency } from "@/lib/format";
import { format, parseISO } from "date-fns";

interface DesignerTimelinesProps {
  journeys: DesignerJourney[];
  onActionClick?: (journey: DesignerJourney, action: string) => void;
}

export function DesignerTimelines({ journeys, onActionClick }: DesignerTimelinesProps) {
  const getStepColor = (type: string) => {
    switch (type) {
      case 'touch': return 'bg-[var(--accent)]/10 text-blue-800 border-[var(--accent)]/20';
      case 'action': return 'bg-green-100 text-green-800 border-green-200';
      case 'outcome': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-surface-ground text-folio-text-primary border-folio-border-subtle';
    }
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'touch': return '👋';
      case 'action': return '⚡';
      case 'outcome': return '💰';
      default: return '📊';
    }
  };

  const formatTime = (isoString: string) => {
    try {
      return format(parseISO(isoString), 'MMM d, HH:mm');
    } catch {
      return isoString;
    }
  };

  return (
    <Card className="bg-white border-folio-border-strong">
      <CardHeader>
        <CardTitle className="text-lg font-serif text-folio-text-primary flex items-center space-x-2">
          <Users className="w-5 h-5 text-folio-text-secondary" />
          <span>Sequenced follow-ups for real accounts</span>
        </CardTitle>
        <p className="text-sm text-folio-text-secondary">
          Top firms with touchpoint timelines and recommended next actions
        </p>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-6">
          {journeys.map((journey, index) => (
            <div key={index} className="border border-folio-border-strong rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-medium text-folio-text-primary text-lg">
                    {journey.firm}
                  </h3>
                  <div className="text-sm text-green-600 font-semibold">
                    {formatCurrency(journey.valueUsd, 'USD', true)} estimated value
                  </div>
                </div>
                
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  Active
                </Badge>
              </div>

              {/* Timeline */}
              <div className="relative mb-4">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[#DAD2CA]"></div>
                
                <div className="space-y-4">
                  {journey.steps.map((step, stepIndex) => (
                    <div key={stepIndex} className="relative flex items-start space-x-4">
                      <div className="relative z-10 w-8 h-8 rounded-full bg-white border-2 border-folio-border-strong flex items-center justify-center">
                        <span className="text-xs">{getStepIcon(step.type)}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge className={`text-xs ${getStepColor(step.type)}`}>
                            {step.type}
                          </Badge>
                          <span className="text-xs text-folio-text-secondary">
                            {formatTime(step.t)}
                          </span>
                        </div>
                        <p className="text-sm text-folio-text-primary">
                          {step.label}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Touch Recommendation */}
              <div className="bg-surface-elevated rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-folio-text-primary mb-1">
                      Next Touch: {journey.nextTouch.suggestion}
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-folio-text-secondary">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{journey.nextTouch.bestDow}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{journey.nextTouch.bestHour}:00</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    size="sm"
                    onClick={() => onActionClick?.(journey, journey.nextTouch.suggestion)}
                    className="flex items-center space-x-2"
                  >
                    <span>Schedule</span>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}










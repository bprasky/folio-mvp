'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, ArrowRight } from "lucide-react";
import type { TimeToSpecDist } from "@/lib/mock/eventPost";

interface TimeToSpecProps {
  timeToSpec: TimeToSpecDist;
  onActionClick?: (action: string) => void;
}

export function TimeToSpec({ timeToSpec, onActionClick }: TimeToSpecProps) {
  const maxCount = Math.max(...timeToSpec.bins.map(b => b.count));

  return (
    <Card className="bg-surface-canvas border-folio-border-strong">
      <CardHeader>
        <CardTitle className="text-lg font-serif text-folio-text-primary flex items-center space-x-2">
          <Clock className="w-5 h-5 text-folio-text-secondary" />
          <span>Time-to-Spec Distribution & Best Send Window</span>
        </CardTitle>
        <p className="text-sm text-folio-text-secondary">
          Urgency backed by data
        </p>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribution Histogram */}
          <div>
            <h3 className="text-sm font-medium text-folio-text-primary mb-4">
              Save → Tag Response Time
            </h3>
            
            <div className="space-y-3">
              {timeToSpec.bins.map((bin, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="w-16 text-xs text-folio-text-secondary text-right">
                    {bin.bucket}
                  </div>
                  <div className="flex-1">
                    <div className="w-full bg-surface-elevated rounded-full h-4">
                      <div 
                        className="h-4 rounded-full bg-[#8C8278] transition-all duration-500"
                        style={{ width: `${(bin.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-12 text-xs text-folio-text-secondary text-left">
                    {bin.count}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-folio-border-strong">
              <div className="text-xs text-folio-text-secondary">
                Median: {timeToSpec.medianHours}h
              </div>
              <div className="text-xs text-folio-text-secondary">
                P90: {timeToSpec.p90Hours}h
              </div>
            </div>
          </div>

          {/* Best Send Windows */}
          <div>
            <h3 className="text-sm font-medium text-folio-text-primary mb-4">
              Optimal Follow-up Times
            </h3>
            
            <div className="space-y-4">
              {timeToSpec.bestHours.map((window, index) => (
                <div key={index} className="border border-folio-border-strong rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-folio-text-secondary" />
                      <span className="font-medium text-folio-text-primary">
                        {window.dow}
                      </span>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      Best
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-2 mb-3">
                    <Clock className="w-4 h-4 text-folio-text-secondary" />
                    <span className="text-folio-text-primary">
                      {window.hour}:00
                    </span>
                    <span className="text-xs text-folio-text-secondary">
                      ({index === 0 ? 'Primary' : 'Secondary'} window)
                    </span>
                  </div>

                  <div className="text-xs text-folio-text-secondary">
                    Highest engagement rate: {85 - (index * 15)}%
                  </div>
                </div>
              ))}
            </div>

            {/* Insight Pill */}
            <div className="mt-4 p-3 bg-surface-elevated rounded-lg">
              <div className="text-sm text-folio-text-primary mb-2">
                Most designers respond within {timeToSpec.medianHours} hours after saving.
              </div>
              <div className="text-xs text-folio-text-secondary">
                Schedule follow-ups in the optimal windows above for maximum impact.
              </div>
            </div>

            <Button
              className="w-full mt-4"
              onClick={() => onActionClick?.('Schedule follow-ups at best times')}
            >
              Schedule Follow-ups at Best Times
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}










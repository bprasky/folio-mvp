'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Map, Grid3X3, TrendingUp, ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight } from "lucide-react";
import type { OpportunityPoint } from "@/lib/mock/eventPost";
import { formatCurrency } from "@/lib/format";

interface OpportunityMapProps {
  opportunities: OpportunityPoint[];
  onHover?: (opportunity: OpportunityPoint | null) => void;
  onActionClick?: (opportunity: OpportunityPoint, action: string) => void;
}

export function OpportunityMap({ opportunities, onHover, onActionClick }: OpportunityMapProps) {
  const [viewMode, setViewMode] = useState<'market' | 'room'>('market');
  const [hoveredQuadrant, setHoveredQuadrant] = useState<string | null>(null);

  // Group opportunities by quadrant
  const quadrantGroups = {
    'Most Underserved': opportunities.filter(o => o.quadrant === 'Most Underserved'),
    'Build': opportunities.filter(o => o.quadrant === 'Build'),
    'Maintain': opportunities.filter(o => o.quadrant === 'Maintain'),
    'Watch': opportunities.filter(o => o.quadrant === 'Watch')
  };

  const getQuadrantIcon = (quadrant: string) => {
    switch (quadrant) {
      case 'Most Underserved': return ArrowUpRight;
      case 'Build': return ArrowUpLeft;
      case 'Maintain': return ArrowDownLeft;
      case 'Watch': return ArrowDownRight;
      default: return TrendingUp;
    }
  };

  const getQuadrantColor = (quadrant: string) => {
    switch (quadrant) {
      case 'Most Underserved': return 'border-red-200 bg-red-50';
      case 'Build': return 'border-green-200 bg-green-50';
      case 'Maintain': return 'border-yellow-200 bg-yellow-50';
      case 'Watch': return 'border-folio-border-subtle bg-surface-ground';
      default: return 'border-folio-border-subtle bg-surface-ground';
    }
  };

  const getQuadrantActions = (quadrant: string) => {
    switch (quadrant) {
      case 'Most Underserved': return ['Localize Assets', 'Invite Look-alikes'];
      case 'Build': return ['Samples', 'Spec Pack'];
      case 'Maintain': return ['Case Study', 'Editorial'];
      case 'Watch': return ['Monitor'];
      default: return [];
    }
  };

  return (
    <Card className="bg-surface-canvas border-folio-border-strong">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-serif text-folio-text-primary flex items-center space-x-2">
              <Grid3X3 className="w-5 h-5 text-folio-text-secondary" />
              <span>Where the money is hiding</span>
            </CardTitle>
            <p className="text-sm text-folio-text-secondary mt-1">
              Potential vs Share mapping
            </p>
          </div>
          
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant={viewMode === 'market' ? 'default' : 'outline'}
              onClick={() => setViewMode('market')}
            >
              <Map className="w-4 h-4 mr-2" />
              Market
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'room' ? 'default' : 'outline'}
              onClick={() => setViewMode('room')}
            >
              <Grid3X3 className="w-4 h-4 mr-2" />
              Room
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* 2x2 Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {Object.entries(quadrantGroups).map(([quadrant, items]) => {
            const IconComponent = getQuadrantIcon(quadrant);
            const isHovered = hoveredQuadrant === quadrant;
            
            return (
              <div
                key={quadrant}
                className={`border-2 rounded-lg p-4 transition-all ${
                  getQuadrantColor(quadrant)
                } ${isHovered ? 'ring-2 ring-[#8C8278]' : ''}`}
                onMouseEnter={() => {
                  setHoveredQuadrant(quadrant);
                  onHover?.(items[0] || null);
                }}
                onMouseLeave={() => {
                  setHoveredQuadrant(null);
                  onHover?.(null);
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <IconComponent className="w-5 h-5 text-folio-text-secondary" />
                    <h3 className="font-medium text-folio-text-primary">{quadrant}</h3>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {items.length} {viewMode}s
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  {items.slice(0, 3).map((item, index) => (
                    <div key={index} className="text-sm">
                      <div className="font-medium text-folio-text-primary">
                        {item.name}
                      </div>
                      <div className="text-xs text-folio-text-secondary">
                        {formatCurrency(item.potentialUsd, 'USD', true)} potential • {item.sharePct.toFixed(1)}% share
                      </div>
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div className="text-xs text-folio-text-secondary">
                      +{items.length - 3} more...
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {getQuadrantActions(quadrant).map((action, index) => (
                    <Button
                      key={index}
                      size="sm"
                      variant="outline"
                      className="text-xs h-6"
                      onClick={() => onActionClick?.(items[0], action)}
                    >
                      {action}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Axis Labels */}
        <div className="grid grid-cols-2 gap-4 text-xs text-folio-text-secondary text-center">
          <div className="border-t-2 border-[#8C8278] py-2">
            <div>Low Potential</div>
            <div className="text-folio-text-primary font-medium">High Potential</div>
          </div>
          <div className="flex justify-between items-center px-4">
            <span>High Share</span>
            <div className="w-full h-0.5 bg-[#8C8278] mx-2"></div>
            <span>Low Share</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}










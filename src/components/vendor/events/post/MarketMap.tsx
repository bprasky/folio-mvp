'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Map, List, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import type { MarketRow } from "@/lib/mock/eventPost";

interface MarketMapProps {
  markets: MarketRow[];
  onHover?: (market: MarketRow | null) => void;
  onActionClick?: (market: MarketRow, action: string) => void;
}

export function MarketMap({ markets, onHover, onActionClick }: MarketMapProps) {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const getBadgeColor = (badge?: string) => {
    switch (badge) {
      case 'Hot': return 'bg-red-100 text-red-800 border-red-200';
      case 'Underserved': return 'bg-[var(--accent)]/10 text-blue-800 border-[var(--accent)]/20';
      default: return 'bg-surface-ground text-folio-text-primary border-folio-border-subtle';
    }
  };

  const getTrendIcon = (delta: number) => {
    return delta >= 0 ? (
      <TrendingUp className="w-3 h-3 text-green-600" />
    ) : (
      <TrendingDown className="w-3 h-3 text-red-600" />
    );
  };

  const getActionButtons = (market: MarketRow) => {
    const actions = [];
    
    if (market.badge === 'Hot') {
      actions.push('Close Now');
    } else if (market.badge === 'Underserved') {
      actions.push('Localize', 'Invite Look-alikes');
    } else {
      actions.push('Boost', 'Spec Pack');
    }
    
    return actions;
  };

  return (
    <Card className="bg-surface-canvas border-folio-border-strong">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-serif text-folio-text-primary flex items-center space-x-2">
              <Map className="w-5 h-5 text-folio-text-secondary" />
              <span>Market Map</span>
            </CardTitle>
            <p className="text-sm text-folio-text-secondary mt-1">
              Where to close now — and where to grow
            </p>
          </div>
          
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'outline'}
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4 mr-2" />
              List
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'map' ? 'default' : 'outline'}
              onClick={() => setViewMode('map')}
            >
              <Map className="w-4 h-4 mr-2" />
              Map
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {viewMode === 'list' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-4 text-xs font-medium text-folio-text-secondary border-b border-folio-border-strong pb-2">
              <div className="col-span-4">City</div>
              <div className="col-span-2 text-right">Saves</div>
              <div className="col-span-2 text-right">Share%</div>
              <div className="col-span-2 text-right">Trend Δ</div>
              <div className="col-span-2">Actions</div>
            </div>
            
            {markets.map((market, index) => (
              <div 
                key={market.city}
                className="grid grid-cols-12 gap-4 items-center py-3 border-b border-[#F7F4F1] hover:bg-surface-elevated/50 transition-colors"
                onMouseEnter={() => onHover?.(market)}
                onMouseLeave={() => onHover?.(null)}
              >
                <div className="col-span-4 flex items-center space-x-2">
                  <div className="font-medium text-folio-text-primary">
                    {market.city}
                  </div>
                  {market.badge && (
                    <Badge className={`text-xs ${getBadgeColor(market.badge)}`}>
                      {market.badge}
                    </Badge>
                  )}
                </div>
                
                <div className="col-span-2 text-right font-medium text-folio-text-primary">
                  {market.saves.toLocaleString()}
                </div>
                
                <div className="col-span-2 text-right text-folio-text-primary">
                  {market.sharePct.toFixed(1)}%
                </div>
                
                <div className="col-span-2 text-right">
                  <div className="flex items-center justify-end space-x-1">
                    {getTrendIcon(market.trendDeltaPct)}
                    <span className={`text-sm font-medium ${
                      market.trendDeltaPct >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {Math.abs(market.trendDeltaPct).toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                <div className="col-span-2">
                  <div className="flex space-x-1">
                    {getActionButtons(market).map((action, actionIndex) => (
                      <Button
                        key={actionIndex}
                        size="sm"
                        variant="outline"
                        className="text-xs h-6"
                        onClick={() => onActionClick?.(market, action)}
                      >
                        {action}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Map className="w-12 h-12 text-folio-text-secondary mx-auto mb-4" />
            <p className="text-folio-text-secondary">Mini map visualization coming soon</p>
            <p className="text-sm text-folio-text-secondary mt-2">
              Use list view for detailed market analysis
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}










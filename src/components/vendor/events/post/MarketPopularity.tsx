'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, TrendingUp, TrendingDown } from "lucide-react";
import type { MarketRow } from "@/lib/mock/eventPost";
import { formatCompactNumber, formatPercentage } from "@/lib/format";
import { getMarketSuggestions, type PostSuggestion } from "@/lib/suggestions/postRules";

interface MarketPopularityProps {
  data: MarketRow[];
  onHover?: (suggestions: PostSuggestion[]) => void;
}

export function MarketPopularity({ data, onHover }: MarketPopularityProps) {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [hoveredMarket, setHoveredMarket] = useState<MarketRow | null>(null);

  const handleMarketHover = (market: MarketRow | null) => {
    setHoveredMarket(market);
    if (market && onHover) {
      const suggestions = getMarketSuggestions(market);
      onHover(suggestions);
    } else if (onHover) {
      onHover([]);
    }
  };

  const renderListView = () => (
    <div className="space-y-3">
      {data.map((market, index) => (
        <div 
          key={market.city}
          className={`flex items-center justify-between p-4 bg-surface-elevated rounded-lg hover:bg-[#F0EDE8] transition-colors cursor-pointer ${
            hoveredMarket?.city === market.city ? 'bg-[#F0EDE8]' : ''
          }`}
          onMouseEnter={() => handleMarketHover(market)}
          onMouseLeave={() => handleMarketHover(null)}
        >
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <MapPin className="w-4 h-4 text-folio-text-secondary" />
              <h4 className="font-medium text-folio-text-primary">{market.city}</h4>
              <div className="flex items-center space-x-2">
                {market.badge && (
                  <Badge className={`text-xs ${
                    market.badge === 'Hot' 
                      ? 'bg-red-100 text-red-800 border-red-200' 
                      : 'bg-[var(--accent)]/10 text-blue-800 border-[var(--accent)]/20'
                  }`}>
                    {market.badge}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-6 text-sm text-folio-text-secondary">
              <span>{formatCompactNumber(market.saves)} saves</span>
              <span>{formatPercentage(market.sharePct, 1)} share</span>
              <div className="flex items-center space-x-1">
                {market.trendDeltaPct >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-green-600" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-600" />
                )}
                <span className={market.trendDeltaPct >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {market.trendDeltaPct >= 0 ? '+' : ''}{market.trendDeltaPct.toFixed(1)}% trend
                </span>
              </div>
            </div>
          </div>
          
          {/* Share indicator */}
          <div className="w-32 bg-[#F0EDE8] rounded-full h-3">
            <div 
              className="bg-[#8C8278] h-3 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(market.sharePct * 3, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );

  const renderMapView = () => (
    <div className="h-64 bg-surface-elevated rounded-lg flex items-center justify-center">
      <div className="text-center text-folio-text-secondary">
        <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm font-medium mb-1">Market Map</p>
        <p className="text-xs">Geographic visualization coming soon</p>
      </div>
    </div>
  );

  return (
    <Card className="bg-white border-folio-border-strong">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-serif text-folio-text-primary">
              Market Map
            </CardTitle>
            <p className="text-sm text-folio-text-secondary mt-1">
              Where to close now — and where to grow.
            </p>
          </div>
          <div className="flex items-center bg-surface-elevated rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              className={`px-3 py-1 h-auto ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-transparent'}`}
              onClick={() => setViewMode('list')}
            >
              <span className="text-xs">List</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`px-3 py-1 h-auto ${viewMode === 'map' ? 'bg-white shadow-sm' : 'hover:bg-transparent'}`}
              onClick={() => setViewMode('map')}
            >
              <MapPin className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {viewMode === 'list' ? renderListView() : renderMapView()}
      </CardContent>
    </Card>
  );
}

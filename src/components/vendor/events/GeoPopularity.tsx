'use client';

import { useState } from 'react';
import { CityHeat } from "@/lib/mock/eventAnalytics";
import { formatCompactNumber } from "@/lib/format";
import { FocusContext } from "@/lib/suggestions/types";
import { List, Map } from "lucide-react";
import VisualActionCard from "@/components/analytics/VisualActionCard";
import ActionPill from "@/components/analytics/ui/ActionPill";
import { toast } from 'sonner';

interface GeoPopularityProps {
  data: CityHeat[];
  onHover?: (ctx: FocusContext | null) => void;
}

export function GeoPopularity({ data, onHover }: GeoPopularityProps) {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  
  // Calculate total saves for percentage calculation
  const totalSaves = data.reduce((sum, city) => sum + city.count, 0);
  
  // Mock additional data for city analysis
  const cityAnalytics = data.map(city => {
    const sharePct = (city.count / totalSaves) * 100;
    const trendDelta = Math.random() * 20 - 10; // Mock trend data
    const isUnderserved = sharePct < 15 && trendDelta > 0; // Low share but positive trend
    const isHot = sharePct > 25 && trendDelta > 5; // High share and rising
    
    return {
      ...city,
      sharePct: Math.round(sharePct * 10) / 10,
      trendDelta: Math.round(trendDelta * 10) / 10,
      isUnderserved,
      isHot
    };
  });

  const localizeAssets = (cityName: string) => {
    toast.success(`Assets localized for ${cityName}`);
  };

  const sponsorEvent = (cityName: string) => {
    toast.success(`Event tile sponsored in ${cityName}`);
  };

  const renderListView = () => (
    <div className="space-y-3">
      {cityAnalytics.slice(0, 5).map((city, index) => (
        <div 
          key={city.city}
          className="flex items-center justify-between p-3 bg-canvas/10 rounded-lg hover:bg-canvas/20 transition-colors cursor-pointer group"
          onMouseEnter={() => onHover?.({
            type: 'city',
            key: city.city,
            data: {
              city: city.city,
              citySharePct: city.sharePct,
              cityTrendDeltaPct: city.trendDelta,
              portfolioMedianSharePct: 20
            }
          })}
          onMouseLeave={() => onHover?.(null)}
        >
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="font-medium text-canvas text-sm">{city.city}</h4>
              <div className="flex items-center space-x-1">
                {city.isUnderserved && (
                  <span className="text-xs bg-accent-opp/20 text-accent-opp px-2 py-0.5 rounded">Underserved</span>
                )}
                {city.isHot && (
                  <span className="text-xs bg-accent-risk/20 text-accent-risk px-2 py-0.5 rounded">Hot</span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4 text-xs text-folio-text-secondary">
              <span>{formatCompactNumber(city.count)} saves</span>
              <span>{city.sharePct}% share</span>
              <span className={city.trendDelta >= 0 ? 'text-accent-opp' : 'text-accent-risk'}>
                {city.trendDelta >= 0 ? '+' : ''}{city.trendDelta}% YoY
              </span>
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <ActionPill label="Localize assets" onClick={()=>localizeAssets(city.city)} />
            <ActionPill label="Sponsor event" onClick={()=>sponsorEvent(city.city)} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderMapView = () => (
    <div className="h-48 bg-canvas/10 rounded-lg flex items-center justify-center">
      <div className="text-center text-folio-text-secondary">
        <Map className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Mini map view coming soon</p>
        <p className="text-xs">Interactive geographic visualization</p>
      </div>
    </div>
  );

  return (
    <VisualActionCard
      title="Geographic Popularity"
      tone="opp"
      visual={
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-folio-text-secondary">Where interest concentrates — and where to grow</div>
            <div className="flex items-center bg-canvas/20 rounded-lg p-1">
              <button
                className={`px-3 py-1 rounded text-xs ${viewMode === 'list' ? 'bg-canvas/30' : 'hover:bg-canvas/20'}`}
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                className={`px-3 py-1 rounded text-xs ${viewMode === 'map' ? 'bg-canvas/30' : 'hover:bg-canvas/20'}`}
                onClick={() => setViewMode('map')}
              >
                <Map className="w-4 h-4" />
              </button>
            </div>
          </div>
          {viewMode === 'list' ? renderListView() : renderMapView()}
        </div>
      }
      what="Top 5 markets by save volume and growth"
      why="Geographic insights reveal expansion opportunities"
      actions={[
        { label:'Export geo data', onClick:()=>toast.success('Geographic data exported') },
        { label:'Create local campaigns', onClick:()=>toast.success('Local campaigns created') },
      ]}
    />
  );
}
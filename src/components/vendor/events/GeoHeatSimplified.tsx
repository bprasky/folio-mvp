'use client';

import { CityHeat } from "@/lib/mock/eventAnalytics";
import { formatCompactNumber } from "@/lib/format";
import { FocusContext } from "@/lib/suggestions/types";

interface GeoHeatSimplifiedProps {
  data: CityHeat[];
  onHover?: (ctx: FocusContext | null) => void;
}

export function GeoHeatSimplified({ data, onHover }: GeoHeatSimplifiedProps) {
  const maxCount = Math.max(...data.map(item => item.count));
  
  return (
    <div className="space-y-4">
      {data.map((city, index) => {
        const intensity = city.count / maxCount;
        const barWidth = `${Math.max(intensity * 100, 10)}%`;
        
        return (
          <div 
            key={city.city} 
            className="flex items-center justify-between cursor-pointer hover:bg-[#F7F4F1] rounded-lg p-2 transition-colors"
            onMouseEnter={() => onHover?.({
              type: 'city',
              key: city.city,
              data: city
            })}
            onMouseLeave={() => onHover?.(null)}
          >
            <div className="flex items-center space-x-3 flex-1">
              <div className="w-20 text-sm font-medium text-[#2B2B2B]">
                {city.city}
              </div>
              <div className="flex-1 bg-[#F0EDE8] rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-[#8C8278] rounded-full transition-all duration-300"
                  style={{ width: barWidth }}
                />
              </div>
            </div>
            <div className="w-12 text-right text-sm font-semibold text-[#2B2B2B]">
              {formatCompactNumber(city.count)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

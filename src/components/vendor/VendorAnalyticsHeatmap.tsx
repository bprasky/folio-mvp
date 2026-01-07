'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';

interface HeatmapData {
  [region: string]: number;
}

interface VendorAnalyticsHeatmapProps {
  data: HeatmapData;
  title?: string;
  description?: string;
}

export default function VendorAnalyticsHeatmap({ 
  data, 
  title = "Spec Heatmap", 
  description = "Projects by region" 
}: VendorAnalyticsHeatmapProps) {
  const entries = Object.entries(data).sort(([,a], [,b]) => b - a);
  const maxCount = Math.max(...entries.map(([, count]) => count));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-gray-500 text-sm">No data available</p>
        ) : (
          <div className="space-y-3">
            {entries.slice(0, 8).map(([region, count]) => {
              const intensity = maxCount > 0 ? count / maxCount : 0;
              const bgColor = intensity > 0.7 ? 'bg-blue-100' : 
                             intensity > 0.4 ? 'bg-blue-50' : 'bg-gray-50';
              const textColor = intensity > 0.7 ? 'text-blue-900' : 
                               intensity > 0.4 ? 'text-blue-700' : 'text-gray-600';
              
              return (
                <div key={region} className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate flex-1">{region}</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-16 h-2 rounded-full ${bgColor}`}>
                      <div 
                        className={`h-2 rounded-full bg-blue-500 transition-all duration-300`}
                        style={{ width: `${intensity * 100}%` }}
                      />
                    </div>
                    <Badge variant="secondary" className={`text-xs ${textColor}`}>
                      {count}
                    </Badge>
                  </div>
                </div>
              );
            })}
            {entries.length > 8 && (
              <p className="text-xs text-gray-500 text-center pt-2">
                +{entries.length - 8} more regions
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


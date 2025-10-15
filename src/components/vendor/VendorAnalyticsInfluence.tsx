'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Star, TrendingUp } from 'lucide-react';

interface DesignerInfluence {
  designerId: string;
  projectCount: number;
  selectionCount: number;
  recentActivity: number;
  influenceScore: number;
}

interface VendorAnalyticsInfluenceProps {
  data: DesignerInfluence[];
  title?: string;
  description?: string;
}

export default function VendorAnalyticsInfluence({ 
  data, 
  title = "Designer Influence", 
  description = "Top designers by engagement" 
}: VendorAnalyticsInfluenceProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-gray-500 text-sm">No designer data available</p>
        ) : (
          <div className="space-y-4">
            {data.slice(0, 5).map((designer, index) => (
              <div key={designer.designerId} className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <Badge variant={index < 3 ? "default" : "secondary"} className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                    {index + 1}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    Designer {designer.designerId.slice(0, 8)}...
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{designer.projectCount} projects</span>
                    <span>•</span>
                    <span>{designer.selectionCount} specs</span>
                    {designer.recentActivity > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-green-600">{designer.recentActivity} recent</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1">
                  <Star className="h-3 w-3 text-yellow-500" />
                  <span className="text-xs font-medium">{designer.influenceScore}</span>
                </div>
              </div>
            ))}
            {data.length > 5 && (
              <p className="text-xs text-gray-500 text-center pt-2">
                +{data.length - 5} more designers
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


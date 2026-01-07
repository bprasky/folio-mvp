'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Package } from 'lucide-react';

interface TrendingProduct {
  name: string;
  totalSpecs: number;
  recentSpecs: number;
  selections: Array<{
    id: string;
    productName?: string | null;
    vendorName?: string | null;
    photo?: string | null;
  }>;
}

interface VendorAnalyticsTrendingProps {
  data: TrendingProduct[];
  title?: string;
  description?: string;
}

export default function VendorAnalyticsTrending({ 
  data, 
  title = "Trending Products", 
  description = "Top products by recent specifications" 
}: VendorAnalyticsTrendingProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-gray-500 text-sm">No trending products</p>
        ) : (
          <div className="space-y-4">
            {data.slice(0, 5).map((product, index) => (
              <div key={product.name} className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <Badge variant={index < 3 ? "default" : "secondary"} className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                    {index + 1}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{product.name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{product.recentSpecs} recent</span>
                    <span>•</span>
                    <span>{product.totalSpecs} total</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {product.recentSpecs > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Hot
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {data.length > 5 && (
              <p className="text-xs text-gray-500 text-center pt-2">
                +{data.length - 5} more products
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


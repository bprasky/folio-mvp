'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ExternalLink, TrendingUp, Tag, Heart } from "lucide-react";
import type { ProductPost } from "@/lib/mock/eventPost";
import { formatCompactNumber, formatPercentage } from "@/lib/format";

interface TopProductsPostProps {
  products: ProductPost[];
}

export function TopProductsPost({ products }: TopProductsPostProps) {
  // Sort by save-to-tag rate (conversion rate) instead of raw saves
  const sortedProducts = [...products].sort((a, b) => b.saveToTagRatePct - a.saveToTagRatePct);

  return (
    <Card className="bg-white border-folio-border-strong">
      <CardHeader>
        <CardTitle className="text-lg font-serif text-folio-text-primary flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-folio-text-secondary" />
          <span>Top Products (Save→Tag)</span>
        </CardTitle>
        <p className="text-sm text-folio-text-secondary">
          Sorted by conversion rate, not raw saves
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedProducts.map((product, index) => (
            <div 
              key={product.id} 
              className="flex items-center justify-between p-4 bg-surface-elevated rounded-lg hover:bg-[#F0EDE8] transition-colors"
            >
              {/* Product Info */}
              <div className="flex items-center space-x-4 flex-1">
                <div className="text-sm font-medium text-folio-text-secondary w-6">
                  #{index + 1}
                </div>
                
                {/* Product Image Placeholder */}
                <div className="w-12 h-12 bg-[#DAD2CA] rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-folio-text-secondary font-medium">
                    {product.name.split(' ').map(word => word[0]).join('').substring(0, 2)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-folio-text-primary truncate">
                    {product.name}
                  </h4>
                  <p className="text-sm text-folio-text-secondary">
                    {product.vendor}
                  </p>
                </div>
              </div>

              {/* Metrics */}
              <div className="flex items-center space-x-6 text-sm">
                <div className="text-center">
                  <div className="flex items-center space-x-1 text-folio-text-secondary">
                    <Heart className="w-3 h-3" />
                    <span>{formatCompactNumber(product.saves)}</span>
                  </div>
                  <p className="text-xs text-folio-text-secondary">saves</p>
                </div>
                
                <div className="text-center">
                  <div className="flex items-center space-x-1 text-folio-text-secondary">
                    <Tag className="w-3 h-3" />
                    <span>{formatCompactNumber(product.tags)}</span>
                  </div>
                  <p className="text-xs text-folio-text-secondary">tags</p>
                </div>

                <div className="text-center">
                  <Badge className={`text-xs ${
                    product.saveToTagRatePct >= 60 
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : product.saveToTagRatePct >= 40
                      ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                      : 'bg-surface-ground text-folio-text-primary border-folio-border-subtle'
                  }`}>
                    {formatPercentage(product.saveToTagRatePct, 1)}
                  </Badge>
                  <p className="text-xs text-folio-text-secondary">rate</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2 flex-shrink-0">
                <Button variant="outline" size="sm" className="text-xs">
                  Feature
                </Button>
                <Button variant="outline" size="sm" className="text-xs">
                  Add Badge
                </Button>
                {product.ctaUrl && (
                  <Link href={product.ctaUrl}>
                    <Button variant="ghost" size="sm" className="text-xs">
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="mt-6 pt-4 border-t border-folio-border-strong">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-semibold text-folio-text-primary">
                {formatCompactNumber(sortedProducts.reduce((sum, p) => sum + p.saves, 0))}
              </p>
              <p className="text-xs text-folio-text-secondary">Total Saves</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-folio-text-primary">
                {formatCompactNumber(sortedProducts.reduce((sum, p) => sum + p.tags, 0))}
              </p>
              <p className="text-xs text-folio-text-secondary">Total Tags</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-folio-text-primary">
                {formatPercentage(
                  (sortedProducts.reduce((sum, p) => sum + p.tags, 0) / 
                  sortedProducts.reduce((sum, p) => sum + p.saves, 0)) * 100, 
                  1
                )}
              </p>
              <p className="text-xs text-folio-text-secondary">Avg Rate</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

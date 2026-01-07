'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TopProduct } from "@/lib/mock/eventAnalytics";
import { formatCompactNumber } from "@/lib/format";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { FocusContext } from "@/lib/suggestions/types";

interface TopProductsTableProps {
  products: TopProduct[];
  onHover?: (ctx: FocusContext | null) => void;
}

export function TopProductsTable({ products, onHover }: TopProductsTableProps) {
  return (
    <Card className="bg-white border-[#DAD2CA]">
      <CardHeader>
        <CardTitle className="text-lg font-serif text-[#2B2B2B]">
          Top Products at This Event
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {products.map((product, index) => (
            <div 
              key={product.id} 
              className="flex items-center justify-between p-4 bg-[#F7F4F1] rounded-lg hover:bg-[#F0EDE8] transition-colors cursor-pointer"
              data-testid={`product-${index}`}
              onMouseEnter={() => onHover?.({
                type: 'product',
                key: product.id,
                data: product
              })}
              onMouseLeave={() => onHover?.(null)}
            >
              <div className="flex items-center space-x-4 flex-1">
                <div className="w-16 h-16 bg-[#E5E0D7] rounded-lg flex items-center justify-center">
                  {product.thumbUrl ? (
                    <img 
                      src={product.thumbUrl} 
                      alt={product.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <span className="text-xs text-[#8C8278] text-center px-2">
                      Product Image
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[#2B2B2B] mb-1">
                    {product.name}
                  </div>
                  <div className="text-sm text-[#8C8278]">
                    by {product.vendor}
                  </div>
                  <Badge className="mt-2 bg-[#8C8278]/10 text-[#8C8278] border-[#8C8278]/20">
                    Saved {formatCompactNumber(product.saves)} times
                  </Badge>
                </div>
              </div>
              
              {product.ctaUrl && (
                <Link href={product.ctaUrl}>
                  <div className="flex items-center text-[#8C8278] hover:text-[#2B2B2B] transition-colors cursor-pointer">
                    <span className="text-sm mr-2">View</span>
                    <ExternalLink className="w-4 h-4" />
                  </div>
                </Link>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

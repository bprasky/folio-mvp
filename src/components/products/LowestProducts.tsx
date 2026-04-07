"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight } from "lucide-react";
import type { ProductPost, ProductFunnel } from "@/lib/mock/eventPost";

interface LowestProductsProps {
  products: (ProductFunnel | ProductPost)[];
}

export function LowestProducts({ products }: LowestProductsProps) {
  // Sort by save-to-tag rate ascending to get lowest performers
  const sortedProducts = [...products]
    .sort((a: any, b: any) => {
      const rateA = 'saveToTagRatePct' in a ? a.saveToTagRatePct : (a.tags / a.saves) * 100;
      const rateB = 'saveToTagRatePct' in b ? b.saveToTagRatePct : (b.tags / b.saves) * 100;
      return rateA - rateB;
    })
    .slice(0, 5);

  return (
    <div className="col-span-7 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-4 h-4 text-[var(--amber)]" />
        <span className="text-sm font-medium text-[var(--ink)]">
          Products with conversion gaps — Fix-it actions
        </span>
      </div>

      {sortedProducts.map((product: any, index) => {
        const rate = 'saveToTagRatePct' in product ? product.saveToTagRatePct : (product.tags / product.saves) * 100;
        const assetGaps = 'assetGaps' in product ? product.assetGaps : [];
        const strongMarkets = index % 2 === 0 ? ['NYC', 'LA'] : ['Miami', 'Chicago'];
        const weakMarkets = index % 2 === 0 ? ['Miami', 'Chicago'] : ['SF', 'Boston'];

        return (
          <div
            key={'productId' in product ? product.productId : product.id}
            className="p-4 bg-surface-canvas border border-[var(--grid)] rounded-lg hover:border-[var(--amber)] transition-all"
          >
            <div className="grid grid-cols-12 gap-4">
              {/* Product info */}
              <div className="col-span-4">
                <div className="font-medium text-[var(--ink)] mb-1">{product.name}</div>
                <div className="flex items-center gap-3 text-xs text-[var(--slate)]">
                  <span className="h-num">{product.saves} saves</span>
                  <span>→</span>
                  <span className="h-num">{product.tags} tags</span>
                </div>
                <div className="mt-2">
                  <Badge className={`text-xs ${rate < 30 ? 'bg-[var(--rose)]/10 text-[var(--rose)]' : 'bg-[var(--amber)]/10 text-[var(--amber)]'}`}>
                    {rate.toFixed(1)}% conversion
                  </Badge>
                </div>
              </div>

              {/* Market comparison */}
              <div className="col-span-4 text-xs">
                <div className="mb-2">
                  <span className="text-[var(--slate)] font-medium">Strong markets:</span>
                  <div className="flex gap-1 mt-1">
                    {strongMarkets.map(m => (
                      <Badge key={m} variant="secondary" className="bg-[var(--emerald)]/10 text-[var(--emerald)]">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[var(--slate)] font-medium">Weak markets:</span>
                  <div className="flex gap-1 mt-1">
                    {weakMarkets.map(m => (
                      <Badge key={m} variant="secondary" className="bg-[var(--rose)]/10 text-[var(--rose)]">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="col-span-4">
                <div className="text-xs font-semibold text-[var(--slate)] uppercase tracking-wide mb-2">
                  Fix-it actions
                </div>
                <div className="space-y-1">
                  {assetGaps.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full justify-between text-xs border-[var(--amber)] text-[var(--amber)] hover:bg-[var(--amber)] hover:text-white"
                    >
                      <span>Upload {assetGaps[0]}</span>
                      <span className="h-num">+12 pts est.</span>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-between text-xs"
                  >
                    <span>Cross-market boost</span>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-between text-xs"
                  >
                    <span>Designer case study</span>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="p-3 bg-[var(--grid)]/30 rounded-lg">
        <p className="text-xs h-key leading-relaxed">
          Products shown perform well in some markets/rooms but poorly in others. Cross-market asset boosts and targeted case studies typically add +8–15 pts conversion.
        </p>
      </div>
    </div>
  );
}

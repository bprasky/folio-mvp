"use client";

// src/components/magazine/MagazineProductRail.tsx
//
// Product Rail Component
//
// Horizontal scrolling carousel of products from the featured editorial.
// Renders nothing if no products are available.

import { type MagazineProduct } from "@/lib/magazine/getMagazineData";
import Image from "next/image";
import { decodeHtmlEntities } from "@/lib/utils";

interface Props {
  products: MagazineProduct[];
}

export default function MagazineProductRail({ products }: Props) {
  if (!products.length) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="folio-ui text-sm font-medium text-[var(--text-primary)]">
          Products from this story
        </h3>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
        {products.map((product) => (
          <div
            key={product.id}
            className="ridge-card min-w-[180px] max-w-[220px] flex-shrink-0 overflow-hidden rounded-2xl"
          >
            <div className="relative aspect-[4/3] w-full bg-[var(--bg-base)]">
              {product.imageUrl && (
                <Image
                  src={product.imageUrl}
                  alt={decodeHtmlEntities(product.name)}
                  fill
                  className="object-cover"
                />
              )}
            </div>
            <div className="space-y-1 px-3 py-2">
              <p className="folio-body line-clamp-2 text-xs font-medium text-[var(--text-primary)]">
                {decodeHtmlEntities(product.name)}
              </p>
              {product.vendorName && (
                <p className="folio-meta text-[11px] text-[var(--text-secondary)]">
                  {product.vendorName}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}


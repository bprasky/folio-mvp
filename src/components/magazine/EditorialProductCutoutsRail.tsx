"use client";

import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { type MagazineProduct } from "@/lib/magazine/getMagazineData";

interface Props {
  products: MagazineProduct[];
}

/**
 * EditorialProductCutoutsRail
 *
 * Featured Products strip for editorial hero.
 * Shows 3-4 key products with clean thumbnails, product name + vendor.
 * Products should be linked to vendors and have affiliate attribution.
 * Horizontal scroll or 4-column grid.
 */
export default function EditorialProductCutoutsRail({ products }: Props) {
  // Show products with cutouts first, then fallback to regular images
  const prioritizedProducts = [...products].sort((a, b) => {
    if (a.cutoutImageUrl && !b.cutoutImageUrl) return -1;
    if (!a.cutoutImageUrl && b.cutoutImageUrl) return 1;
    return 0;
  });

  // Limit to 4 products max for clean presentation
  const displayProducts = prioritizedProducts.slice(0, 4);

  if (!displayProducts.length) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-xs md:text-sm font-medium text-neutral-700 tracking-wide">
        Featured Products
      </h3>

      {/* Product grid - 4 columns on desktop, horizontal scroll on mobile */}
      <div className="w-full">
        <div 
          className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 overflow-x-auto md:overflow-x-visible pb-2 snap-x snap-mandatory scrollbar-hide"
          style={{ 
            WebkitOverflowScrolling: 'touch',
          } as React.CSSProperties}
        >
          {displayProducts.map((product) => {
            const productHref = `/products/${product.id}`;
            const hasCutout = !!product.cutoutImageUrl;
            const imageUrl = product.cutoutImageUrl || product.imageUrl;

            return (
              <Link
                key={product.id}
                href={productHref}
                className="flex flex-col items-stretch rounded-2xl border border-white/80 bg-white/80 backdrop-blur-lg shadow-sm px-3 py-3 transition-all duration-300 hover:shadow-md hover:scale-[1.02] flex-shrink-0 snap-start min-w-[140px] md:min-w-0"
              >
                {/* Product image/cutout */}
                <div className="relative mb-2 flex h-24 md:h-28 w-full items-center justify-center rounded-xl bg-[#EBE7E1] shadow-inner overflow-hidden flex-shrink-0">
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 via-transparent to-black/5" />
                  
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={product.name}
                      fill
                      sizes="(max-width: 768px) 140px, 180px"
                      className={clsx(
                        "object-contain p-2",
                        hasCutout 
                          ? "filter contrast-110 saturate-95 drop-shadow-[0_4px_12px_rgba(0,0,0,0.22)]"
                          : "object-cover"
                      )}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-neutral-100 to-neutral-200" />
                  )}
                </div>

                {/* Product info */}
                <div className="flex flex-col gap-0.5 min-h-[40px] justify-start flex-shrink-0">
                  <p className="line-clamp-2 text-xs font-semibold text-neutral-900 leading-snug">
                    {product.name}
                  </p>
                  {product.vendorName ? (
                    <p className="text-[10px] text-neutral-500 font-medium">
                      {product.vendorName}
                    </p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

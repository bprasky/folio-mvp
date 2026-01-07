"use client";

import { useMemo } from "react";
import { SceneShopStrip } from "./SceneShopStrip";

type ShopTheSpaceSectionProps = {
  post: any;
};

export function ShopTheSpaceSection({ post }: ShopTheSpaceSectionProps) {
  // Extract all unique products from project images tags
  const allProducts = useMemo(() => {
    const productMap = new Map<string, any>();
    
    post?.project?.images?.forEach((img: any) => {
      img.tags?.forEach((tag: any) => {
        const product = tag.product;
        if (product && !productMap.has(product.id)) {
          productMap.set(product.id, {
            id: product.id,
            name: product.name,
            imageUrl: product.imageUrl,
            url: product.url,
            vendorName: product.vendor?.name || product.vendor?.companyName,
            slug: product.slug || product.id,
          });
        }
      });
    });

    return Array.from(productMap.values());
  }, [post?.project?.images]);

  if (allProducts.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-3 md:px-0">
      <div className="rounded-[28px] bg-white/75 backdrop-blur-2xl ring-1 ring-black/5 px-6 py-5 md:px-8 md:py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold tracking-[0.16em] uppercase text-neutral-500">
            Shop the Space
          </h2>
          <span className="text-[11px] text-neutral-400">
            {allProducts.length} {allProducts.length === 1 ? "product" : "products"}
          </span>
        </div>
        <SceneShopStrip products={allProducts} />
      </div>
    </section>
  );
}


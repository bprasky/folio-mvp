"use client";

import React from "react";
import { Product } from "@/lib/mock/product";
import { Gallery } from "./Gallery";
import { PrimaryActions } from "./PrimaryActions";
import { SpecsAccordion } from "./SpecsAccordion";
import { InspirationGrid } from "./InspirationGrid";
import { VendorInsightsMini } from "./VendorInsightsMini";
import { RelatedProductsRail } from "./RelatedProductsRail";

export function ProductPage({ product }: { product: Product }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="text-2xl font-semibold text-folio-text-primary">{product.name}</div>
        <div className="text-sm text-folio-text-secondary">{product.brand} • {product.sku}</div>
      </div>

      {/* Top grid */}
      <div className="mt-6 grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-7">
          <Gallery assets={product.assets} />
        </div>
        <div className="col-span-12 lg:col-span-5 space-y-5">
          <div className="rounded-2xl border border-folio-border-subtle bg-surface-canvas p-4">
            <div className="text-sm text-folio-text-secondary">Description</div>
            <p className="mt-1 text-[15px] text-folio-text-primary">{product.description}</p>
          </div>

          <PrimaryActions product={product} />

          <VendorInsightsMini product={product} />

          <SpecsAccordion product={product} />
        </div>
      </div>

      {/* Inspiration */}
      <div className="mt-10">
        <InspirationGrid items={product.inspiration} />
      </div>

      {/* Related */}
      <div className="mt-10">
        <RelatedProductsRail items={product.related} />
      </div>
    </div>
  );
}

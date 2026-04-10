"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Product } from "@/lib/mock/product";
import { ImmersiveHero } from "./ImmersiveHero";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Gallery } from "./Gallery";
import { InsightsPanel } from "./InsightsPanel";
import { SpecPanel } from "./SpecPanel";
import { DownloadsPanel } from "./DownloadsPanel";
import { DesignerTestimonials } from "./DesignerTestimonials";
import { motion } from "framer-motion";

const EditorialInspirationGrid = dynamic(
  () =>
    import("./EditorialInspirationGrid").then((mod) => ({
      default: mod.EditorialInspirationGrid,
    })),
  { ssr: false }
);

const RelatedFibonacciGrid = dynamic(
  () =>
    import("./RelatedFibonacciGrid").then((mod) => ({
      default: mod.RelatedFibonacciGrid,
    })),
  { ssr: false }
);

interface ImmersiveProductPageProps {
  product: Product;
}

export function ImmersiveProductPage({ product }: ImmersiveProductPageProps) {
  const heroMedia = {
    videoUrl: product.assets.find((a) => a.type === "video")?.src,
    imageUrl:
      product.assets.find((a) => a.type === "image")?.src ||
      product.assets[0]?.src,
  };

  const palette = (product as any).palette;

  return (
    <>
      {/* Full-Bleed Immersive Hero — 100vh 3D viewport */}
      <ImmersiveHero
        media={heroMedia}
        product={product}
        mesh3dUrl={product.mesh3dUrl}
        meshColor={(product as any).meshColor}
        scenePresetId={product.scenePresetId}
        productCategory={product.category}
        title={product.name}
        brand={product.brand}
        palette={palette}
      />

      {/* Editorial Section — Below the viewport */}
      <div className="relative z-10 bg-white/40">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 space-y-16">
          {/* Description & Gallery Row */}
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
              hidden: {},
              visible: {
                transition: { staggerChildren: 0.06 },
              },
            }}
          >
            {/* Left: Description */}
            <motion.div
              className="space-y-6"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.18, ease: [0.25, 0.8, 0.25, 1] }}
            >
              {(product.description ||
                product.brand ||
                product.sku ||
                product.materials.length > 0 ||
                product.finish) && (
                <GlassPanel
                  header={
                    <h2 className="text-lg font-medium text-stone-900 dark:text-stone-100">
                      About This Product
                    </h2>
                  }
                >
                  <div className="prose prose-stone dark:prose-invert max-w-none">
                    {product.description && (
                      <p className="text-base leading-relaxed text-stone-700 dark:text-stone-300">
                        {product.description}
                      </p>
                    )}

                    {(product.brand ||
                      product.sku ||
                      product.materials.length > 0 ||
                      product.finish) && (
                      <div
                        className={`${product.description ? "mt-6 pt-6 border-t border-stone-200 dark:border-stone-700" : ""}`}
                      >
                        <dl className="grid grid-cols-2 gap-4 text-sm">
                          {product.brand && (
                            <div>
                              <dt className="font-medium text-stone-900 dark:text-stone-100">
                                Brand
                              </dt>
                              <dd className="mt-1 text-stone-600 dark:text-stone-400">
                                {product.brand}
                              </dd>
                            </div>
                          )}
                          {product.sku && (
                            <div>
                              <dt className="font-medium text-stone-900 dark:text-stone-100">
                                SKU
                              </dt>
                              <dd className="mt-1 font-mono text-xs text-stone-600 dark:text-stone-400">
                                {product.sku}
                              </dd>
                            </div>
                          )}
                          {product.materials.length > 0 && (
                            <div>
                              <dt className="font-medium text-stone-900 dark:text-stone-100">
                                Materials
                              </dt>
                              <dd className="mt-1 text-stone-600 dark:text-stone-400">
                                {product.materials.join(", ")}
                              </dd>
                            </div>
                          )}
                          {product.finish && (
                            <div>
                              <dt className="font-medium text-stone-900 dark:text-stone-100">
                                Finish
                              </dt>
                              <dd className="mt-1 text-stone-600 dark:text-stone-400">
                                {product.finish}
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    )}
                  </div>
                </GlassPanel>
              )}
            </motion.div>

            {/* Right: Gallery */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.18, ease: [0.25, 0.8, 0.25, 1] }}
            >
              <Gallery assets={product.assets} />
            </motion.div>
          </motion.div>

          {/* Insights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{
              duration: 0.18,
              delay: 0.06,
              ease: [0.25, 0.8, 0.25, 1],
            }}
          >
            <InsightsPanel product={product} />
          </motion.div>

          {/* Specifications & Downloads Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            <SpecPanel product={product} />
            <DownloadsPanel product={product} />
          </div>

          {/* Inspiration Grid */}
          <EditorialInspirationGrid items={product.inspiration} />

          {/* Testimonials */}
          <DesignerTestimonials productId={product.id} />

          {/* Related Products */}
          <RelatedFibonacciGrid items={product.related} />
        </div>

        {/* Bottom Spacer for Mobile */}
        <div className="h-8" />
      </div>
    </>
  );
}

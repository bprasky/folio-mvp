"use client";

import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import { Product } from "@/lib/mock/product";
import { CinematicHero } from "./CinematicHero";
import { ActionDock } from "./ActionDock";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Gallery } from "./Gallery";
import { InsightsPanel } from "./InsightsPanel";
import { SpecPanel } from "./SpecPanel";
import { DownloadsPanel } from "./DownloadsPanel";
import CinematicBackground from "./CinematicBackground";
import { motion } from "framer-motion";

// Lazy load heavy components for better performance
const EditorialInspirationGrid = dynamic(
  () => import("./EditorialInspirationGrid").then(mod => ({ default: mod.EditorialInspirationGrid })),
  { ssr: false }
);

const RelatedFibonacciGrid = dynamic(
  () => import("./RelatedFibonacciGrid").then(mod => ({ default: mod.RelatedFibonacciGrid })),
  { ssr: false }
);

interface CinematicProductPageProps {
  product: Product;
}

export function CinematicProductPage({ product }: CinematicProductPageProps) {
  // Prepare hero media
  const heroMedia = {
    videoUrl: product.assets.find(a => a.type === "video")?.src,
    imageUrl: product.assets.find(a => a.type === "image")?.src || product.assets[0]?.src,
  };

  // Extract palette for page-length gradient wash
  const palette = (product as any).palette; // TODO: Add palette to Product type
  
  // Expose palette to audit scripts (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && palette) {
      (window as any).__FOLIO_PRODUCT_PALETTE__ = palette;
    }
  }, [palette]);

  // Dev-only: Visual state audits (diagnostic mode)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // Run visual state audit to diagnose rendering issues
      import('@/scripts/audit-visual-state').then(m => {
        setTimeout(() => {
          m.auditVisualState();
        }, 500); // Wait for DOM to settle
      });
      
      // Run gradient blocker audit to diagnose gradient visibility
      import('@/scripts/audit-gradient-blockers').then(m => {
        setTimeout(() => {
          m.auditGradientBlockers();
        }, 700); // Run after visual state audit
      });
      
      // Run detailed blocker identifier
      import('@/scripts/identify-blockers').then(m => {
        setTimeout(() => {
          m.identifyBlockers();
        }, 900); // Run after blocker audit
      });
      
      // Run FULL diagnostic
      import('@/scripts/full-gradient-diagnostic').then(m => {
        setTimeout(() => {
          m.fullGradientDiagnostic();
        }, 1100); // Run last
      });
      
      // Run CASCADE audit to find conflicting CSS
      import('@/scripts/audit-gradient-cascade').then(m => {
        setTimeout(() => {
          m.auditGradientCascade();
        }, 1300); // Run after full diagnostic
      });
    }
  }, []);

  return (
    <>
      {/* Page-length gradient wash from palette - renders behind everything */}
      <CinematicBackground 
        primary={palette?.primary} 
        accent={palette?.accent} 
      />
      
      <div 
        className="relative bg-transparent"
        data-testid="cinematic-wrapper"
      >
        {/* Full-Bleed Cinematic Hero */}
      <CinematicHero
        media={heroMedia}
        title={product.name}
        brand={product.brand}
        sku={product.sku}
        subtitle={product.description.slice(0, 100)}
        palette={palette}
      />

      {/* Floating Action Dock */}
      <ActionDock product={product} />

      {/* Main Content Container */}
      <div className="relative z-10">
        {/* Editorial Stack - Below the fold */}
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 space-y-16">
          
          {/* Description & Gallery Row - with stagger */}
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.06,
                }
              }
            }}
          >
            {/* Left: Description */}
            <motion.div 
              className="space-y-6"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              transition={{ duration: 0.18, ease: [0.25, 0.8, 0.25, 1] }}
            >
              <GlassPanel
                header={
                  <h2 className="text-lg font-medium text-folio-text-primary dark:text-folio-text-tertiary">
                    About This Product
                  </h2>
                }
              >
                <div className="prose prose-stone dark:prose-invert max-w-none">
                  <p className="text-base leading-relaxed text-folio-text-secondary dark:text-folio-text-tertiary">
                    {product.description}
                  </p>
                  
                  {/* Key Details */}
                  <div className="mt-6 pt-6 border-t border-folio-border-subtle dark:border-folio-border-subtle">
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="font-medium text-folio-text-primary dark:text-folio-text-tertiary">Brand</dt>
                        <dd className="mt-1 text-folio-text-secondary dark:text-folio-text-tertiary">{product.brand}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-folio-text-primary dark:text-folio-text-tertiary">SKU</dt>
                        <dd className="mt-1 font-mono text-xs text-folio-text-secondary dark:text-folio-text-tertiary">{product.sku}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-folio-text-primary dark:text-folio-text-tertiary">Materials</dt>
                        <dd className="mt-1 text-folio-text-secondary dark:text-folio-text-tertiary">{product.materials.join(", ")}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-folio-text-primary dark:text-folio-text-tertiary">Finish</dt>
                        <dd className="mt-1 text-folio-text-secondary dark:text-folio-text-tertiary">{product.finish}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </GlassPanel>
            </motion.div>

            {/* Right: Gallery */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              transition={{ duration: 0.18, ease: [0.25, 0.8, 0.25, 1] }}
            >
              <Gallery assets={product.assets} />
            </motion.div>
          </motion.div>

          {/* Insights - with motion */}
          <motion.div 
            className="lg:pr-80"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.18, delay: 0.06, ease: [0.25, 0.8, 0.25, 1] }}
          >
            <InsightsPanel product={product} />
          </motion.div>

          {/* Specifications & Downloads Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 lg:pr-80">
            <SpecPanel product={product} />
            <DownloadsPanel product={product} />
          </div>

          {/* Inspiration Grid */}
          <div className="lg:pr-80">
            <EditorialInspirationGrid items={product.inspiration} />
          </div>

          {/* Related Products */}
          <div className="lg:pr-80">
            <RelatedFibonacciGrid items={product.related} />
          </div>
        </div>

        {/* Bottom Spacer for Mobile Action Dock */}
        <div className="h-24 lg:hidden" />
      </div>
    </div>
    </>
  );
}

// Helper to convert hex to RGB for gradient
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '0, 0, 0';
}


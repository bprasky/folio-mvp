"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Product } from "@/lib/mock/product";
import { ImmersiveHero } from "./ImmersiveHero";
import { SpecGrid } from "./SpecGrid";
import { DesignerTestimonials } from "./DesignerTestimonials";
import { InContextStrip } from "./InContextStrip";
import { ProcurementBar } from "./ProcurementBar";
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

const VendorIntelligence = dynamic(
  () =>
    import("./VendorIntelligence").then((mod) => ({
      default: mod.VendorIntelligence,
    })),
  { ssr: false }
);

interface ImmersiveProductPageProps {
  product: Product;
  showVendorInsights?: boolean;
  isVendorOwner?: boolean;
}

export function ImmersiveProductPage({
  product,
  showVendorInsights = false,
  isVendorOwner = false,
}: ImmersiveProductPageProps) {
  const heroMedia = {
    videoUrl: product.assets.find((a) => a.type === "video")?.src,
    imageUrl:
      product.assets.find((a) => a.type === "image")?.src ||
      product.assets[0]?.src,
  };

  const palette = (product as any).palette;

  // Determine which sections have data (for conditional rendering)
  const hasDescription = !!product.description;
  const hasInspiration = product.inspiration && product.inspiration.length > 0;
  const hasRelated = product.related && product.related.length > 0;

  // Build the ordered sections array — only sections with data
  // Dividers render between adjacent sections
  const sections: React.ReactNode[] = [];

  // Description (if present, as a simple editorial block)
  if (hasDescription) {
    sections.push(
      <motion.section
        key="description"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.4, ease: [0.25, 0.8, 0.25, 1] }}
      >
        <p
          className="font-body leading-relaxed max-w-2xl"
          style={{
            fontSize: "15px",
            lineHeight: 1.7,
            color: "var(--folio-text-secondary, #6b6b6b)",
          }}
        >
          {product.description}
        </p>
      </motion.section>
    );
  }

  // Spec Grid (always attempted — component handles its own conditional)
  sections.push(<SpecGrid key="specs" product={product} />);

  // In Context Strip (component handles its own conditional via API)
  sections.push(<InContextStrip key="context" productId={product.id} />);

  // Designer Testimonials (component handles its own conditional via API)
  sections.push(<DesignerTestimonials key="testimonials" productId={product.id} />);

  // Vendor Intelligence (only if server-side gate passed)
  if (showVendorInsights) {
    sections.push(<VendorIntelligence key="vendor-insights" productId={product.id} />);
  }

  // Editorial Inspiration Grid
  if (hasInspiration) {
    sections.push(<EditorialInspirationGrid key="inspiration" items={product.inspiration} />);
  }

  // Related Products
  if (hasRelated) {
    sections.push(<RelatedFibonacciGrid key="related" items={product.related} />);
  }

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
        <div className="max-w-3xl mx-auto px-4 lg:px-8 py-12">
          {/* Render sections with dividers between them */}
          {sections.map((section, i) => (
            <React.Fragment key={i}>
              {section}
              {i < sections.length - 1 && (
                <div
                  className="my-10"
                  style={{ borderTop: "0.5px solid var(--folio-border-subtle, #e8e4df)" }}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Bottom spacer for procurement bar */}
        <div className="h-20" />
      </div>

      {/* Sticky Procurement Bar */}
      <ProcurementBar
        productId={product.id}
        productBrand={product.brand}
        isVendorOwner={isVendorOwner}
      />
    </>
  );
}

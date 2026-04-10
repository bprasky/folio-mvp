"use client";

import React from "react";
import { motion } from "framer-motion";
import { Product } from "@/lib/mock/product";

interface SpecGridProps {
  product: Product;
}

/**
 * Flat 2×2 spec card grid + full-width materials row.
 * Replaces the accordion-based SpecPanel with an editorial, at-a-glance layout.
 * Conditionally renders: hidden when brand + dimensions + materials are all empty.
 */
export function SpecGrid({ product }: SpecGridProps) {
  const { brand, dimensions, materials, finish, leadTime } = product;

  const hasDimensions =
    dimensions && (dimensions.w > 0 || dimensions.d > 0 || dimensions.h > 0);
  const hasMaterials = materials && materials.length > 0;
  const hasBrand = !!brand;
  const hasLeadTime = !!leadTime;
  const hasFinish = !!finish;

  // Don't render if nothing to show
  if (!hasBrand && !hasDimensions && !hasMaterials && !hasLeadTime && !hasFinish) {
    return null;
  }

  const dimString = hasDimensions
    ? `${dimensions.w}" × ${dimensions.d}" × ${dimensions.h}"`
    : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.4, ease: [0.25, 0.8, 0.25, 1] }}
    >
      {/* 2×2 Card Grid */}
      <div className="grid grid-cols-2 gap-3">
        {hasBrand && (
          <SpecCard label="Brand" value={brand} />
        )}

        {/* Collection — placeholder for future data */}
        {product.category && (
          <SpecCard label="Collection" value={product.category} link />
        )}

        {hasDimensions && (
          <SpecCard label="Dimensions" value={dimString!} />
        )}

        {(hasLeadTime || !hasDimensions) && hasLeadTime && (
          <LeadTimeCard leadTime={leadTime!} />
        )}

        {!hasLeadTime && hasFinish && (
          <SpecCard label="Finish" value={finish} />
        )}
      </div>

      {/* Full-width Materials Row */}
      {hasMaterials && (
        <div className="mt-3 rounded-lg px-3.5 py-3" style={{ background: "rgba(245, 239, 232, 0.6)" }}>
          <div
            className="font-body mb-2"
            style={{
              fontSize: "10px",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "var(--folio-text-tertiary, #9b9b9b)",
            }}
          >
            Materials
          </div>
          <div className="flex flex-wrap gap-1.5">
            {materials.map((mat, i) => (
              <span
                key={i}
                className="font-body"
                style={{
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "12px",
                  background: "rgba(201, 169, 110, 0.12)",
                  color: "#8a7044",
                  border: "0.5px solid rgba(201, 169, 110, 0.25)",
                }}
              >
                {mat}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}

function SpecCard({
  label,
  value,
  link,
}: {
  label: string;
  value: string;
  link?: boolean;
}) {
  return (
    <div
      className="rounded-lg px-3.5 py-3"
      style={{ background: "rgba(245, 239, 232, 0.6)" }}
    >
      <div
        className="font-body"
        style={{
          fontSize: "10px",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: "var(--folio-text-tertiary, #9b9b9b)",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        className="font-body"
        style={{
          fontSize: "14px",
          fontWeight: 500,
          color: "var(--folio-text-primary, #1a1a1a)",
        }}
      >
        {value}
        {link && (
          <span className="ml-1 text-xs" style={{ color: "var(--folio-text-tertiary, #9b9b9b)" }}>
            →
          </span>
        )}
      </div>
    </div>
  );
}

function LeadTimeCard({ leadTime }: { leadTime: string }) {
  // Parse lead time to determine availability dot color
  const dotColor = getAvailabilityDotColor(leadTime);

  return (
    <div
      className="rounded-lg px-3.5 py-3"
      style={{ background: "rgba(245, 239, 232, 0.6)" }}
    >
      <div
        className="font-body"
        style={{
          fontSize: "10px",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: "var(--folio-text-tertiary, #9b9b9b)",
          marginBottom: "4px",
        }}
      >
        Lead Time
      </div>
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        <span
          className="font-body"
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--folio-text-primary, #1a1a1a)",
          }}
        >
          {leadTime}
        </span>
      </div>
    </div>
  );
}

function getAvailabilityDotColor(leadTime: string): string {
  const lower = leadTime.toLowerCase();
  if (lower.includes("backorder") || lower.includes("unavailable")) {
    return "#A32D2D"; // Red
  }
  // Try to parse weeks
  const weeksMatch = lower.match(/(\d+)\s*[-–]\s*(\d+)\s*week/);
  if (weeksMatch) {
    const maxWeeks = parseInt(weeksMatch[2], 10);
    if (maxWeeks > 12) return "#BA7517"; // Amber
    return "#639922"; // Green
  }
  if (lower.includes("in stock") || lower.includes("ready")) {
    return "#639922"; // Green
  }
  if (lower.includes("made to order") || lower.includes("custom")) {
    return "#BA7517"; // Amber
  }
  return "#639922"; // Default green
}

"use client";

import React from "react";

interface DimensionToggleProps {
  dimensions: { w: number; d: number; h: number; units: "in" | "cm" };
  isActive: boolean;
  onToggle: () => void;
  hudOpacity?: number;
}

/**
 * Frosted glass pill toggle for showing/hiding dimension overlay on the 3D viewport.
 * Positioned bottom-right of the viewport container.
 * Only renders when at least one dimension is non-zero.
 */
export function DimensionToggle({ dimensions, isActive, onToggle, hudOpacity = 1 }: DimensionToggleProps) {
  const hasDimensions = dimensions.w > 0 || dimensions.d > 0 || dimensions.h > 0;
  if (!hasDimensions) return null;

  return (
    <button
      onClick={onToggle}
      className="absolute bottom-4 right-4 z-20 cursor-pointer font-body"
      style={{
        padding: "6px 12px",
        borderRadius: "20px",
        fontSize: 'var(--type-eyebrow)',
        fontWeight: 'var(--w-h1)',
        letterSpacing: "0.3px", /* folio-design-system: off-scale */
        border: "none",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        background: isActive ? "rgba(60, 40, 20, 0.9)" : "rgba(255, 255, 255, 0.85)",
        color: isActive ? "#ffffff" : "#5a4a3a",
        opacity: hudOpacity,
        transition: "opacity 300ms ease-out, background 200ms ease, color 200ms ease",
      }}
      aria-label={isActive ? "Hide dimensions" : "Show dimensions"}
    >
      {isActive ? "Hide Dims" : "Dims"}
    </button>
  );
}

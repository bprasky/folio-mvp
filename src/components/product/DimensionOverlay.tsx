"use client";

import React from "react";

interface DimensionOverlayProps {
  dimensions: { w: number; d: number; h: number; units: "in" | "cm" };
  visible: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

const GOLD = "rgba(201, 169, 110, 0.8)";
const LABEL_BG = "rgba(255, 255, 255, 0.85)";

/**
 * SVG overlay that draws architectural measurement lines on the 3D product viewport.
 * Uses a simplified positioning model (centered on viewport) since we don't have
 * screen-space bounding box data from the 3D renderer yet.
 *
 * When the 3D viewer exposes model bounds in the future, the positioning can be
 * updated to use actual projected coordinates.
 */
export function DimensionOverlay({ dimensions, visible, viewportWidth, viewportHeight }: DimensionOverlayProps) {
  if (!visible) return null;

  const { w, d, h, units } = dimensions;
  const hasDimensions = w > 0 || d > 0 || h > 0;
  if (!hasDimensions) return null;

  const unitLabel = units === "cm" ? "cm" : '"';

  // Estimate model bounds as a centered box — this is an approximation
  // that works until we get real projected bounding box from Three.js
  const cx = viewportWidth / 2;
  const cy = viewportHeight / 2;
  const modelW = viewportWidth * 0.35;
  const modelH = viewportHeight * 0.4;

  const left = cx - modelW / 2;
  const right = cx + modelW / 2;
  const top = cy - modelH / 2;
  const bottom = cy + modelH / 2;

  const capLen = 10;
  const offset = 20;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{
        width: viewportWidth,
        height: viewportHeight,
        zIndex: 15,
        opacity: 1,
        animation: "dimOverlayFadeIn 300ms ease forwards",
      }}
      viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}
    >
      <style>{`
        @keyframes dimOverlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* Width line — horizontal, below model */}
      {w > 0 && (
        <g>
          {/* Left cap */}
          <line x1={left} y1={bottom + offset - capLen/2} x2={left} y2={bottom + offset + capLen/2} stroke={GOLD} strokeWidth={1} />
          {/* Right cap */}
          <line x1={right} y1={bottom + offset - capLen/2} x2={right} y2={bottom + offset + capLen/2} stroke={GOLD} strokeWidth={1} />
          {/* Measurement line */}
          <line x1={left} y1={bottom + offset} x2={right} y2={bottom + offset} stroke={GOLD} strokeWidth={1} strokeDasharray="4 3" />
          {/* Label */}
          <DimensionLabel x={cx} y={bottom + offset} text={`${w}${unitLabel}`} />
        </g>
      )}

      {/* Height line — vertical, right of model */}
      {h > 0 && (
        <g>
          {/* Top cap */}
          <line x1={right + offset - capLen/2} y1={top} x2={right + offset + capLen/2} y2={top} stroke={GOLD} strokeWidth={1} />
          {/* Bottom cap */}
          <line x1={right + offset - capLen/2} y1={bottom} x2={right + offset + capLen/2} y2={bottom} stroke={GOLD} strokeWidth={1} />
          {/* Measurement line */}
          <line x1={right + offset} y1={top} x2={right + offset} y2={bottom} stroke={GOLD} strokeWidth={1} strokeDasharray="4 3" />
          {/* Label */}
          <DimensionLabel x={right + offset} y={cy} text={`${h}${unitLabel}`} />
        </g>
      )}

      {/* Depth line — diagonal, from bottom-right */}
      {d > 0 && (
        <g>
          {/* Diagonal from front-bottom to back-top (45°) */}
          <line
            x1={right + 8}
            y1={bottom + 8}
            x2={right + 8 + modelW * 0.3}
            y2={bottom + 8 - modelW * 0.3}
            stroke={GOLD}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          {/* Caps */}
          <circle cx={right + 8} cy={bottom + 8} r={2} fill={GOLD} />
          <circle cx={right + 8 + modelW * 0.3} cy={bottom + 8 - modelW * 0.3} r={2} fill={GOLD} />
          {/* Label */}
          <DimensionLabel
            x={right + 8 + modelW * 0.15}
            y={bottom + 8 - modelW * 0.15}
            text={`${d}${unitLabel}`}
          />
        </g>
      )}
    </svg>
  );
}

function DimensionLabel({ x, y, text }: { x: number; y: number; text: string }) {
  const padX = 6;
  const padY = 3;
  const charWidth = 6;
  const width = text.length * charWidth + padX * 2;
  const height = 16;

  return (
    <g>
      <rect
        x={x - width / 2}
        y={y - height / 2}
        width={width}
        height={height}
        rx={3}
        fill={LABEL_BG}
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        style={{
          fontSize: 'var(--type-fine)',
          fontWeight: 'var(--w-h1)',
          letterSpacing: 'var(--ls-wide)',
          fill: "rgba(60, 40, 20, 0.9)",
        }}
      >
        {text}
      </text>
    </g>
  );
}

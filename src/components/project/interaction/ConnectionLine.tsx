'use client';

interface ConnectionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  containerWidth: number;
  containerHeight: number;
}

/**
 * Subtle dotted gold line connecting the product's position in the photo
 * to the lifted panel, showing provenance.
 */
export function ConnectionLine({ x1, y1, x2, y2, containerWidth, containerHeight }: ConnectionLineProps) {
  return (
    <svg
      className="absolute inset-0 pointer-events-none z-[8]"
      width={containerWidth}
      height={containerHeight}
      style={{ overflow: 'visible' }}
    >
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#c9a96e"
        strokeOpacity={0.3}
        strokeWidth={1}
        strokeDasharray="4 4"
      />
    </svg>
  );
}

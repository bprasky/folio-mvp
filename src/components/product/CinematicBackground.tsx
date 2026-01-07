'use client';

import { useEffect, useRef } from 'react';

/**
 * Page-length gradient wash using extracted product palette
 * Creates seamless color continuity from hero through entire page
 */

interface CinematicBackgroundProps {
  primary?: string;
  accent?: string;
}

export default function CinematicBackground({ primary, accent }: CinematicBackgroundProps) {
  const ref = useRef<HTMLDivElement>(null);
  
  // Fallback to warm stone tones
  const p = primary || '#d7c9b8';
  const a = accent || '#efeae4';
  
  // Build gradient colors
  const topColor = hex(p, 0.20);     // 20% opacity - more visible
  const midColor = hex(a, 0.15);     // 15% opacity
  const baseColor = 'rgba(255,255,255,0)';
  
  // DEBUG: Check each piece
  console.log('🔍 Debug pieces:', { topColor, midColor, baseColor });
  
  // Create gradient string with explicit 180deg - TEST with string concat instead of template literal
  const gradientImage = 'linear-gradient(180deg, ' + topColor + ' 0%, ' + midColor + ' 32%, ' + baseColor + ' 100%)';
  
  console.log('🎨 Gradient image value:', gradientImage);
  console.log('🔍 Contains 180deg?', gradientImage.includes('180deg'));

  // Use useEffect to set background directly (bypass CSS variable issues)
  useEffect(() => {
    if (ref.current) {
      // Set background-image directly on the DOM element
      ref.current.style.backgroundImage = gradientImage;
      ref.current.style.backgroundColor = 'transparent';
      console.log('✅ Background-image set directly via DOM:', gradientImage);
      
      // Verify it was applied
      setTimeout(() => {
        const computed = getComputedStyle(ref.current!).backgroundImage;
        console.log('🔍 Computed background-image after setting:', computed);
      }, 100);
    }
  }, [gradientImage]);

  return (
    <div
      ref={ref}
      id="folio-cinematic-bg"
      data-testid="cinematic-bg"
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: -10 }}
    />
  );
}

/**
 * Convert hex color to rgba with alpha
 * Supports both #rgb and #rrggbb formats
 */
function hex(h: string, a = 0.06): string {
  const s = h.replace('#', '');
  const to = (x: string) => parseInt(x.length === 1 ? x + x : x, 16);
  const r = to(s.slice(0, s.length === 3 ? 1 : 2));
  const g = to(s.slice(s.length === 3 ? 1 : 2, s.length === 3 ? 2 : 4));
  const b = to(s.slice(s.length === 3 ? 2 : 4, s.length === 3 ? 3 : 6));
  return `rgba(${r},${g},${b},${a})`;
}


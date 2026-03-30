'use client';

/**
 * GlassSurface - Subtle glassmorphic text container
 * 
 * Design philosophy: Like etched glass on a museum placard
 * - Very restrained backdrop blur
 * - Low opacity background
 * - Used ONLY for text overlays, captions, room labels, editorial callouts
 * 
 * ❌ Do NOT apply to entire cards
 * ❌ Do NOT use neon, gradients, or glow
 */
interface GlassSurfaceProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'overlay' | 'standalone';
}

export function GlassSurface({ children, className = '', variant = 'overlay' }: GlassSurfaceProps) {
  const baseClasses = variant === 'overlay'
    ? 'glass-surface glass-surface-sm'
    : 'glass-surface border border-white/40 shadow-sm';
  
  return (
    <div className={`${baseClasses} ${className}`}>
      {children}
    </div>
  );
}


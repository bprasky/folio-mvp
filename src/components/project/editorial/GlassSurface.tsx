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
    ? 'bg-white/60 backdrop-blur-md border border-white/40 shadow-sm' 
    : 'bg-white/80 backdrop-blur-md border border-white/40 shadow-sm';
  
  return (
    <div className={`${baseClasses} ${className}`}>
      {children}
    </div>
  );
}


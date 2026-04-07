"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { GlassPanel } from "@/components/ui/GlassPanel";
import SafeImage from "@/components/common/SafeImage";

interface CinematicHeroProps {
  media: {
    videoUrl?: string;
    imageUrl?: string;
  };
  title: string;
  subtitle?: string;
  brand?: string;
  sku?: string;
  palette?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export function CinematicHero({ media, title, subtitle, brand, sku, palette }: CinematicHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  // Subtle parallax: -4% to +2% range for optical center adjustment
  const y = useTransform(scrollYProgress, [0, 1], ["-4%", "2%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.95, 0.9]);

  // Dynamic gradient from palette (8% opacity)
  const gradientStyle = palette ? {
    background: `linear-gradient(to bottom, 
      ${palette.primary}08, 
      ${palette.secondary}06, 
      ${palette.accent}04
    )`
  } : undefined;

  // Respect prefers-reduced-motion
  const prefersReducedMotion = typeof window !== "undefined" 
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches 
    : false;

  // Mobile gets minimal parallax (1-2%), desktop gets full range
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const mobileY = useTransform(scrollYProgress, [0, 1], ["-1%", "2%"]);

  return (
    <div 
      ref={containerRef}
      className="relative min-h-[80vh] lg:min-h-screen w-full overflow-hidden"
      style={gradientStyle || { background: 'linear-gradient(to bottom, #fafaf9, #f5f5f4, #e7e5e4)' }}
    >
      {/* Media Layer with Parallax */}
      <motion.div
        style={{ 
          y: prefersReducedMotion ? 0 : (isMobile ? mobileY : y),
          opacity: prefersReducedMotion ? 1 : opacity 
        }}
        className="absolute inset-0 w-full h-full"
      >
        {media.videoUrl ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
            poster={media.imageUrl}
          >
            <source src={media.videoUrl} type="video/mp4" />
          </video>
        ) : media.imageUrl ? (
          <div className="relative w-full h-full">
            {/* Use unoptimized to handle external image domains not in next.config */}
            <SafeImage
              src={media.imageUrl}
              alt={title}
              fill
              priority
              unoptimized
              className="object-cover"
              style={{ objectPosition: 'center 45%' }}
              sizes="(min-width: 1024px) 1200px, 100vw"
            />
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-stone-200 to-stone-300" />
            )}
          </motion.div>

      {/* Title Card - Bottom Left */}
      <div 
        className="absolute bottom-8 left-8 right-8 lg:bottom-16 lg:left-16 lg:right-auto lg:max-w-xl z-10"
        data-testid="glass-title-card"
      >
        {/* Conditional text scrim behind card (not dark glass background) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background: needsTextScrim(media.imageUrl) 
              ? 'linear-gradient(180deg, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.00) 60%)'
              : 'transparent'
          }}
        />
        
        <GlassPanel>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            {brand && (
              <div className="text-sm font-medium uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-2">
                {brand}
              </div>
            )}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-headline font-light text-stone-900 dark:text-stone-100 tracking-tight leading-[1.05]">
              {title}
            </h1>
            {(subtitle || sku) && (
              <div className="mt-3 flex items-center gap-3 text-sm md:text-base text-stone-600/90 dark:text-stone-400/90 max-w-prose">
                {subtitle && <span className="line-clamp-2">{subtitle}</span>}
                {subtitle && sku && <span className="text-stone-400">•</span>}
                {sku && <span className="font-mono text-xs tracking-wide">{sku}</span>}
              </div>
            )}
          </motion.div>
        </GlassPanel>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 hidden lg:block"
      >
        <div className="flex flex-col items-center gap-2 text-white/80">
          <span className="text-xs uppercase tracking-wider">Scroll</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="w-px h-8 bg-white/60"
          />
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Simple luminance check to determine if text scrim is needed
 * Returns true if image is likely too bright for legible text
 */
function needsTextScrim(imageUrl?: string): boolean {
  // For now, always apply minimal scrim for safety
  // Can be enhanced with actual image analysis if needed
  return !!imageUrl;
}


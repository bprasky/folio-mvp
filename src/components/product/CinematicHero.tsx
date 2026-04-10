"use client";

import React, { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/ui/GlassPanel";
import SafeImage from "@/components/common/SafeImage";

const Product3DViewer = dynamic(() => import("./Product3DViewer"), {
  ssr: false,
});

interface CinematicHeroProps {
  media: {
    videoUrl?: string;
    imageUrl?: string;
  };
  mesh3dUrl?: string;
  meshColor?: string;
  scenePresetId?: string;
  productCategory?: string;
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

export function CinematicHero({ media, mesh3dUrl, meshColor, scenePresetId, productCategory, title, subtitle, brand, sku, palette }: CinematicHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [show3D, setShow3D] = useState(!!mesh3dUrl);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

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

  // Auto-hide drag hint after 4 seconds
  useEffect(() => {
    if (!show3D || hasInteracted) {
      setHintVisible(false);
      return;
    }
    const timer = setTimeout(() => setHintVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [show3D, hasInteracted]);

  // Reset hint when toggling to 3D
  useEffect(() => {
    if (show3D && !hasInteracted) {
      setHintVisible(true);
    }
  }, [show3D, hasInteracted]);

  return (
    <div
      ref={containerRef}
      className="relative min-h-[80vh] lg:min-h-screen w-full overflow-hidden"
      style={gradientStyle || { background: 'linear-gradient(to bottom, #fafaf9, #f5f5f4, #e7e5e4)' }}
    >
      {/* 3D/Image Toggle Badge */}
      {mesh3dUrl && (
        <button
          onClick={() => setShow3D((prev) => !prev)}
          className="glass-badge absolute top-6 right-6 z-20 cursor-pointer gap-2 px-3 py-1.5"
          aria-label={show3D ? "Switch to image view" : "Switch to 3D view"}
        >
          {show3D ? "Image" : "3D"}
        </button>
      )}

      {/* Media Layer */}
      {show3D && mesh3dUrl ? (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center">
          <Product3DViewer
            glbUrl={mesh3dUrl}
            fallbackImageUrl={media.imageUrl}
            productName={title}
            color={meshColor}
            scenePresetId={scenePresetId}
            productCategory={productCategory}
            onInteraction={() => setHasInteracted(true)}
            className="w-full h-full"
          />

          {/* Drag-to-rotate hint */}
          <AnimatePresence>
            {hintVisible && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.5 }}
                className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
              >
                <span className="text-xs uppercase tracking-wider text-stone-500/80 bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  Drag to rotate
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
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
              <SafeImage
                src={media.imageUrl}
                alt={title}
                fill
                priority
                className="object-cover"
                style={{ objectPosition: 'center 45%' }}
                sizes="(min-width: 1024px) 1200px, 100vw"
              />
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-stone-200 to-stone-300" />
          )}
        </motion.div>
      )}

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

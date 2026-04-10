"use client";

// PhotoTile — Room photo with parallax and product tag dots.
// Rule 1 updated: tag dots are the ONE exception — they mark what's
// physically in the image. Glass overlays, text, gradients, badges
// are still never on photos.
//
// Desktop: tag dots fade in on hover (300ms).
// Mobile: tag dots appear on tap-and-hold (300ms threshold).

import Image from "next/image";
import { useRef, useState, useCallback } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { TaggedImage } from "@/components/project/interaction/TaggedImage";

interface PhotoTileProps {
  imageUrl: string;
  alt: string;
  onClick: () => void;
  onProductClick?: (product: any) => void;
  image?: any; // Full image object with tags for ImageTagDots
  fullWidth?: boolean;
  reducedMotion?: boolean;
  isExpanded?: boolean;
}

export function PhotoTile({
  imageUrl,
  alt,
  onClick,
  onProductClick,
  image,
  fullWidth = false,
  reducedMotion = false,
  isExpanded = false,
}: PhotoTileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [showDots, setShowDots] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const travel = fullWidth ? 40 : 20;
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    reducedMotion ? [0, 0] : [-travel, travel]
  );

  const hasTags = image?.tags?.length > 0;

  // Desktop: hover to show dots
  const handleMouseEnter = useCallback(() => {
    if (hasTags) setShowDots(true);
  }, [hasTags]);
  const handleMouseLeave = useCallback(() => {
    setShowDots(false);
  }, []);

  // Mobile: tap-and-hold to show dots
  const handleTouchStart = useCallback(() => {
    if (!hasTags) return;
    holdTimerRef.current = setTimeout(() => {
      setShowDots(true);
    }, 300);
  }, [hasTags]);
  const handleTouchEnd = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    // Dismiss dots after a short delay (unless user taps a dot)
    if (showDots) {
      setTimeout(() => setShowDots(false), 2000);
    }
  }, [showDots]);

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-[12px] cursor-pointer group"
      style={{
        background: "rgba(87, 75, 67, 0.04)",
      }}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <motion.div
        style={{
          y,
          willChange: "transform",
        }}
      >
        <Image
          src={imageUrl}
          alt={alt}
          width={1200}
          height={800}
          className="w-full h-auto transition-transform duration-300 group-hover:scale-[1.01]"
          sizes={fullWidth ? "100vw" : "(max-width: 768px) 100vw, 50vw"}
        />
      </motion.div>

      {/* Product tag dots — fade in on hover (desktop) or tap-hold (mobile) */}
      {hasTags && (
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            opacity: showDots ? 1 : 0,
            transition: "opacity 300ms ease",
          }}
        >
          <div
            className="pointer-events-auto absolute inset-0"
            onClick={(e) => e.stopPropagation()}
          >
            <TaggedImage image={image} surface="post" />
          </div>
        </div>
      )}
    </div>
  );
}

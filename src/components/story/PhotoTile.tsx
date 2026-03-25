"use client";

// PhotoTile — Pure, unobstructed room photo. Rule 1: Photos Are Sacred.
// Parallax-enabled: scroll-linked translateY for depth effect.
// No children, no overlays, no badges, no text.

import Image from "next/image";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

interface PhotoTileProps {
  imageUrl: string;
  alt: string;
  onClick: () => void;
  fullWidth?: boolean;
  reducedMotion?: boolean;
}

export function PhotoTile({
  imageUrl,
  alt,
  onClick,
  fullWidth = false,
  reducedMotion = false,
}: PhotoTileProps) {
  const ref = useRef<HTMLDivElement>(null);
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

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-[12px] cursor-pointer group"
      style={{ minHeight: fullWidth ? 380 : 300 }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          y,
          top: -travel,
          bottom: -travel,
          willChange: "transform",
        }}
      >
        <Image
          src={imageUrl}
          alt={alt}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-[1.01]"
          sizes={fullWidth ? "100vw" : "(max-width: 768px) 100vw, 50vw"}
        />
      </motion.div>
    </div>
  );
}

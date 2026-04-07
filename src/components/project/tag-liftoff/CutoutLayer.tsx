'use client';

import { motion } from 'framer-motion';

interface CutoutLayerProps {
  sourceImageUrl: string;
  maskUrl: string;
  isLifted: boolean;
}

/**
 * Renders the 2D cutout of a product from a room photo using CSS mask-image.
 * When lifted, the cutout rises with a scale transform, simulating the product
 * being "pulled" from the photo before cross-fading to 3D.
 */
export function CutoutLayer({ sourceImageUrl, maskUrl, isLifted }: CutoutLayerProps) {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none z-[8]"
      style={{
        backgroundImage: `url(${sourceImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        WebkitMaskImage: `url(${maskUrl})`,
        maskImage: `url(${maskUrl})`,
        WebkitMaskSize: 'cover',
        maskSize: 'cover' as any,
      }}
      animate={{
        y: isLifted ? -20 : 0,
        scale: isLifted ? 1.05 : 1,
      }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    />
  );
}

'use client';

import { motion } from 'framer-motion';

interface MaskHighlightProps {
  maskUrl: string;
  isActive: boolean;
}

/**
 * Renders a warm glow highlight over the product mask region of an image.
 * When active, the mask area glows with Folio gold and the rest of the
 * image dims to ~85% brightness.
 *
 * Uses CSS mask-image to composite the highlight over just the product region.
 */
export function MaskHighlight({ maskUrl, isActive }: MaskHighlightProps) {
  return (
    <>
      {/* Dim layer: covers entire image, with mask region cut out */}
      <motion.div
        className="absolute inset-0 pointer-events-none z-[5]"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.15)',
          WebkitMaskImage: `url(${maskUrl})`,
          maskImage: `url(${maskUrl})`,
          WebkitMaskSize: 'cover',
          maskSize: 'cover' as any,
          WebkitMaskComposite: 'exclude',
          maskComposite: 'exclude' as any,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: isActive ? 1 : 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      />

      {/* Glow layer: Folio gold highlight on the product mask region only */}
      <motion.div
        className="absolute inset-0 pointer-events-none z-[6]"
        style={{
          backgroundColor: 'rgba(184, 150, 94, 0.10)',
          WebkitMaskImage: `url(${maskUrl})`,
          maskImage: `url(${maskUrl})`,
          WebkitMaskSize: 'cover',
          maskSize: 'cover' as any,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: isActive ? 1 : 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      />
    </>
  );
}

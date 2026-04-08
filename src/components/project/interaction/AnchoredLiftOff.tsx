'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnchoredPosition } from './useAnchoredPosition';
import { ConnectionLine } from './ConnectionLine';
import { getInteractionTier } from './types';
import type { NormalizedTag } from './types';

const MeshLayer = dynamic(
  () => import('../tag-liftoff/MeshLayer'),
  { ssr: false }
);

interface AnchoredLiftOffProps {
  tag: NormalizedTag;
  imageUrl: string;
  containerRef: React.RefObject<HTMLElement | null>;
  onDismiss: () => void;
  onAddToProject?: () => void;
}

/**
 * Anchored lift-off: product lifts *adjacent* to its position in the photo,
 * connected by a subtle dotted gold line. Photo dims to 85%.
 * Max 30% photo coverage. Auto-rotate 0.3 rpm.
 */
export function AnchoredLiftOff({
  tag,
  imageUrl,
  containerRef,
  onDismiss,
  onAddToProject,
}: AnchoredLiftOffProps) {
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const [meshLoaded, setMeshLoaded] = useState(false);
  const tier = getInteractionTier(tag);

  // Get container dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (el) setContainerRect(el.getBoundingClientRect());
  }, [containerRef]);

  // Calculate anchored position
  const position = useAnchoredPosition(tag, containerRect);

  // Escape key dismisses
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onDismiss]);

  // Scroll-away dismiss: >50% out of viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) onDismiss();
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef, onDismiss]);

  // Click-outside dismiss
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDismiss();
    },
    [onDismiss]
  );

  if (!position || !containerRect) return null;

  return (
    <AnimatePresence>
      {/* Photo dim overlay — 85% brightness */}
      <motion.div
        className="absolute inset-0 z-[5]"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={handleBackdropClick}
      />

      {/* Connection line */}
      <ConnectionLine
        x1={position.connectionLine.x1}
        y1={position.connectionLine.y1}
        x2={position.connectionLine.x2}
        y2={position.connectionLine.y2}
        containerWidth={containerRect.width}
        containerHeight={containerRect.height}
      />

      {/* Lifted panel */}
      <motion.div
        className="absolute z-[12] flex flex-col items-center"
        style={{
          left: position.x,
          top: position.y,
          width: position.width,
          height: position.height,
        }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 3D mesh viewer or 2D cutout */}
        <div className="flex-1 w-full relative">
          {tier === 'full-3d' && tag.mesh3dUrl ? (
            <MeshLayer
              glbUrl={tag.mesh3dUrl}
              isVisible={true}
              onLoaded={() => setMeshLoaded(true)}
            />
          ) : tag.meshMaskUrl ? (
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `url(${imageUrl})`,
                backgroundSize: 'cover',
                WebkitMaskImage: `url(${tag.meshMaskUrl})`,
                maskImage: `url(${tag.meshMaskUrl})`,
                WebkitMaskSize: 'cover',
                maskSize: 'cover' as any,
              }}
            />
          ) : tag.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tag.thumbnailUrl}
              alt={tag.label}
              className="w-full h-full object-contain"
            />
          ) : null}
        </div>

        {/* Product info + actions */}
        <div className="w-full mt-2 text-center">
          <div className="text-sm font-headline text-folio-text-primary truncate">
            {tag.href ? (
              <a href={tag.href} className="hover:underline">
                {tag.label}
              </a>
            ) : (
              tag.label
            )}
          </div>
          {tag.vendorName && (
            <div className="text-[10px] uppercase tracking-[0.16em] text-folio-text-secondary mt-0.5 truncate">
              {tag.vendorName}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-2 flex items-center justify-center gap-2">
            {tag.href && (
              <a
                href={tag.href}
                className="inline-flex items-center justify-center rounded-full border border-folio-border px-3 py-1 text-[10px] font-medium text-folio-text-primary hover:bg-surface-ground transition-colors"
              >
                View
              </a>
            )}
            {tag.productId && onAddToProject && (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1 rounded-full bg-[var(--text-primary)] px-3 py-1 text-[10px] font-medium text-white hover:opacity-90 transition-colors"
                onClick={onAddToProject}
              >
                + Add
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

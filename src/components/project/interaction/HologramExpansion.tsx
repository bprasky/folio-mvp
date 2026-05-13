'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useExpansionPosition } from './useExpansionPosition';
import { HudMenu } from './HudMenu';
import type { NormalizedTag, TagSurface } from './types';
import { recordTagSignal } from '@/lib/intelligence/tag-signals';

const MeshLayer = dynamic(
  () => import('../tag-liftoff/MeshLayer'),
  { ssr: false }
);

interface HologramExpansionProps {
  tag: NormalizedTag;
  imageUrl: string;
  containerRef: React.RefObject<HTMLElement | null>;
  onDismiss: () => void;
  onViewProduct?: () => void;
  onAddToProject?: () => void;
  onSave?: () => void;
  onDownload3D?: () => void;
  isSaved?: boolean;
  isInProject?: boolean;
  surface?: TagSurface;
}

const HOLOGRAM_WIDTH = 240;
const HOLOGRAM_HEIGHT = 280;
const HOLOGRAM_WIDTH_MOBILE = 200;
const HOLOGRAM_HEIGHT_MOBILE = 240;
const LOAD_TIMEOUT = 3000;
const PLACEHOLDER_DELAY = 500;

/**
 * 3D hologram expansion — the "Star Wars effect."
 * Product model materializes from the tag point, floating above the image.
 * Auto-rotates, user can orbit with click-drag (no scroll hijack).
 * Falls back to 2D expansion if GLB fails to load within 3s.
 */
export function HologramExpansion({
  tag,
  imageUrl,
  containerRef,
  onDismiss,
  onViewProduct,
  onAddToProject,
  onSave,
  onDownload3D,
  isSaved = false,
  isInProject = false,
  surface = 'post',
}: HologramExpansionProps) {
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const [meshLoaded, setMeshLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [hudOpen, setHudOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orbitStartTime = useRef<number | null>(null);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const width = isMobile ? HOLOGRAM_WIDTH_MOBILE : HOLOGRAM_WIDTH;
  const height = isMobile ? HOLOGRAM_HEIGHT_MOBILE : HOLOGRAM_HEIGHT;

  // Get container rect
  useEffect(() => {
    const el = containerRef.current;
    if (el) setContainerRect(el.getBoundingClientRect());
  }, [containerRef]);

  const position = useExpansionPosition(
    tag.xPercent,
    tag.yPercent,
    containerRect,
    width,
    height
  );

  // GLB load timeout — fall back to 2D after 3s
  useEffect(() => {
    if (meshLoaded || loadFailed) return;
    const timer = setTimeout(() => {
      if (!meshLoaded) setLoadFailed(true);
    }, LOAD_TIMEOUT);
    return () => clearTimeout(timer);
  }, [meshLoaded, loadFailed]);

  // Placeholder delay — show thumbnail for first 500ms
  useEffect(() => {
    const timer = setTimeout(() => setShowPlaceholder(false), PLACEHOLDER_DELAY);
    return () => clearTimeout(timer);
  }, []);

  // Escape dismiss
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onDismiss]);

  // Click outside dismiss
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onDismiss]);

  // Mouse leave with grace period
  const handleMouseLeave = useCallback(() => {
    graceTimer.current = setTimeout(() => {
      if (!hudOpen) onDismiss();
    }, 400);
  }, [onDismiss, hudOpen]);

  const handleMouseEnter = useCallback(() => {
    if (graceTimer.current) {
      clearTimeout(graceTimer.current);
      graceTimer.current = null;
    }
  }, []);

  // Track orbit interaction for intelligence
  const handleOrbitStart = useCallback(() => {
    orbitStartTime.current = Date.now();
  }, []);

  const handleOrbitEnd = useCallback(() => {
    if (orbitStartTime.current) {
      const duration = Date.now() - orbitStartTime.current;
      recordTagSignal({
        type: 'hologram_interaction',
        productId: tag.productId,
        surface,
        duration,
      });
      orbitStartTime.current = null;
    }
  }, [tag.productId, surface]);

  // Double-click opens product page
  const handleDoubleClick = useCallback(() => {
    if (tag.href) {
      recordTagSignal({
        type: 'product_view_navigate',
        productId: tag.productId,
        surface,
      });
      window.location.href = tag.href;
    }
  }, [tag.href, tag.productId, surface]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (graceTimer.current) clearTimeout(graceTimer.current);
    };
  }, []);

  if (!position) return null;

  // If 3D load failed, fall back — TaggedImage will re-render as 2D card
  if (loadFailed) {
    return null;
  }

  return (
    <>
      {/* Backdrop dim on source image */}
      <motion.div
        className="absolute inset-0 z-[5] pointer-events-none"
        style={{ backgroundColor: 'var(--hologram-backdrop-dim)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      />

      {/* Hologram container */}
      <AnimatePresence>
        <motion.div
          ref={cardRef}
          className="absolute z-[20]"
          style={{
            left: position.left,
            top: position.top,
            width,
            height,
            transformOrigin: position.transformOrigin,
          }}
          initial={{ opacity: 0, scale: 0, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{
            duration: 0.4,
            ease: [0.34, 1.56, 0.64, 1], // overshoot
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleDoubleClick}
        >
          <div
            className="w-full h-full rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: 'var(--tag-expand-bg)',
              backdropFilter: 'blur(var(--tag-expand-blur))',
              WebkitBackdropFilter: 'blur(var(--tag-expand-blur))',
              boxShadow: `var(--tag-expand-shadow), var(--hologram-glow)`,
            }}
          >
            {/* 3D viewer area */}
            <div
              className="flex-1 relative"
              onMouseDown={handleOrbitStart}
              onMouseUp={handleOrbitEnd}
              onTouchStart={handleOrbitStart}
              onTouchEnd={handleOrbitEnd}
            >
              {/* Thumbnail placeholder (first 500ms) */}
              {showPlaceholder && (tag.thumbnailUrl || tag.cutoutImageUrl) && (
                <div className="absolute inset-0 z-[1]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tag.thumbnailUrl || tag.cutoutImageUrl || ''}
                    alt={tag.label}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              {/* 3D mesh */}
              {tag.mesh3dUrl && !showPlaceholder && (
                <MeshLayer
                  glbUrl={tag.mesh3dUrl}
                  isVisible={true}
                  onLoaded={() => setMeshLoaded(true)}
                  autoRotateSpeed={0.3}
                />
              )}

              {/* Loading indicator */}
              {!meshLoaded && !showPlaceholder && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                </div>
              )}

              {/* Ambient glow at base */}
              <div
                className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse at center bottom, rgba(201, 169, 110, 0.12) 0%, transparent 70%)',
                }}
              />
            </div>

            {/* Product info */}
            <div className="px-3 py-2.5 relative flex-shrink-0">
              <div
                className="text-folio-text-primary truncate"
                style={{
                  fontFamily: "var(--font-headline)",
                  fontSize: 'var(--type-body)',
                  fontStyle: 'italic',
                }}
              >
                {tag.label}
              </div>
              {tag.vendorName && (
                <div
                  className="truncate text-folio-text-secondary mt-0.5"
                  style={{
                    fontSize: 'var(--type-eyebrow)',
                    letterSpacing: 'var(--ls-wide)',
                    textTransform: 'uppercase',
                  }}
                >
                  {tag.vendorName}
                </div>
              )}

              {/* HUD trigger */}
              <button
                type="button"
                className="absolute bottom-2.5 right-3 w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-black/5"
                style={{
                  color: 'var(--tag-hud-accent)',
                  fontSize: 'var(--type-h4)',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setHudOpen(!hudOpen);
                }}
                aria-label="Product actions"
              >
                {hudOpen ? '×' : '⊕'}
              </button>
            </div>

            {/* HUD Menu */}
            <HudMenu
              isOpen={hudOpen}
              onClose={() => setHudOpen(false)}
              onViewProduct={onViewProduct}
              onAddToProject={onAddToProject}
              onSave={onSave}
              onDownload3D={tag.mesh3dUrl ? onDownload3D : undefined}
              isSaved={isSaved}
              isInProject={isInProject}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

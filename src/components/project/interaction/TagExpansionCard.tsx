'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useExpansionPosition } from './useExpansionPosition';
import { HudMenu } from './HudMenu';
import type { NormalizedTag } from './types';

interface TagExpansionCardProps {
  tag: NormalizedTag;
  containerRef: React.RefObject<HTMLElement | null>;
  onDismiss: () => void;
  onViewProduct?: () => void;
  onAddToProject?: () => void;
  onSave?: () => void;
  onDownload3D?: () => void;
  isSaved?: boolean;
  isInProject?: boolean;
  usePortal?: boolean; // for feed cards with overflow:hidden
}

const CARD_WIDTH_DESKTOP = 200;
const CARD_WIDTH_MOBILE = 180;
const THUMB_SIZE_DESKTOP = 160;
const THUMB_SIZE_MOBILE = 140;

/**
 * Inline 2D product expansion card — renders within the image container.
 * Replaces the old full-screen ProductExpandModal.
 * Spring animation from tag origin, backdrop blur, HUD menu.
 */
export function TagExpansionCard({
  tag,
  containerRef,
  onDismiss,
  onViewProduct,
  onAddToProject,
  onSave,
  onDownload3D,
  isSaved = false,
  isInProject = false,
  usePortal = false,
}: TagExpansionCardProps) {
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const [hudOpen, setHudOpen] = useState(false);
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Responsive card width
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const cardWidth = isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH_DESKTOP;
  const thumbSize = isMobile ? THUMB_SIZE_MOBILE : THUMB_SIZE_DESKTOP;
  // Estimate card height: thumb + text + hud trigger + padding
  const cardHeight = thumbSize + 80;

  // Get container rect
  useEffect(() => {
    const el = containerRef.current;
    if (el) setContainerRect(el.getBoundingClientRect());
  }, [containerRef]);

  const position = useExpansionPosition(
    tag.xPercent,
    tag.yPercent,
    containerRect,
    cardWidth,
    cardHeight
  );

  // Escape key dismiss
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
    // Delay to avoid dismissing on the same click that opened the card
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onDismiss]);

  // Mouse leave with 400ms grace period
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

  // Cleanup
  useEffect(() => {
    return () => {
      if (graceTimer.current) clearTimeout(graceTimer.current);
    };
  }, []);

  if (!position) return null;

  const cardContent = (
    <AnimatePresence>
      <motion.div
        ref={cardRef}
        className="absolute z-[20]"
        style={{
          left: position.left,
          top: position.top,
          width: cardWidth,
          transformOrigin: position.transformOrigin,
        }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 20,
          duration: 0.25,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'var(--tag-expand-bg)',
            backdropFilter: 'blur(var(--tag-expand-blur))',
            WebkitBackdropFilter: 'blur(var(--tag-expand-blur))',
            boxShadow: 'var(--tag-expand-shadow)',
          }}
        >
          {/* Product thumbnail */}
          {(tag.thumbnailUrl || tag.cutoutImageUrl) && (
            <div
              className="w-full bg-surface-ground"
              style={{ height: thumbSize }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tag.thumbnailUrl || tag.cutoutImageUrl || ''}
                alt={tag.label}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Product info */}
          <div className="px-3 py-2.5 relative">
            <div
              className="text-folio-text-primary truncate"
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: '16px',
                fontStyle: 'italic',
              }}
            >
              {tag.label}
            </div>
            {tag.vendorName && (
              <div
                className="truncate text-folio-text-secondary mt-0.5"
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.12em',
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
                fontSize: '18px',
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
  );

  if (usePortal && typeof document !== 'undefined') {
    return createPortal(cardContent, document.body);
  }

  return cardContent;
}

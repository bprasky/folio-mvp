'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useSaveToProjectFolder } from '@/components/projects/useSaveToProjectFolder';
import SaveToFolderModal from '@/components/projects/SaveToFolderModal';
import { normalizeTags, getInteractionTier } from './types';
import type { NormalizedTag, InteractionLevel } from './types';
import { useMaskHitTest } from './useMaskHitTest';
import { useTaggedImageCursor } from './useTaggedImageCursor';
import { GoldBorderShimmer } from './GoldBorderShimmer';
import { TagTooltip } from './TagTooltip';
import { MobileTapOverlay } from './MobileTapOverlay';
import { MaskHighlight } from '../tag-liftoff/MaskHighlight';
import { ProductExpandModal } from '../tag-liftoff/ProductExpandModal';
import { AnchoredLiftOff } from './AnchoredLiftOff';

interface TaggedImageProps {
  image: any;
  tags?: any[] | null;
  interactionLevel?: InteractionLevel;
  onProductClick?: (tag: NormalizedTag) => void;
}

/**
 * Universal tagged image interaction component.
 * Replaces ImageTagDots with a cursor-driven, mask-based system.
 *
 * No dots, no badges, no overlays at rest.
 * The cursor itself is the interface.
 */
export function TaggedImage({
  image,
  tags: tagsProp,
  interactionLevel = 'full',
  onProductClick,
}: TaggedImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tags = normalizeTags(image, tagsProp);
  const [liftedTag, setLiftedTag] = useState<NormalizedTag | null>(null);
  const [expandTag, setExpandTag] = useState<NormalizedTag | null>(null);
  const [revealDots, setRevealDots] = useState(false);
  const hasRevealed = useRef(false);

  const { openSaveDialog, modalProps } = useSaveToProjectFolder();

  // Brief reveal dots when image scrolls into viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el || hasRevealed.current || !tags.length) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasRevealed.current) {
          hasRevealed.current = true;
          setRevealDots(true);
          setTimeout(() => setRevealDots(false), 2000);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [tags.length]);

  // Mask hit-testing (desktop hover detection)
  const { hitTag, isOverAnyTag, isOverTaggedImage, cursorPosition } = useMaskHitTest(
    containerRef,
    tags
  );

  // Cursor management
  useTaggedImageCursor(containerRef, isOverTaggedImage, isOverAnyTag);

  // Handle click on a product region
  const handleProductClick = useCallback(
    (tag: NormalizedTag) => {
      if (onProductClick) {
        onProductClick(tag);
        return;
      }

      const tier = getInteractionTier(tag);

      if (interactionLevel === 'signal') {
        // Signal mode: no action on click
        return;
      }

      if (tier === 'expand-2d') {
        setExpandTag(tag);
        return;
      }

      if (interactionLevel === 'full' && (tier === 'full-3d' || tier === 'mask-only')) {
        setLiftedTag(tag);
        return;
      }

      // Fallback: navigate to product page
      if (tag.href) {
        window.location.href = tag.href;
      }
    },
    [interactionLevel, onProductClick]
  );

  // Desktop click handler
  const handleContainerClick = useCallback(() => {
    if (hitTag && interactionLevel !== 'signal') {
      handleProductClick(hitTag);
    }
  }, [hitTag, interactionLevel, handleProductClick]);

  const handleAddToProject = useCallback(
    (tag: NormalizedTag) => {
      if (!tag.productId) return;
      openSaveDialog({
        productId: tag.productId,
        source: 'tagged-image-interaction',
      });
    },
    [openSaveDialog]
  );

  const handleDismissLiftOff = useCallback(() => {
    setLiftedTag(null);
  }, []);

  const imageUrl = image?.url || '';

  if (!tags.length) return null;

  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 z-[2]"
        onClick={handleContainerClick}
      >
        {/* Brief reveal dots — appear on scroll-into-view, fade after 2s */}
        {revealDots && tags.map((tag) => (
          <span
            key={`reveal-${tag.id}`}
            className="absolute z-[4] w-1.5 h-1.5 rounded-full bg-white/40 backdrop-blur-sm pointer-events-none"
            style={{
              left: `${tag.xPercent}%`,
              top: `${tag.yPercent}%`,
              transform: 'translate(-50%, -50%)',
              animation: 'revealDot 2s ease-out forwards',
            }}
          />
        ))}

        {/* Gold border shimmer — first encounter per session */}
        <GoldBorderShimmer isActive={isOverTaggedImage} />

        {/* Mask highlight on hover — only in explore/full mode */}
        {hitTag?.meshMaskUrl && interactionLevel !== 'signal' && (
          <MaskHighlight maskUrl={hitTag.meshMaskUrl} isActive={true} />
        )}

        {/* Near-cursor tooltip — explore/full mode */}
        {interactionLevel !== 'signal' && (
          <TagTooltip
            tag={hitTag}
            cursorPosition={cursorPosition}
            containerRef={containerRef}
          />
        )}

        {/* Mobile tap overlay */}
        <MobileTapOverlay tags={tags} onTagTap={handleProductClick} />

        {/* Anchored lift-off — full mode only */}
        {liftedTag && interactionLevel === 'full' && (
          <AnchoredLiftOff
            tag={liftedTag}
            imageUrl={imageUrl}
            containerRef={containerRef}
            onDismiss={handleDismissLiftOff}
            onAddToProject={() => handleAddToProject(liftedTag)}
          />
        )}
      </div>

      {/* 2D product expand modal */}
      {expandTag && (
        <ProductExpandModal
          isOpen={true}
          onClose={() => setExpandTag(null)}
          imageUrl={expandTag.thumbnailUrl || expandTag.cutoutImageUrl}
          name={expandTag.label}
          vendorName={expandTag.vendorName}
          href={expandTag.href}
          productId={expandTag.productId}
          onAddToProject={() => handleAddToProject(expandTag)}
        />
      )}

      {/* Save to Project Modal */}
      {modalProps.productId && (
        <SaveToFolderModal
          isOpen={modalProps.isOpen}
          onClose={modalProps.onClose}
          productId={modalProps.productId}
          eventId={modalProps.eventId}
          eventTitle={modalProps.eventTitle}
          onSuccess={modalProps.onSuccess}
        />
      )}
    </>
  );
}

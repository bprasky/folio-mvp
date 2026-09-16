'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useSaveToProjectFolder } from '@/components/projects/useSaveToProjectFolder';
import SaveToFolderModal from '@/components/projects/SaveToFolderModal';
import { normalizeTags, getInteractionTier } from './types';
import type { NormalizedTag, InteractionLevel, TagSurface } from './types';
import { getProductCompleteness } from './productCompleteness';
import { TagDotOverlay } from './TagDotOverlay';
import { TagExpansionCard } from './TagExpansionCard';
import { MobileTapOverlay } from './MobileTapOverlay';
import { PartialProductPrompt } from './PartialProductPrompt';
import { HologramExpansion } from './HologramExpansion';
import { recordTagSignal } from '@/lib/intelligence/tag-signals';

interface TaggedImageProps {
  image: any;
  tags?: any[] | null;
  interactionLevel?: InteractionLevel;
  surface?: TagSurface;
  onProductClick?: (tag: NormalizedTag) => void;
  usePortal?: boolean; // for feed cards with overflow:hidden
  // Force dots visible regardless of hover state (e.g. when the room is expanded).
  forceDotsVisible?: boolean;
}

/**
 * Universal tagged image interaction component.
 *
 * Tags are invisible until intent. No dots, no shimmer, no custom cursor.
 * Mouse enters image → minimal white dots reveal.
 * Click/dwell a dot → product expansion with HUD menu.
 * 3D products → hologram pop-out.
 */
export function TaggedImage({
  image,
  tags: tagsProp,
  interactionLevel = 'full',
  surface = 'post',
  onProductClick,
  usePortal = false,
  forceDotsVisible = false,
}: TaggedImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const allTags = normalizeTags(image, tagsProp);
  const tags = allTags.filter(t => getProductCompleteness(t) !== 'stub');

  const [dotsVisible, setDotsVisible] = useState(false);
  const [activeTag, setActiveTag] = useState<NormalizedTag | null>(null);
  const [partialTag, setPartialTag] = useState<NormalizedTag | null>(null);

  const { openSaveDialog, modalProps } = useSaveToProjectFolder();

  // Desktop: show dots on mouse enter
  const handleMouseEnter = useCallback(() => {
    setDotsVisible(true);
    recordTagSignal({
      type: 'tagged_image_hover',
      imageId: image?.id,
      surface,
    });
  }, [image?.id, surface]);

  const handleMouseLeave = useCallback(() => {
    setDotsVisible(false);
  }, []);

  // Check container width for compact mode (feed cards)
  const [isCompact, setIsCompact] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (el && el.clientWidth < 200) {
      setIsCompact(true);
    }
  }, []);

  // Handle tag activation (from dot click/dwell or mobile tap)
  const handleTagActivate = useCallback(
    (tag: NormalizedTag) => {
      if (onProductClick) {
        onProductClick(tag);
        return;
      }

      if (interactionLevel === 'signal') return;

      // Partial products → show completion prompt
      const completeness = getProductCompleteness(tag);
      if (completeness === 'partial') {
        setPartialTag(tag);
        return;
      }

      const tier = getInteractionTier(tag);

      recordTagSignal({
        type: 'tag_activated',
        productId: tag.productId,
        surface,
        expansionType: tier === 'full-3d' || tier === 'mask-only' ? '3d' : '2d',
      });

      setActiveTag(tag);
    },
    [interactionLevel, onProductClick, surface]
  );

  const handleDismiss = useCallback(() => {
    if (activeTag) {
      recordTagSignal({
        type: 'tag_dismissed',
        productId: activeTag.productId,
        surface,
      });
    }
    setActiveTag(null);
  }, [activeTag, surface]);

  const handleViewProduct = useCallback(() => {
    if (activeTag?.href) {
      recordTagSignal({
        type: 'product_view_navigate',
        productId: activeTag.productId,
        surface,
      });
      window.location.href = activeTag.href;
    }
  }, [activeTag, surface]);

  const handleAddToProject = useCallback(
    (tag: NormalizedTag) => {
      if (!tag.productId) return;
      recordTagSignal({
        type: 'project_add',
        productId: tag.productId,
        surface,
      });
      openSaveDialog({
        productId: tag.productId,
        source: 'tag_hud',
      });
    },
    [openSaveDialog, surface]
  );

  const handleSave = useCallback(() => {
    if (!activeTag?.productId) return;
    recordTagSignal({
      type: 'product_save',
      productId: activeTag.productId,
      surface,
    });
    fetch('/api/signals/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: activeTag.productId }),
    }).catch(() => {});
  }, [activeTag, surface]);

  const handleDownload3D = useCallback(() => {
    if (!activeTag?.mesh3dUrl) return;
    recordTagSignal({
      type: 'asset_download',
      productId: activeTag.productId,
      surface,
      format: 'glb',
    });
    window.open(activeTag.mesh3dUrl, '_blank');
  }, [activeTag, surface]);

  const imageUrl = image?.url || '';

  if (!tags.length) return null;

  // Determine active tag's interaction tier
  const activeTier = activeTag ? getInteractionTier(activeTag) : null;
  const is3DExpansion = activeTier === 'full-3d' || activeTier === 'mask-only';

  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 z-[2]"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Desktop: tag dots visible on hover */}
        <div className="hidden md:block">
          <TagDotOverlay
            tags={tags}
            visible={(dotsVisible || forceDotsVisible) && !activeTag}
            compact={isCompact}
            onTagActivate={handleTagActivate}
          />
        </div>

        {/* Mobile: tap overlay */}
        <MobileTapOverlay
          tags={tags}
          onTagTap={handleTagActivate}
          forceDotsVisible={forceDotsVisible && !activeTag && !partialTag}
        />

        {/* 2D Product Expansion Card */}
        {activeTag && !is3DExpansion && (
          <TagExpansionCard
            tag={activeTag}
            containerRef={containerRef}
            onDismiss={handleDismiss}
            onViewProduct={activeTag.href ? handleViewProduct : undefined}
            onAddToProject={activeTag.productId ? () => handleAddToProject(activeTag) : undefined}
            onSave={activeTag.productId ? handleSave : undefined}
            onDownload3D={activeTag.mesh3dUrl ? handleDownload3D : undefined}
            usePortal={usePortal}
          />
        )}

        {/* 3D Hologram Expansion */}
        {activeTag && is3DExpansion && interactionLevel === 'full' && (
          <HologramExpansion
            tag={activeTag}
            imageUrl={imageUrl}
            containerRef={containerRef}
            onDismiss={handleDismiss}
            onViewProduct={activeTag.href ? handleViewProduct : undefined}
            onAddToProject={activeTag.productId ? () => handleAddToProject(activeTag) : undefined}
            onSave={activeTag.productId ? handleSave : undefined}
            onDownload3D={activeTag.mesh3dUrl ? handleDownload3D : undefined}
            surface={surface}
          />
        )}
      </div>

      {/* Partial product prompt */}
      {partialTag && (
        <PartialProductPrompt
          isOpen={true}
          onClose={() => setPartialTag(null)}
          tag={partialTag}
          onSaveAnyway={() => {
            handleAddToProject(partialTag);
            setPartialTag(null);
          }}
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

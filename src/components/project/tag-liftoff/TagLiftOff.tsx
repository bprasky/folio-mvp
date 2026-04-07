'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { MaskHighlight } from './MaskHighlight';
import { CutoutLayer } from './CutoutLayer';
import { ProductInfoPanel } from './ProductInfoPanel';

const MeshLayer = dynamic(() => import('./MeshLayer'), { ssr: false });

export type LiftOffState = 'resting' | 'hover' | 'lifted' | 'inspect' | 'dismissing';

export type InteractionTier = 'full-3d' | 'mask-only' | 'tooltip-only' | 'loading';

export interface LiftOffTag {
  id: string;
  label: string;
  href?: string;
  productId?: string;
  vendorName?: string | null;
  thumbnailUrl?: string | null;
  mesh3dUrl?: string | null;
  meshMaskUrl?: string | null;
  meshStatus?: string | null;
  cutoutImageUrl?: string | null;
}

export function getInteractionTier(tag: LiftOffTag): InteractionTier {
  if (tag.meshStatus === 'processing') return 'loading';
  if (tag.mesh3dUrl && tag.meshMaskUrl) return 'full-3d';
  if (tag.meshMaskUrl) return 'mask-only';
  return 'tooltip-only';
}

interface TagLiftOffProps {
  tag: LiftOffTag;
  imageUrl: string;
  isHovered: boolean;
  isLifted: boolean;
  onLift: () => void;
  onDismiss: () => void;
  onAddToProject?: () => void;
}

/**
 * Orchestrates the tag lift-off interaction:
 *   resting → hover (mask highlight) → lifted (cutout rises) → inspect (3D mesh) → dismiss
 *
 * For tags without mesh/mask data, this component renders nothing and the
 * existing tooltip behavior in ImageTagDots takes over.
 */
export function TagLiftOff({
  tag,
  imageUrl,
  isHovered,
  isLifted,
  onLift,
  onDismiss,
  onAddToProject,
}: TagLiftOffProps) {
  const tier = getInteractionTier(tag);
  const [state, setState] = useState<LiftOffState>('resting');
  const [meshLoaded, setMeshLoaded] = useState(false);

  // Sync external hover/lift state into local state machine
  useEffect(() => {
    if (isLifted) {
      if (tier === 'full-3d') {
        setState(meshLoaded ? 'inspect' : 'lifted');
      } else {
        setState('lifted');
      }
    } else if (isHovered) {
      setState('hover');
    } else if (state !== 'resting') {
      setState('dismissing');
      const timer = setTimeout(() => setState('resting'), 400);
      return () => clearTimeout(timer);
    }
  }, [isHovered, isLifted, tier, meshLoaded, state]);

  // Promote to inspect when mesh finishes loading
  useEffect(() => {
    if (meshLoaded && isLifted && state === 'lifted') {
      setState('inspect');
    }
  }, [meshLoaded, isLifted, state]);

  // Escape key dismisses
  useEffect(() => {
    if (!isLifted) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLifted, onDismiss]);

  // tooltip-only tier — render nothing, let ImageTagDots tooltip handle it
  if (tier === 'tooltip-only') return null;

  const showMaskHighlight = state === 'hover' || state === 'lifted' || state === 'inspect';
  const showCutout = (state === 'lifted' || state === 'inspect' || state === 'dismissing') && tag.meshMaskUrl;
  const showMesh = (state === 'inspect' || (state === 'lifted' && tier === 'full-3d')) && tag.mesh3dUrl;
  const showInfoPanel = state === 'lifted' || state === 'inspect';

  return (
    <>
      {/* Mask highlight overlay (on the parent image) */}
      {tag.meshMaskUrl && (
        <MaskHighlight
          maskUrl={tag.meshMaskUrl}
          isActive={showMaskHighlight}
        />
      )}

      {/* Contact shadow where the product was (on the photo) */}
      <AnimatePresence>
        {showCutout && (
          <motion.div
            className="absolute inset-0 pointer-events-none z-[7]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: 'rgba(0,0,0,0.08)',
                WebkitMaskImage: `url(${tag.meshMaskUrl})`,
                maskImage: `url(${tag.meshMaskUrl})`,
                WebkitMaskSize: 'cover',
                maskSize: 'cover' as any,
                filter: 'blur(8px)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2D cutout layer (lifts from photo) */}
      {showCutout && tag.meshMaskUrl && (
        <CutoutLayer
          sourceImageUrl={imageUrl}
          maskUrl={tag.meshMaskUrl}
          isLifted={state === 'lifted' || state === 'inspect'}
        />
      )}

      {/* 3D mesh layer (cross-fades in from cutout) */}
      <AnimatePresence>
        {showMesh && tag.mesh3dUrl && (
          <motion.div
            className="absolute inset-0 z-[10]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <MeshLayer
              glbUrl={tag.mesh3dUrl}
              isVisible={true}
              onLoaded={() => setMeshLoaded(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background blur during inspection */}
      <AnimatePresence>
        {state === 'inspect' && (
          <motion.div
            className="absolute inset-0 pointer-events-none z-[4]"
            style={{ backdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      {/* Product info panel */}
      <AnimatePresence>
        {showInfoPanel && (
          <ProductInfoPanel
            name={tag.label}
            vendorName={tag.vendorName}
            thumbnailUrl={tag.thumbnailUrl}
            href={tag.href}
            productId={tag.productId}
            onAddToProject={onAddToProject}
          />
        )}
      </AnimatePresence>

      {/* Loading indicator for processing tags */}
      {tier === 'loading' && isHovered && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[12]">
          <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
        </div>
      )}
    </>
  );
}

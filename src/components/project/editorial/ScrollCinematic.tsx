'use client';

import { useRef, useMemo, Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useScroll, useTransform, motion } from 'framer-motion';
import { TaggedImage } from '@/components/project/interaction/TaggedImage';
import type { EditorialProjectImage, EditorialTag } from '@/types/editorial';

const ScrollCinematicCanvas = dynamic(() => import('./ScrollCinematicCanvas'), {
  ssr: false,
});

/**
 * Check if an editorial image is eligible for scroll cinematic rendering.
 * Requires 2+ tags with completed 3D meshes. Returns false on mobile.
 */
export function isScrollCinematicEligible(image: EditorialProjectImage): boolean {
  if (typeof window !== 'undefined' && window.innerWidth < 768) return false;
  const meshTags = (image.tags || []).filter(
    (t) => t.mesh3dUrl && t.meshStatus === 'complete'
  );
  return meshTags.length >= 2;
}

/**
 * Determine the cinematic variant based on tag data.
 * - parallaxDrift: 2-3 tags (default)
 * - roomSweep: 4+ tags with significant depth variance
 */
function getCinematicVariant(meshTags: EditorialTag[]): 'parallaxDrift' | 'roomSweep' {
  if (meshTags.length < 4) return 'parallaxDrift';

  const depths = meshTags
    .map((t) => t.meshDepthEstimate ?? 0.5)
    .sort((a, b) => a - b);
  const depthVariance = depths[depths.length - 1] - depths[0];

  return depthVariance > 0.3 ? 'roomSweep' : 'parallaxDrift';
}

interface ScrollCinematicProps {
  image: EditorialProjectImage;
  meshTags: EditorialTag[];
  roomName?: string | null;
}

/**
 * Scroll-driven cinematic that creates a 2.5D parallax experience using
 * the room photo as a backdrop and 3D product meshes positioned at their
 * estimated depths. Scroll drives camera movement for parallax effect.
 *
 * Falls back to static image + tag dots on mobile or when no meshes available.
 */
export function ScrollCinematic({ image, meshTags, roomName }: ScrollCinematicProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Lazy init: only mount Canvas when within 1 viewport
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100% 0px' } // 1 viewport ahead
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  // Take top 8 meshes by confidence
  const topMeshTags = useMemo(() => {
    return [...meshTags]
      .filter((t) => t.mesh3dUrl && t.meshStatus === 'complete')
      .sort((a, b) => (b.meshConfidence ?? 0) - (a.meshConfidence ?? 0))
      .slice(0, 8);
  }, [meshTags]);

  const variant = useMemo(() => getCinematicVariant(topMeshTags), [topMeshTags]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ height: '80vh' }}
    >
      {/* Static fallback — always present for SSR and mobile */}
      <div className="absolute inset-0">
        <Image
          src={image.url}
          alt={image.name || roomName || 'Editorial image'}
          fill
          className="object-cover"
          sizes="100vw"
        />
        {/* Tag dots on static fallback (visible on mobile, hidden when Canvas active) */}
        <div className={isInView && !isMobile ? 'hidden' : ''}>
          <TaggedImage image={image} surface="post" />
        </div>
      </div>

      {/* 3D Canvas — lazy loaded, desktop only */}
      {isInView && !isMobile && topMeshTags.length >= 2 && (
        <div className="absolute inset-0 z-[2]">
          <ScrollCinematicCanvas
            imageUrl={image.url}
            meshTags={topMeshTags}
            variant={variant}
            scrollProgress={scrollYProgress}
          />
        </div>
      )}

      {/* Room name label */}
      {roomName && (
        <div className="absolute bottom-4 left-4 z-10">
          <span className="glass-badge px-3 py-1 text-xs">
            {roomName}
          </span>
        </div>
      )}
    </div>
  );
}

export default ScrollCinematic;

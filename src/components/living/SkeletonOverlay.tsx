'use client';

import { useEffect, useState } from 'react';

interface Bbox {
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
  w: number; // 0-1 normalized
  h: number; // 0-1 normalized
}

interface SkeletonItem {
  id: string;
  bbox: Bbox;
  label: string;
  confidence: number;
  status: 'UNCONFIRMED' | 'CONFIRMED' | 'DISMISSED';
  roomName?: string | null;
}

interface SkeletonOverlayProps {
  imageId: string;
  imageUrl: string;
  enabled: boolean;
  onSkeletonClick?: (skeletonId: string) => void;
  highlightSkeletonId?: string | null;
}

export default function SkeletonOverlay({
  imageId,
  imageUrl,
  enabled,
  onSkeletonClick,
  highlightSkeletonId,
}: SkeletonOverlayProps) {
  const [skeletons, setSkeletons] = useState<SkeletonItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !imageId) {
      setSkeletons([]);
      return;
    }

    async function fetchSkeletons() {
      setLoading(true);
      try {
        const response = await fetch(`/api/living/skeleton?projectImageId=${imageId}`);
        if (response.ok) {
          const data = await response.json();
          // API returns { items } not { skeletonItems }
          const items = data.items || data.skeletonItems || [];
          // Only show UNCONFIRMED skeletons
          const unconfirmed = items.filter(
            (s: SkeletonItem) => s.status === 'UNCONFIRMED'
          );
          setSkeletons(unconfirmed);
        }
      } catch (error) {
        console.error('[SkeletonOverlay] Failed to fetch skeletons:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSkeletons();
  }, [imageId, enabled]);

  if (!enabled || skeletons.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {skeletons.map((skeleton) => {
        const bbox = skeleton.bbox;
        const isHighlighted = highlightSkeletonId === skeleton.id;
        
        // Convert normalized bbox to percentage-based CSS
        const left = `${bbox.x * 100}%`;
        const top = `${bbox.y * 100}%`;
        const width = `${bbox.w * 100}%`;
        const height = `${bbox.h * 100}%`;

        return (
          <div
            key={skeleton.id}
            className={`absolute border-2 rounded-sm transition-all pointer-events-auto cursor-pointer ${
              isHighlighted
                ? 'border-[var(--accent)] bg-[var(--accent)]/20 shadow-lg shadow-blue-500/50'
                : 'border-gray-400/40 bg-[var(--text-tertiary)]/40/5 hover:border-gray-500/60 hover:bg-surface-ground0/10'
            }`}
            style={{
              left,
              top,
              width,
              height,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (onSkeletonClick) {
                onSkeletonClick(skeleton.id);
              }
            }}
            title={`Unconfirmed detail (${(skeleton.confidence * 100).toFixed(0)}% confidence)`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                if (onSkeletonClick) {
                  onSkeletonClick(skeleton.id);
                }
              }
            }}
          />
        );
      })}
    </div>
  );
}


'use client';

import { useMemo } from 'react';
import { MomentResult } from '@/lib/search/searchMoments';
import MomentCard from './MomentCard';

interface SearchMosaicProps {
  moments: MomentResult[];
  scope: 'public' | 'private';
  onMomentClick?: (moment: MomentResult) => void;
  onMomentSave?: (momentId: string) => void;
  onMomentShare?: (momentId: string) => void;
}

type TileSize = 'hero' | 'large' | 'medium' | 'small';

interface SizedMoment {
  moment: MomentResult;
  size: TileSize;
}

/**
 * Editorial mosaic grid with varied tile sizes creating hierarchy
 * First result is hero-sized (the "cover" of the edition)
 * Mix of large, medium, and standard tiles for editorial flow
 */
export default function SearchMosaic({
  moments,
  scope,
  onMomentClick,
  onMomentSave,
  onMomentShare,
}: SearchMosaicProps) {
  // Separate published and unpublished for private scope
  const publishedMoments = scope === 'private' 
    ? moments.filter(m => 'section' in m && m.section === 'published')
    : moments;
  
  const unpublishedMoments = scope === 'private'
    ? moments.filter(m => 'section' in m && m.section === 'unpublished')
    : [];

  // Assign tile sizes for editorial hierarchy
  const sizedMoments = useMemo((): SizedMoment[] => {
    if (publishedMoments.length === 0) return [];
    
    const sized: SizedMoment[] = [];
    
    // First moment is always hero (the "cover")
    sized.push({ moment: publishedMoments[0], size: 'hero' });
    
    // Remaining moments get varied sizes
    const remaining = publishedMoments.slice(1);
    remaining.forEach((moment, index) => {
      // Pattern: large, medium, small, medium, small, medium...
      let size: TileSize;
      const patternIndex = index % 6;
      if (patternIndex === 0) {
        size = 'large';
      } else if (patternIndex === 1 || patternIndex === 3 || patternIndex === 5) {
        size = 'medium';
      } else {
        size = 'small';
      }
      
      sized.push({ moment, size });
    });
    
    return sized;
  }, [publishedMoments]);

  // Get tile size classes for grid
  const getTileSizeClass = (size: TileSize): string => {
    switch (size) {
      case 'hero':
        // Hero spans full width on mobile, 2-3 columns on desktop
        return 'col-span-1 md:col-span-2 lg:col-span-3 row-span-2';
      case 'large':
        // Large spans 2 columns
        return 'col-span-1 md:col-span-2 row-span-1';
      case 'medium':
        // Medium is standard
        return 'col-span-1 row-span-1';
      case 'small':
        // Small is standard but can be visually smaller
        return 'col-span-1 row-span-1';
      default:
        return 'col-span-1 row-span-1';
    }
  };

  return (
    <div className="space-y-12">
      {/* Published Moments - Editorial Mosaic with dense grid fill */}
      {sizedMoments.length > 0 && (
        <div>
          <div className="grid grid-flow-dense grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-[minmax(200px,auto)]">
            {sizedMoments.map(({ moment, size }) => (
              <div
                key={moment.id}
                className={getTileSizeClass(size)}
              >
                <MomentCard
                  moment={moment}
                  onClick={() => onMomentClick?.(moment)}
                  onSave={() => onMomentSave?.(moment.id)}
                  onShare={() => onMomentShare?.(moment.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unpublished Moments Section (Private Scope Only) */}
      {unpublishedMoments.length > 0 && (
        <div className="pt-8 border-t border-[#E0E0E0]">
          <div className="mb-6">
            <h2 className="font-serif text-2xl text-[#1A1A1A] mb-2">
              Draft Moments
            </h2>
            <p className="text-sm text-[#6A6A6A]">
              {unpublishedMoments.length} unpublished {unpublishedMoments.length === 1 ? 'moment' : 'moments'}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr">
            {unpublishedMoments.map((moment) => (
              <div
                key={moment.id}
                className={`${getTileSizeClass(moment.tagCompletionScore)} relative`}
              >
                {/* Draft Badge */}
                <div className="absolute top-2 left-2 z-10 bg-[#9A9A9A] text-white px-2 py-1 rounded text-xs font-medium">
                  Draft
                </div>
                <MomentCard
                  moment={moment}
                  onClick={() => onMomentClick?.(moment)}
                  onSave={() => onMomentSave?.(moment.id)}
                  onShare={() => onMomentShare?.(moment.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {moments.length === 0 && (
        <div className="text-center py-24">
          <p className="text-[#6A6A6A] font-serif text-xl">
            No moments found. Try a different search or lens.
          </p>
        </div>
      )}
    </div>
  );
}


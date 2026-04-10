'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { EditorialCaption } from './EditorialCaption';
import { TaggedImage } from '@/components/project/interaction/TaggedImage';
import type { EditorialProjectImage as ProjectImage } from '@/types/editorial';

interface EditorialSpreadProps {
  image: ProjectImage;
  roomName: string; // Required for spreads (always has a room)
  editorialText: string;
  isHeroAdjacent?: boolean;
  captionAlignment?: 'bottom' | 'center';
}

/**
 * EditorialSpread - Single unified spread container
 * 
 * Features:
 * - Rule-of-thirds layout (8/4 grid = 2/3 image, 1/3 caption)
 * - Image and caption share same container
 * - Desktop: 8/4 grid split (consistent)
 * - Mobile: Stacked with attached caption band
 * - No borders - whitespace + alignment
 */
export function EditorialSpread({ 
  image, 
  roomName, 
  editorialText,
  isHeroAdjacent = false,
  captionAlignment = 'bottom'
}: EditorialSpreadProps) {
  // Dev debug logging
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[EditorialSpread]', {
        imageId: image.id,
        src: image.url,
        roomName,
        orientation: image.orientation || 'unknown',
        hasUrl: !!image.url && image.url.length > 0,
      });
    }
  }, [image.id, image.url, roomName, image.orientation]);

  // Extract products from tags
  const products = image.tags
    ?.filter(tag => tag.product?.name)
    .map(tag => ({
      id: tag.product!.id,
      name: tag.product!.name,
    }))
    .slice(0, 3) || [];
  
  // Determine aspect ratio based on orientation
  const imageAspect = image.orientation === 'portrait' 
    ? 'aspect-[4/5]' 
    : image.orientation === 'square'
    ? 'aspect-square'
    : 'aspect-[16/9]'; // Default to landscape/wide
  
  // Ensure image URL is valid
  const imageUrl = image.url && image.url.trim().length > 0 ? image.url : null;
  
  return (
    <section className="w-full py-10 md:py-14">
      {/* Desktop: Rule-of-Thirds Grid (8/4 = 2/3 image, 1/3 caption) */}
      <div className="hidden md:grid md:grid-cols-12 gap-8 items-end">
        {/* Image Region - 8/12 (2/3) */}
        <div className={`relative ${imageAspect} rounded-2xl overflow-hidden shadow-lg col-span-8`}>
          {imageUrl ? (
            <>
              <Image
                src={imageUrl}
                alt={image.name || roomName || 'Project image'}
                fill
                className="object-cover relative z-0"
                sizes="(max-width: 768px) 100vw, 66vw"
                priority={isHeroAdjacent}
                onError={(e) => {
                  if (process.env.NODE_ENV !== 'production') {
                    console.error('[EditorialSpread] Image load error:', {
                      imageId: image.id,
                      src: imageUrl,
                      roomName,
                    });
                  }
                }}
              />
              {/* Photo Tag Hotspots */}
              {image.tags && image.tags.length > 0 && (
                <TaggedImage image={image} surface="post" />
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface-ground">
              <div className="text-center p-8 text-folio-text-tertiary">
                <p className="folio-ui">Image not available</p>
              </div>
            </div>
          )}
        </div>

        {/* Caption Region - 4/12 (1/3), bottom-aligned */}
        <div className={`col-span-4 ${captionAlignment === 'center' ? 'self-center' : 'self-end'}`}>
          <EditorialCaption
            roomName={roomName}
            text={editorialText}
            products={products}
          />
        </div>
      </div>
      
      {/* Mobile: Stacked with Attached Caption */}
      <div className="md:hidden">
        {/* Image */}
        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-lg mb-0">
          {imageUrl ? (
            <>
              <Image
                src={imageUrl}
                alt={image.name || roomName || 'Project image'}
                fill
                className="object-cover relative z-0"
                sizes="100vw"
              />
              {/* Photo Tag Hotspots */}
              {image.tags && image.tags.length > 0 && (
                <TaggedImage image={image} surface="post" />
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface-ground">
              <div className="text-center p-8 text-folio-text-tertiary">
                <p className="folio-ui">Image not available</p>
              </div>
            </div>
          )}
        </div>

        {/* Caption Band - Directly attached, no gap */}
        <div className="ridge-card rounded-b-2xl -mt-2 relative z-10 px-6 py-5">
          <EditorialCaption
            roomName={roomName}
            text={editorialText}
            products={products}
          />
        </div>
      </div>
    </section>
  );
}


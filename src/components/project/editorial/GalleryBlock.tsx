'use client';

import Image from 'next/image';
import { TaggedImage } from '@/components/project/interaction/TaggedImage';
import type { EditorialProjectImage as ProjectImage } from '@/types/editorial';

interface GalleryBlockProps {
  images: ProjectImage[];
  roomName?: string | null;
}

/**
 * GalleryBlock - Curated gallery of 2-3 images
 * 
 * Features:
 * - 2-3 images max
 * - Asymmetric sizing (no masonry randomness)
 * - Rounded corners
 * - Intentional spacing (magazine rhythm)
 */
export function GalleryBlock({ images, roomName }: GalleryBlockProps) {
  // Limit to 3 images
  const displayImages = images.slice(0, 3);
  
  if (displayImages.length === 0) return null;
  
  // Asymmetric sizing patterns based on count
  const getSizeClass = (index: number, total: number) => {
    if (total === 1) return 'w-full';
    if (total === 2) {
      return index === 0 ? 'w-full md:w-2/3' : 'w-full md:w-1/3';
    }
    // 3 images
    if (index === 0) return 'w-full md:w-2/3';
    if (index === 1) return 'w-full md:w-1/3';
    return 'w-full md:w-1/2';
  };

  return (
    <section className="w-full py-10 md:py-14">
      {/* Room Label (if provided) */}
      {roomName && (
        <div className="mb-6">
          <div className="folio-ui uppercase tracking-wider text-folio-text-secondary">
            {roomName}
          </div>
        </div>
      )}
      
      {/* Gallery Grid */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {displayImages.map((image, index) => (
          <div
            key={image.id}
            className={`relative ${getSizeClass(index, displayImages.length)} aspect-[4/3] rounded-2xl overflow-hidden shadow-md`}
          >
            <Image
              src={image.url}
              alt={image.name || roomName || `Gallery image ${index + 1}`}
              fill
              className="object-cover relative z-0"
              sizes={index === 0 ? "(max-width: 768px) 100vw, 66vw" : "(max-width: 768px) 100vw, 33vw"}
            />
            {/* Photo Tag Hotspots */}
            {image.tags && image.tags.length > 0 && (
              <TaggedImage image={image} surface="post" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}


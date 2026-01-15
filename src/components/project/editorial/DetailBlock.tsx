'use client';

import Image from 'next/image';
import { ImageTagDots } from '@/components/project/ImageTagDots';

interface ProjectImage {
  id: string;
  url: string;
  name?: string | null;
  tags?: Array<{
    id: string;
    x?: number;
    y?: number;
    product?: {
      id: string;
      name: string;
      imageUrl?: string | null;
      primaryImageUrl?: string | null;
      imageUrls?: string[];
      thumbnailUrl?: string | null;
    } | null;
  }>;
}

interface DetailBlockProps {
  image: ProjectImage;
  caption?: string | null;
  roomName?: string | null;
}

/**
 * DetailBlock - Smaller square/rectangular block for detail shots
 * 
 * Reserved for:
 * - Future product callouts
 * - 3D rotating cutouts
 * - Vendor boosts
 * 
 * For now, renders as static image + caption
 */
export function DetailBlock({ image, caption, roomName }: DetailBlockProps) {
  return (
    <section className="w-full py-10 md:py-14 col-span-12 md:col-span-8 md:col-start-3 lg:col-span-6 lg:col-start-4">
      {/* Image */}
      <div className="relative w-full aspect-square md:aspect-[4/3] rounded-2xl overflow-hidden mb-4">
        <Image
          src={image.url}
          alt={image.name || caption || 'Detail image'}
          fill
          className="object-cover relative z-0"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        {/* Photo Tag Hotspots */}
        {image.tags && image.tags.length > 0 && (
          <ImageTagDots image={image} />
        )}
      </div>
      
      {/* Caption */}
      {(caption || roomName) && (
        <div className="text-center space-y-2">
          {roomName && (
            <div className="folio-ui uppercase tracking-wider text-[var(--text-secondary)]">
              {roomName}
            </div>
          )}
          {caption && (
            <p className="folio-ui text-[var(--text-secondary)] italic">
              {caption}
            </p>
          )}
        </div>
      )}
    </section>
  );
}


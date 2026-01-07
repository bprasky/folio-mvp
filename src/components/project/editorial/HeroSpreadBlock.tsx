'use client';

import Image from 'next/image';
import { GlassSurface } from './GlassSurface';
import { ImageTagDots } from '@/components/project/ImageTagDots';

interface ProjectImage {
  id: string;
  url: string;
  name?: string | null;
  room?: string | null;
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

interface Project {
  title: string;
  description?: string | null;
  category?: string | null;
  city?: string | null;
  regionState?: string | null;
}

interface HeroSpreadBlockProps {
  image: ProjectImage;
  project: Project;
  roomName?: string | null;
  showTitle?: boolean;
}

/**
 * HeroSpreadBlock - Full-width hero image with editorial title overlay
 * 
 * Features:
 * - Full-width image
 * - Rounded corners (12-16px)
 * - Optional soft shadow
 * - Glassmorphic overlay for title/room label
 * - Sticky editorial title + project meta
 */
export function HeroSpreadBlock({ image, project, roomName, showTitle = true }: HeroSpreadBlockProps) {
  return (
    <section className="relative w-full py-10 md:py-14">
      {/* Hero Image Container */}
      <div className="relative w-full aspect-[4/3] md:aspect-[16/9] rounded-2xl overflow-hidden">
        <Image
          src={image.url}
          alt={image.name || project.title}
          fill
          className="object-cover relative z-0"
          priority
          sizes="100vw"
        />
        
        {/* Photo Tag Hotspots */}
        {image.tags && image.tags.length > 0 && (
          <ImageTagDots image={image} />
        )}
        
        {/* Glassmorphic Overlay - Bottom */}
        {(showTitle || roomName) && (
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
            <GlassSurface variant="overlay" className="rounded-xl p-4 md:p-6">
              <div className="space-y-2">
                {/* Room Label */}
                {roomName && (
                  <div className="text-xs font-medium uppercase tracking-wider text-neutral-600 mb-2">
                    {roomName}
                  </div>
                )}
                
                {/* Project Title - Only on first hero */}
                {showTitle && (
                  <>
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-light tracking-tight text-neutral-900">
                      {project.title}
                    </h1>
                    
                    {/* Project Meta */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-600 mt-3">
                      {project.category && (
                        <span>{project.category}</span>
                      )}
                      {(project.city || project.regionState) && (
                        <span className="before:content-['•'] before:mr-2">
                          {[project.city, project.regionState].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </GlassSurface>
          </div>
        )}
      </div>
    </section>
  );
}


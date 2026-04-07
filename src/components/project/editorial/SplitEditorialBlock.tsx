'use client';

import Image from 'next/image';
import { GlassSurface } from './GlassSurface';
import { generateEditorialText } from './textHelpers';
import { ImageTagDots } from '@/components/project/ImageTagDots';
import type { EditorialProjectImage as ProjectImage } from '@/types/editorial';

interface SplitEditorialBlockProps {
  image: ProjectImage;
  roomName?: string | null;
  editorialText?: string | null;
  alignment?: 'left' | 'right';
}

/**
 * SplitEditorialBlock - Image on one side, text on the other
 * 
 * Features:
 * - Alternating left/right alignment
 * - Text supports:
 *   - Room name
 *   - 2-4 sentence editorial blurb
 *   - Inline references to tagged products (no pins yet)
 * - Rounded corners
 * - Intentional spacing (magazine rhythm)
 */
export function SplitEditorialBlock({ 
  image, 
  roomName, 
  editorialText,
  alignment = 'left' 
}: SplitEditorialBlockProps) {
  const isLeftAligned = alignment === 'left';
  
  // Extract product names from tags for inline references
  const productNames = image.tags
    ?.filter(tag => tag.product?.name)
    .map(tag => tag.product!.name)
    .slice(0, 3) || [];
  
  // Use provided text or generate with strong fallback (NEVER empty)
  const text = editorialText && editorialText.trim().length > 0
    ? editorialText
    : generateEditorialText(roomName || undefined, null, undefined);

  return (
    <section className="w-full py-10 md:py-14">
      <div className={`flex flex-col ${isLeftAligned ? 'md:flex-row' : 'md:flex-row-reverse'} gap-8 md:gap-12 items-center`}>
        {/* Image Side */}
        <div className="relative w-full md:w-1/2 aspect-[4/3] rounded-2xl overflow-hidden shadow-md">
          <Image
            src={image.url}
            alt={image.name || roomName || 'Project image'}
            fill
            className="object-cover relative z-0"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          {/* Photo Tag Hotspots */}
          {image.tags && image.tags.length > 0 && (
            <ImageTagDots image={image} />
          )}
        </div>
        
        {/* Text Side */}
        <div className="w-full md:w-1/2 space-y-4">
          {/* Room Label - Section Header Style */}
          {roomName && (
            <div className="folio-ui uppercase tracking-wider text-folio-text-secondary mb-2">
              {roomName}
            </div>
          )}

          {/* Editorial Text - Readable Paragraph Style */}
          <div className="prose prose-neutral max-w-none">
            {text.split('\n\n').map((paragraph, idx) => (
              <p key={idx} className="text-base md:text-lg leading-relaxed text-folio-text-primary font-normal mb-4 last:mb-0">
                {paragraph.trim()}
              </p>
            ))}
          </div>

          {/* Tagged Products (Inline References) */}
          {productNames.length > 0 && (
            <div className="pt-4 border-t border-folio-border-subtle">
              <div className="folio-ui text-folio-text-secondary">
                <span className="font-medium">Selections: </span>
                <span className="text-folio-text-secondary">
                  {productNames.join(' • ')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}


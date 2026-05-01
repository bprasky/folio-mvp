/**
 * Horizontal swipeable carousel preview (mobile-first)
 * Matches the new magazine-cover design with quote overlays
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { matchQuotesToImages, extractQuotesWithMetadata } from '@/lib/instagram/matchQuoteToImage';

interface CarouselPreviewProps {
  images: Array<{ id: string; url: string; name?: string | null; room?: string | null }>;
  quotes?: string[];
  projectTitle: string;
  expandedBlocks?: any; // ProjectPost.expandedBlocks
  onCurrentSlideChange?: (index: number) => void; // Callback to expose current slide index
}

export default function CarouselPreview({
  images,
  quotes = [],
  projectTitle,
  expandedBlocks,
  onCurrentSlideChange,
}: CarouselPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Match quotes to images intelligently
  const quoteMatches = (() => {
    if (expandedBlocks) {
      const quotesWithMetadata = extractQuotesWithMetadata(expandedBlocks);
      return matchQuotesToImages(quotesWithMetadata, images);
    } else if (quotes.length > 0) {
      const quotesWithMetadata = quotes.map(text => ({ text }));
      return matchQuotesToImages(quotesWithMetadata, images);
    }
    return new Map<string, string>();
  })();

  // Build slides array: 1 hero + images (with quote overlays) + 1 CTA
  const slides: Array<{ type: 'hero' | 'image' | 'cta'; data?: any; quote?: string }> = [];
  
  // 1. Hero slide (magazine cover)
  const heroImage = images[0];
  if (heroImage) {
    slides.push({ type: 'hero', data: heroImage });
  }
  
  // 2. Image slides with quote overlays
  images.forEach((image) => {
    const quote = quoteMatches.get(image.id);
    slides.push({ type: 'image', data: image, quote });
  });
  
  // 3. CTA slide
  slides.push({ type: 'cta' });
  
  const totalSlides = slides.length;

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const slideWidth = scrollContainerRef.current.clientWidth;
      const index = Math.round(scrollLeft / slideWidth);
      setCurrentIndex(index);
      // Notify parent of current slide change
      if (onCurrentSlideChange) {
        onCurrentSlideChange(index);
      }
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const goToSlide = (index: number) => {
    if (scrollContainerRef.current) {
      const slideWidth = scrollContainerRef.current.clientWidth;
      scrollContainerRef.current.scrollTo({
        left: index * slideWidth,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="w-full">
      {/* Carousel Container */}
      <div
        ref={scrollContainerRef}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {slides.map((slide, index) => {
          if (slide.type === 'hero') {
            const image = slide.data;
            return (
              <div key={`hero-${index}`} className="min-w-full snap-center flex-shrink-0">
                <div className="relative w-full aspect-[4/5] rounded-lg overflow-hidden border" style={{ borderColor: '#E8E4DE', borderWidth: '1px' }}>
                  <Image
                    src={image.url}
                    alt={projectTitle}
                    fill
                    className="object-cover"
                    sizes="100vw"
                    unoptimized
                  />
                  {/* Title overlay (top-left) - Updated: stronger shadow, top 15% */}
                  <div className="absolute left-0 p-6" style={{ top: '15%' }}>
                    <h2 className="text-6xl md:text-7xl font-serif font-semibold text-white" style={{ 
                      textShadow: '0 6px 30px rgba(0,0,0,0.5)',
                      fontSize: 'clamp(3rem, 8vw, 8.75rem)' // ~120-140px range
                    }}>
                      {projectTitle.split(' ').slice(0, 3).join(' ')}
                    </h2>
                    {projectTitle.split(' ').length > 3 && (
                      <h2 className="text-6xl md:text-7xl font-serif font-semibold text-white mt-2" style={{ 
                        textShadow: '0 6px 30px rgba(0,0,0,0.5)',
                        fontSize: 'clamp(3rem, 8vw, 8.75rem)' // ~120-140px range
                      }}>
                        {projectTitle.split(' ').slice(3).join(' ')}
                      </h2>
                    )}
                  </div>
                  {/* Folio wordmark (bottom-right) - Updated: 12px gray, 40% opacity */}
                  <div className="absolute bottom-0 right-0 p-6">
                    <p className="text-xs font-serif tracking-wider" style={{ 
                      color: 'rgba(128,128,128,0.4)',
                      fontSize: 'var(--type-meta)'
                    }}>
                      FOLIO
                    </p>
                  </div>
                </div>
              </div>
            );
          }
          
          if (slide.type === 'image') {
            const image = slide.data;
            const quote = slide.quote;
            
            // Split quote into lines if present
            const quoteLines: string[] = [];
            if (quote) {
              const words = quote.split(' ');
              let currentLine = '';
              for (const word of words) {
                if ((currentLine + ' ' + word).length <= 35) {
                  currentLine = currentLine ? currentLine + ' ' + word : word;
                } else {
                  if (currentLine) quoteLines.push(currentLine);
                  currentLine = word;
                }
              }
              if (currentLine) quoteLines.push(currentLine);
            }
            
            return (
              <div key={`image-${image.id}-${index}`} className="min-w-full snap-center flex-shrink-0">
                <div className="relative w-full aspect-[4/5] bg-surface-ground rounded-lg overflow-hidden border" style={{ borderColor: '#E8E4DE', borderWidth: '1px' }}>
                  <Image
                    src={image.url}
                    alt={image.name || 'Project image'}
                    fill
                    className="object-contain"
                    sizes="100vw"
                    unoptimized
                  />
                  
                  {/* Quote overlay (if present) - Floating elegant text, no background box */}
                  {quote && quoteLines.length > 0 && (
                    <div className="absolute left-0 right-0 flex items-center justify-center" style={{ bottom: '30%', paddingBottom: '40px' }}>
                      <p 
                        className="font-serif italic text-center max-w-[90%]"
                        style={{ 
                          fontSize: 'clamp(3.5rem, 4.5vw, 4rem)', // 56-64px range
                          lineHeight: 'var(--lh-h3)',
                          color: '#FFFAF5', // Off-white for better visibility
                          textShadow: '0 8px 30px rgba(0,0,0,0.35)',
                          letterSpacing: '0.75px' /* folio-design-system: off-scale */
                        }}
                      >
                        {quoteLines.map((line, i) => (
                          <span key={i}>
                            {line}
                            {i < quoteLines.length - 1 && <br />}
                          </span>
                        ))}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          }
          
          if (slide.type === 'cta') {
            return (
              <div key={`cta-${index}`} className="min-w-full snap-center flex-shrink-0">
                <div className="relative w-full aspect-[4/5] bg-surface-ground rounded-lg flex items-center justify-center border" style={{ borderColor: '#E8E4DE', borderWidth: '1px' }}>
                  <div className="text-center">
                    {/* Center: "Explore the full feature on Folio" in large serif */}
                    <h3 className="text-4xl md:text-5xl font-serif font-semibold mb-2" style={{ color: '#1A1A1A' }}>
                      Explore the full feature
                    </h3>
                    <h3 className="text-4xl md:text-5xl font-serif font-semibold mb-6" style={{ color: '#1A1A1A' }}>
                      on Folio
                    </h3>
                    {/* Below: shortlink in medium gray */}
                    <p className="text-2xl text-folio-text-secondary mb-8">folio.com/p/[slug]</p>
                    
                    {/* Folio wordmark bottom-left (same style as cover) */}
                    <p className="text-xs font-serif tracking-wider absolute bottom-6 left-6" style={{ 
                      color: 'rgba(128,128,128,0.4)',
                      fontSize: 'var(--type-meta)'
                    }}>
                      FOLIO
                    </p>
                  </div>
                </div>
              </div>
            );
          }
          
          return null;
        })}
      </div>

      {/* Navigation Dots */}
      <div className="flex justify-center gap-2 mt-4 flex-wrap">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`h-2 rounded-full transition-all ${
              index === currentIndex
                ? 'w-8 bg-[var(--accent)]'
                : 'w-2 bg-[var(--text-tertiary)]/30 hover:bg-[var(--text-tertiary)]/30'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      <p className="text-xs text-folio-text-secondary text-center mt-2">
        Slide {currentIndex + 1} of {totalSlides}
      </p>
    </div>
  );
}

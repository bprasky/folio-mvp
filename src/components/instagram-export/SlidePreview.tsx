'use client';

import { CarouselHero } from './CarouselHero';

import type { AspectRatio } from '@/lib/instagram-export/generate-images';
import type { SlideData } from './InstagramExportEditor';
import type { HeadlinePosition, WatermarkStyle } from '@/lib/instagram-export/svg-templates';

interface Props {
  aspectRatio: AspectRatio;
  slides: SlideData[];
  activeIndex: number;
  onSelectSlide: (index: number) => void;
  headline: string;
  headlinePosition: HeadlinePosition;
  watermarkStyle: WatermarkStyle;
  designerName: string;
  designerTitle?: string;
  studioName?: string;
  bioText: string;
  projectName: string;
  designerPhoto?: string;
  caption: string;
  designerHandle?: string;
}

function getWatermarkText(style: WatermarkStyle, designerName: string): string {
  switch (style) {
    case 'folio_x':
      return `folio \u00D7 ${designerName}`;
    case 'folio_presents':
      return `folio presents ${designerName}`;
    case 'minimal':
    default:
      return 'folio';
  }
}

// Noise texture SVG for subtle grain
const NOISE_TEXTURE = "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function SlidePreview({
  aspectRatio,
  slides,
  activeIndex,
  onSelectSlide,
  headline,
  headlinePosition,
  watermarkStyle,
  designerName,
  designerTitle,
  studioName,
  bioText,
  projectName,
  designerPhoto,
  caption,
  designerHandle,
}: Props) {
  const slide = slides[activeIndex];
  if (!slide) return null;

  const watermarkText = getWatermarkText(watermarkStyle, designerName);
  const handle = designerHandle || designerName.replace(/\s+/g, '');

  const renderSlide = () => {
    // Bio slide
    if (slide.type === 'bio') {
      return (
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg, #F5F0EB 0%, #EDE6DD 40%, #E4DBD0 100%)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: NOISE_TEXTURE }} />
          {/* Photo area */}
          <div style={{ flex: '0 0 45%', position: 'relative', overflow: 'hidden' }}>
            {designerPhoto ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={designerPhoto} alt={designerName} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              </>
            ) : (
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #C4B5A0 0%, #9B8B75 50%, #7B6B55 100%)' }} />
            )}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(0deg, #F5F0EB 0%, transparent 100%)' }} />
          </div>
          {/* Text content */}
          <div style={{ flex: 1, padding: '0 28px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', position: 'relative', zIndex: 1 }}>
            <div style={{ fontFamily: "var(--font-headline)", fontSize: 'var(--type-h4)', color: '#2C2420', marginBottom: '3px', letterSpacing: 'var(--ls-wide)' }}>
              {designerName}
            </div>
            <div style={{ fontFamily: "'Helvetica Neue', sans-serif", fontSize: '9px', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#A89880', marginBottom: '16px' }}> {/* folio-design-system: off-scale */}
              {designerTitle ? `${designerTitle} · ` : ''}{studioName || ''}
            </div>
            <div style={{ width: '32px', height: '1px', background: '#C4B5A0', marginBottom: '16px' }} />
            <div style={{ fontFamily: "var(--font-headline)", fontSize: 'var(--type-meta)', lineHeight: 1.65, color: '#4A3F35', fontStyle: 'italic' }}> {/* folio-design-system: off-scale */}
              {bioText || 'Designer bio will appear here...'}
            </div>
          </div>
          {/* Watermark */}
          <div style={{ position: 'absolute', bottom: '16px', right: '20px', zIndex: 2 }}>
            <div style={{ fontFamily: "'Helvetica Neue', sans-serif", fontSize: '7px', letterSpacing: '2.5px', color: 'rgba(139,123,104,0.5)', textTransform: 'lowercase' }}> {/* folio-design-system: off-scale */}
              {watermarkText}
            </div>
          </div>
        </div>
      );
    }

    // CTA slide
    if (slide.type === 'cta') {
      return (
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #F5F0EB 0%, #EDE6DD 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{ fontFamily: "var(--font-headline)", fontSize: 'var(--type-ui)', letterSpacing: '3px', color: '#4A3F35', textTransform: 'uppercase', marginBottom: '20px' }}> {/* folio-design-system: off-scale */}
            Full Editorial
          </div>
          <div style={{ fontFamily: "var(--font-headline)", fontSize: 'var(--type-h3)', color: '#2C2420', marginBottom: '8px', fontStyle: 'italic' }}>
            folio
          </div>
          <div style={{ width: '40px', height: '1px', background: '#4A3F35', margin: '16px 0' }} />
          <div style={{ fontFamily: "'Helvetica Neue', sans-serif", fontSize: 'var(--type-eyebrow)', letterSpacing: 'var(--ls-eyebrow)', color: '#8B7B68', textTransform: 'uppercase' }}>
            {projectName}
          </div>
          <div style={{ fontFamily: "'Helvetica Neue', sans-serif", fontSize: 'var(--type-fine)', letterSpacing: 'var(--ls-wide)', color: '#A89880', textTransform: 'uppercase', marginTop: '6px' }}>
            by {designerName}
          </div>
          <div style={{ position: 'absolute', bottom: '24px', fontFamily: "'Helvetica Neue', sans-serif", fontSize: '9px', letterSpacing: 'var(--ls-wide)', color: '#B8A898', textTransform: 'uppercase' }}> {/* folio-design-system: off-scale */}
            folioad.com
          </div>
        </div>
      );
    }

    // Reuse the feed's exact first-slide composition.
    if (slide.type === 'hero') return <CarouselHero imageUrl={slide.imageUrl} headline={headline || 'Your headline here'} headlinePosition={headlinePosition} watermarkText={watermarkText} aspectRatio={aspectRatio} />;

    return (
      <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
        {slide.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.imageUrl} alt={slide.type} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #9B8B75 0%, #7B6B55 50%, #5A4F45 100%)' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.06, backgroundImage: NOISE_TEXTURE }} />
          </div>
        )}
        {slide.type === 'detail' && (
          <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 2 }}>
            <div style={{ fontFamily: "'Helvetica Neue', sans-serif", fontSize: '8px', letterSpacing: '2.5px', color: 'rgba(255,255,255,0.45)', textTransform: 'lowercase' }}> {/* folio-design-system: off-scale */}
              {watermarkText}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ width: '100%', maxWidth: '340px', minWidth: 0, overflowWrap: 'anywhere' }}>
      {/* Instagram phone frame */}
      <div style={{ background: '#FFFFFF', borderRadius: '12px', boxShadow: '0 4px 24px rgba(44,36,32,0.08), 0 1px 4px rgba(44,36,32,0.04)', overflow: 'hidden', border: '1px solid #EDE6DD' }}>
        {/* Instagram header */}
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #C4B5A0, #8B7B68)', overflow: 'hidden', flexShrink: 0 }}>
            {designerPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={designerPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
          <div>
            <div style={{ fontSize: 'var(--type-meta)', fontWeight: 'var(--w-stat)', color: '#2C2420' }}>{handle}</div>
            <div style={{ fontSize: 'var(--type-fine)', color: '#A89880' }}>{projectName}</div>
          </div>
        </div>

        {/* Active slide */}
        <div style={{ width: '100%', aspectRatio: aspectRatio.replace(':', ' / '), position: 'relative', overflow: 'hidden' }}>
          {renderSlide()}
        </div>

        {/* Dots navigation */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', padding: '12px' }}>
          {slides.map((_, i) => (
            <button
              key={i}
              aria-label={`View slide ${i + 1}`}
              aria-current={i === activeIndex ? 'true' : undefined}
              onClick={() => onSelectSlide(i)}
              style={{
                width: i === activeIndex ? '16px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: i === activeIndex ? '#2C2420' : '#D4C9BC',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                padding: 0,
              }}
            />
          ))}
        </div>

        {/* Caption preview */}
        {caption && (
          <div style={{ padding: '8px 16px 16px', borderTop: '1px solid #F0EBE4' }}>
            <div style={{ fontSize: 'var(--type-meta)', lineHeight: 'var(--lh-body)', color: '#4A3F35' }}>
              <span style={{ fontWeight: 'var(--w-stat)' }}>{handle}</span>{' '}
              {caption.length > 120 ? `${caption.substring(0, 120)}…` : caption}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import type { SlideData } from './InstagramExportEditor';

interface Props {
  slides: SlideData[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

const SLIDE_LABELS: Record<string, string> = {
  hero: 'Hero + Headline',
  detail: 'Detail Shot',
  bio: 'Designer Bio',
  cta: 'CTA Slide',
};

const SLIDE_BG: Record<string, string> = {
  hero: 'linear-gradient(135deg, #8B7355, #4A3F35)',
  detail: 'linear-gradient(160deg, #9B8B75, #5A4F45)',
  bio: 'linear-gradient(160deg, #F5F0EB, #E4DBD0)',
  cta: 'linear-gradient(135deg, #F5F0EB, #EDE6DD)',
};

export function SlideThumbnails({ slides, activeIndex, onSelect }: Props) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginTop: '16px', paddingLeft: '2px' }}>
      {slides.map((slide, i) => {
        const isLight = slide.type === 'bio' || slide.type === 'cta';
        return (
          <button
            key={`${slide.type}-${i}`}
            onClick={() => onSelect(i)}
            style={{
              width: '64px',
              height: '80px',
              borderRadius: '4px',
              overflow: 'hidden',
              border: i === activeIndex ? '2px solid #2C2420' : '2px solid transparent',
              cursor: 'pointer',
              padding: 0,
              position: 'relative',
              transition: 'border-color 0.2s',
              flexShrink: 0,
            }}
          >
            {slide.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.imageUrl}
                alt={`Slide ${i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', background: SLIDE_BG[slide.type] || SLIDE_BG.detail }} />
            )}
            <div
              style={{
                position: 'absolute',
                bottom: '3px',
                left: 0,
                right: 0,
                textAlign: 'center',
                fontSize: '6px', /* folio-design-system: off-scale */
                letterSpacing: 'var(--ls-wide)',
                color: isLight ? '#6B5B48' : 'rgba(255,255,255,0.8)',
                textTransform: 'uppercase',
              }}
            >
              {SLIDE_LABELS[slide.type] || slide.type}
            </div>
          </button>
        );
      })}
    </div>
  );
}

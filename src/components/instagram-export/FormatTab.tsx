'use client';

import type { AspectRatio } from '@/lib/instagram-export/generate-images';
import type { HeadlinePosition, WatermarkStyle } from '@/lib/instagram-export/svg-templates';

interface Props {
  aspectRatio: AspectRatio;
  setAspectRatio: (v: AspectRatio) => void;
  watermarkStyle: WatermarkStyle;
  setWatermarkStyle: (v: WatermarkStyle) => void;
  headlinePosition: HeadlinePosition;
  setHeadlinePosition: (v: HeadlinePosition) => void;
  slideCount: 3 | 4 | 5;
  setSlideCount: (v: 3 | 4 | 5) => void;
  images: { id: string; url: string; name: string | null; room: string | null }[];
  selectedImageUrls: string[];
  setSelectedImageUrls: (urls: string[]) => void;
}

const WATERMARK_OPTIONS: { value: WatermarkStyle; label: string; description: string }[] = [
  { value: 'folio_x', label: 'folio \u00D7 name', description: 'Classic collaboration credit' },
  { value: 'folio_presents', label: 'a folio editorial', description: 'Editorial series branding' },
  { value: 'minimal', label: 'folio', description: 'Clean minimal mark' },
];

const ASPECT_OPTIONS: { value: AspectRatio; label: string; description: string }[] = [
  { value: '4:5', label: '4:5 Portrait', description: 'Recommended for feed' },
  { value: '1:1', label: '1:1 Square', description: 'Classic grid format' },
  { value: '9:16', label: '9:16 Story', description: 'Full-screen stories' },
];

const POSITION_OPTIONS: { value: HeadlinePosition; label: string }[] = [
  { value: 'bottom_left', label: 'Bottom Left' },
  { value: 'bottom_center', label: 'Bottom Center' },
  { value: 'top_left', label: 'Top Left' },
];

export function FormatTab({
  aspectRatio,
  setAspectRatio,
  watermarkStyle,
  setWatermarkStyle,
  headlinePosition,
  setHeadlinePosition,
  slideCount,
  setSlideCount,
  images,
  selectedImageUrls,
  setSelectedImageUrls,
}: Props) {
  const toggleImage = (url: string) => {
    if (selectedImageUrls.includes(url)) {
      if (selectedImageUrls.length > 1) {
        setSelectedImageUrls(selectedImageUrls.filter((u) => u !== url));
      }
    } else {
      setSelectedImageUrls([...selectedImageUrls, url]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Watermark Style */}
      <div>
        <div style={{ fontSize: 'var(--type-eyebrow)', letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase' as const, color: '#8B7B68', marginBottom: '12px', fontWeight: 'var(--w-h1)' }}>
          Watermark Style
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {WATERMARK_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setWatermarkStyle(opt.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '10px',
                border: watermarkStyle === opt.value ? '1.5px solid #C4B5A0' : '1px solid #E8E0D8',
                background: watermarkStyle === opt.value ? '#FAF7F4' : '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left' as const,
              }}
            >
              {/* Radio dot */}
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: watermarkStyle === opt.value ? '2px solid #2C2420' : '2px solid #D4C9BC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {watermarkStyle === opt.value && (
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2C2420' }} />
                )}
              </div>
              <div>
                <div style={{ fontSize: 'var(--type-ui)', color: '#2C2420', fontWeight: 'var(--w-h1)' }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 'var(--type-meta)', color: '#A89880', marginTop: '2px' }}>
                  {opt.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Aspect Ratio */}
      <div>
        <div style={{ fontSize: 'var(--type-eyebrow)', letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase' as const, color: '#8B7B68', marginBottom: '12px', fontWeight: 'var(--w-h1)' }}>
          Aspect Ratio
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {ASPECT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setAspectRatio(opt.value)}
              style={{
                flex: 1,
                padding: '10px 8px',
                borderRadius: '10px',
                border: aspectRatio === opt.value ? '1.5px solid #C4B5A0' : '1px solid #E8E0D8',
                background: aspectRatio === opt.value ? '#FAF7F4' : '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center' as const,
              }}
            >
              <div style={{ fontSize: 'var(--type-meta)', color: '#2C2420', fontWeight: 'var(--w-h1)' }}>
                {opt.label}
              </div>
              <div style={{ fontSize: 'var(--type-eyebrow)', color: '#A89880', marginTop: '2px' }}>
                {opt.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Headline Position */}
      <div>
        <div style={{ fontSize: 'var(--type-eyebrow)', letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase' as const, color: '#8B7B68', marginBottom: '12px', fontWeight: 'var(--w-h1)' }}>
          Headline Position
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {POSITION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setHeadlinePosition(opt.value)}
              style={{
                flex: 1,
                padding: '10px 8px',
                borderRadius: '10px',
                border: headlinePosition === opt.value ? '1.5px solid #C4B5A0' : '1px solid #E8E0D8',
                background: headlinePosition === opt.value ? '#FAF7F4' : '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: 'var(--type-meta)',
                color: headlinePosition === opt.value ? '#2C2420' : '#8B7B68',
                fontWeight: 'var(--w-h1)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Carousel Length */}
      <div>
        <div style={{ fontSize: 'var(--type-eyebrow)', letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase' as const, color: '#8B7B68', marginBottom: '12px', fontWeight: 'var(--w-h1)' }}>
          Carousel Length
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {([3, 4, 5] as const).map((count) => (
            <button
              key={count}
              onClick={() => setSlideCount(count)}
              style={{
                flex: 1,
                padding: '10px 8px',
                borderRadius: '10px',
                border: slideCount === count ? '1.5px solid #C4B5A0' : '1px solid #E8E0D8',
                background: slideCount === count ? '#FAF7F4' : '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: 'var(--type-meta)',
                color: slideCount === count ? '#2C2420' : '#8B7B68',
                fontWeight: 'var(--w-h1)',
              }}
            >
              {count} slides
            </button>
          ))}
        </div>
      </div>

      {/* Image Selection */}
      <div>
        <div style={{ fontSize: 'var(--type-eyebrow)', letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase' as const, color: '#8B7B68', marginBottom: '12px', fontWeight: 'var(--w-h1)' }}>
          Images ({selectedImageUrls.length} selected)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {images.map((img) => {
            const isSelected = selectedImageUrls.includes(img.url);
            return (
              <button
                key={img.id}
                onClick={() => toggleImage(img.url)}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  overflow: 'hidden',
                  borderRadius: '8px',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  outline: isSelected ? '2px solid #2C2420' : '1px solid #E8E0D8',
                  outlineOffset: '1px',
                  opacity: isSelected ? 1 : 0.5,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.name || 'Project image'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#2C2420',
                    color: '#FFFFFF',
                    fontSize: 'var(--type-fine)',
                    fontWeight: 700, /* folio-design-system: off-scale */
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {selectedImageUrls.indexOf(img.url) + 1}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

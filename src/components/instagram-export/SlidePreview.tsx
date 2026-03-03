'use client';

import type { SlideData } from './InstagramExportEditor';
import type { AspectRatio } from '@/lib/instagram-export/generate-images';
import type { HeadlinePosition, WatermarkStyle } from '@/lib/instagram-export/svg-templates';

interface Props {
  slide: SlideData | undefined;
  aspectRatio: AspectRatio;
  headline: string;
  headlinePosition: HeadlinePosition;
  watermarkStyle: WatermarkStyle;
  designerName: string;
  designerTitle?: string;
  studioName?: string;
  bioText: string;
  projectName: string;
  designerPhoto?: string;
}

const ASPECT_RATIOS = {
  '4:5': 'aspect-[4/5]',
  '1:1': 'aspect-square',
  '9:16': 'aspect-[9/16]',
} as const;

function getWatermarkText(style: WatermarkStyle, designerName: string): string {
  switch (style) {
    case 'folio_x':
      return `FOLIO \u00D7 ${designerName.toUpperCase()}`;
    case 'folio_presents':
      return `FOLIO PRESENTS ${designerName.toUpperCase()}`;
    case 'minimal':
    default:
      return 'FOLIO';
  }
}

export function SlidePreview({
  slide,
  aspectRatio,
  headline,
  headlinePosition,
  watermarkStyle,
  designerName,
  designerTitle,
  studioName,
  bioText,
  projectName,
  designerPhoto,
}: Props) {
  if (!slide) return null;

  const aspectClass = ASPECT_RATIOS[aspectRatio];
  const watermarkText = getWatermarkText(watermarkStyle, designerName);

  // Headline positioning classes
  const headlineClasses = {
    bottom_left: 'bottom-8 left-8 text-left',
    bottom_center: 'bottom-8 left-0 right-0 text-center',
    top_left: 'top-8 left-8 text-left',
  };

  // Watermark position (opposite of headline)
  const watermarkClasses = headlinePosition.startsWith('bottom')
    ? 'top-6 right-6'
    : 'bottom-6 right-6';

  // Gradient direction
  const gradientClasses = headlinePosition.startsWith('bottom')
    ? 'bg-gradient-to-t from-black/60 via-black/20 to-transparent'
    : 'bg-gradient-to-b from-black/60 via-black/20 to-transparent';

  return (
    <div className="flex justify-center">
      <div className={`relative w-full max-w-[420px] overflow-hidden rounded-2xl shadow-lg ${aspectClass}`}>
        {/* Hero slide */}
        {slide.type === 'hero' && slide.imageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.imageUrl}
              alt="Hero"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className={`absolute inset-0 ${gradientClasses}`} />
            <div className={`absolute ${headlineClasses[headlinePosition]} max-w-[80%]`}>
              <p className="font-serif text-[22px] italic leading-tight text-white drop-shadow-lg">
                &ldquo;{headline || 'Your headline here'}&rdquo;
              </p>
            </div>
            <div className={`absolute ${watermarkClasses}`}>
              <span className="text-[10px] font-normal tracking-[0.15em] text-white/80 drop-shadow">
                {watermarkText}
              </span>
            </div>
          </>
        )}

        {/* Detail slide */}
        {slide.type === 'detail' && slide.imageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.imageUrl}
              alt="Detail"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute bottom-6 right-6">
              <span className="text-[10px] font-normal tracking-[0.15em] text-white/80 drop-shadow">
                {watermarkText}
              </span>
            </div>
          </>
        )}

        {/* Bio slide */}
        {slide.type === 'bio' && (
          <div className="absolute inset-0 flex flex-col bg-[#F5F0EB]">
            {designerPhoto && (
              <div className="relative h-[45%]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={designerPhoto}
                  alt={designerName}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#F5F0EB]" />
              </div>
            )}
            <div className={`flex flex-1 flex-col px-8 ${designerPhoto ? '' : 'justify-center'}`}>
              <h3 className="font-serif text-[24px] font-medium text-[#2C2420]">
                {designerName}
              </h3>
              {(designerTitle || studioName) && (
                <p className="mt-1 text-[13px] tracking-wide text-[#8B7B68]">
                  {designerTitle}
                  {studioName ? ` \u2014 ${studioName}` : ''}
                </p>
              )}
              <div className="my-4 h-px bg-[#C4B5A0]" />
              <p className="font-serif text-[15px] italic leading-relaxed text-[#2C2420]">
                {bioText || 'Designer bio will appear here...'}
              </p>
            </div>
            <div className="absolute bottom-6 right-6">
              <span className="text-[10px] font-normal tracking-[0.15em] text-[#A89880]">
                {watermarkText}
              </span>
            </div>
          </div>
        )}

        {/* CTA slide */}
        {slide.type === 'cta' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F5F0EB] px-12">
            <p className="text-[10px] tracking-[0.25em] text-[#8B7B68]">
              FULL EDITORIAL
            </p>
            <p className="mt-6 font-serif text-[36px] italic text-[#2C2420]">
              folio
            </p>
            <div className="mx-auto my-6 h-px w-2/3 bg-[#C4B5A0]" />
            <p className="text-center font-serif text-[18px] text-[#2C2420]">
              {projectName}
            </p>
            <p className="mt-2 text-[14px] font-light text-[#8B7B68]">
              by {designerName}
            </p>
            <p className="absolute bottom-8 text-[10px] tracking-[0.12em] text-[#A89880]">
              FOLIOAD.COM
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

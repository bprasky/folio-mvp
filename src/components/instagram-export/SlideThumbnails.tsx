'use client';

import type { SlideData } from './InstagramExportEditor';

interface Props {
  slides: SlideData[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

const SLIDE_LABELS: Record<string, string> = {
  hero: 'Hero',
  detail: 'Detail',
  bio: 'Bio',
  cta: 'CTA',
};

export function SlideThumbnails({ slides, activeIndex, onSelect }: Props) {
  return (
    <div className="mt-6 flex justify-center gap-3">
      {slides.map((slide, i) => (
        <button
          key={`${slide.type}-${i}`}
          onClick={() => onSelect(i)}
          className={`group relative overflow-hidden rounded-lg transition-all duration-200 ${
            activeIndex === i
              ? 'ring-2 ring-[#2C2420] ring-offset-2'
              : 'ring-1 ring-[#E8E0D8] hover:ring-[#C4B5A0]'
          }`}
        >
          <div className="h-16 w-12">
            {slide.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.imageUrl}
                alt={`Slide ${i + 1}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#F5F0EB]">
                <span className="text-[8px] font-medium text-[#8B7B68]">
                  {SLIDE_LABELS[slide.type]}
                </span>
              </div>
            )}
          </div>
          <div
            className={`absolute inset-x-0 bottom-0 py-0.5 text-center text-[8px] font-medium ${
              activeIndex === i
                ? 'bg-[#2C2420] text-white'
                : 'bg-black/40 text-white/90'
            }`}
          >
            {i + 1}
          </div>
        </button>
      ))}
    </div>
  );
}

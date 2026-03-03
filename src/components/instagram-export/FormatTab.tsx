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

function OptionButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
        selected
          ? 'border-[#C4B5A0] bg-[#F0EBE4] text-[#2C2420]'
          : 'border-[#E8E0D8] bg-white text-[#8B7B68] hover:border-[#C4B5A0]'
      }`}
    >
      {label}
    </button>
  );
}

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
    <div className="space-y-6">
      {/* Aspect Ratio */}
      <div>
        <label className="mb-2 block text-[13px] font-medium text-[#2C2420]">
          Aspect Ratio
        </label>
        <div className="flex gap-2">
          {([['4:5', 'Portrait'], ['1:1', 'Square'], ['9:16', 'Story']] as const).map(
            ([value, label]) => (
              <OptionButton
                key={value}
                label={label}
                selected={aspectRatio === value}
                onClick={() => setAspectRatio(value)}
              />
            )
          )}
        </div>
      </div>

      {/* Watermark */}
      <div>
        <label className="mb-2 block text-[13px] font-medium text-[#2C2420]">
          Watermark
        </label>
        <div className="flex flex-wrap gap-2">
          {([
            ['folio_x', 'folio \u00D7 name'],
            ['folio_presents', 'folio presents'],
            ['minimal', 'folio'],
          ] as const).map(([value, label]) => (
            <OptionButton
              key={value}
              label={label}
              selected={watermarkStyle === value}
              onClick={() => setWatermarkStyle(value)}
            />
          ))}
        </div>
      </div>

      {/* Headline Position */}
      <div>
        <label className="mb-2 block text-[13px] font-medium text-[#2C2420]">
          Headline Position
        </label>
        <div className="flex gap-2">
          {([
            ['bottom_left', 'Bottom Left'],
            ['bottom_center', 'Bottom Center'],
            ['top_left', 'Top Left'],
          ] as const).map(([value, label]) => (
            <OptionButton
              key={value}
              label={label}
              selected={headlinePosition === value}
              onClick={() => setHeadlinePosition(value)}
            />
          ))}
        </div>
      </div>

      {/* Slide Count */}
      <div>
        <label className="mb-2 block text-[13px] font-medium text-[#2C2420]">
          Carousel Length
        </label>
        <div className="flex gap-2">
          {([3, 4, 5] as const).map((count) => (
            <OptionButton
              key={count}
              label={`${count} slides`}
              selected={slideCount === count}
              onClick={() => setSlideCount(count)}
            />
          ))}
        </div>
      </div>

      {/* Image Selection */}
      <div>
        <label className="mb-2 block text-[13px] font-medium text-[#2C2420]">
          Images ({selectedImageUrls.length} selected)
        </label>
        <div className="grid grid-cols-4 gap-2">
          {images.map((img) => (
            <button
              key={img.id}
              onClick={() => toggleImage(img.url)}
              className={`relative aspect-square overflow-hidden rounded-lg transition-all duration-200 ${
                selectedImageUrls.includes(img.url)
                  ? 'ring-2 ring-[#2C2420] ring-offset-1'
                  : 'opacity-50 ring-1 ring-[#E8E0D8] hover:opacity-80'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.name || 'Project image'}
                className="h-full w-full object-cover"
              />
              {selectedImageUrls.includes(img.url) && (
                <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#2C2420] text-[10px] font-bold text-white">
                  {selectedImageUrls.indexOf(img.url) + 1}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

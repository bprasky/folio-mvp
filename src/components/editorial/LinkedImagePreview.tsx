"use client";

import Image from 'next/image';

interface Props {
  imageId: string;
  images: Array<{ id: string; url: string; name?: string }>;
}

export function LinkedImagePreview({ imageId, images }: Props) {
  const image = images.find(img => img.id === imageId);

  if (!image) {
    return null;
  }

  return (
    <div className="relative w-full h-32 rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
      <Image
        src={image.url}
        alt={image.name || "Referenced image"}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 400px"
      />
    </div>
  );
}


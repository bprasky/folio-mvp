// src/components/SafeImage.tsx
'use client';
import Image, { ImageProps } from 'next/image';

function isValidSrc(src: ImageProps['src']) {
  if (!src) return false;
  if (typeof src === 'string') return src.trim().length > 0;
  // StaticImport objects always have a string .src; null would fail this
  return typeof (src as any).src === 'string' && (src as any).src.length > 0;
}

export default function SafeImage(props: ImageProps) {
  const { src, alt, className = '', ...rest } = props;
  if (!isValidSrc(src)) {
    return (
      <div
        className={`bg-[#F6F4F1] text-[#8B8B8B] flex items-center justify-center ${className}`}
        aria-label={alt || 'image placeholder'}
      >
        {/* Subtle, brand-aligned placeholder */}
      </div>
    );
  }
  return <Image src={src} alt={alt || ''} className={className} {...rest} />;
}

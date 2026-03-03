// src/components/SafeImage.tsx
'use client';
import { useState } from 'react';
import Image, { ImageProps } from 'next/image';

function isValidSrc(src: ImageProps['src']) {
  if (!src) return false;
  if (typeof src === 'string') return src.trim().length > 0;
  // StaticImport objects always have a string .src; null would fail this
  return typeof (src as any).src === 'string' && (src as any).src.length > 0;
}

export default function SafeImage(props: ImageProps) {
  const { src, alt, className = '', onError, ...rest } = props;
  const [hasError, setHasError] = useState(false);

  if (!isValidSrc(src) || hasError) {
    return (
      <div
        className={`bg-stone-100 border border-stone-200 rounded-[20px] flex flex-col items-center justify-center ${className}`}
        aria-label={alt || 'image placeholder'}
      >
        <svg className="w-8 h-8 text-stone-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-stone-400 text-xs" style={{ fontFamily: 'var(--font-body)' }}>
          Image unavailable
        </span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt || ''}
      className={className}
      onError={(e) => {
        setHasError(true);
        onError?.(e);
      }}
      {...rest}
    />
  );
}

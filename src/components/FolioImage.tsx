'use client';

import Image, { type ImageProps } from 'next/image';
import { forwardRef } from 'react';
import { PROJECT_PHOTO_PREFIX } from '@/lib/files/projectPhotoUrl';

export type { ImageProps } from 'next/image';

/** Keep authenticated photos on their access-checked route while ordinary
 * images retain Next/Vercel optimization. A global custom loader disables
 * Vercel's optimizer even when it returns standard /_next/image URLs. */
const FolioImage = forwardRef<HTMLImageElement, ImageProps>(function FolioImage(
  { src, alt, unoptimized, ...props }, ref,
) {
  let protectedPhoto = false;
  if (typeof src === 'string') {
    try {
      protectedPhoto = new URL(src, 'https://folio.invalid').pathname.startsWith(PROJECT_PHOTO_PREFIX);
    } catch { /* Next/Image retains validation of malformed ordinary sources. */ }
  }
  return <Image {...props} ref={ref} src={src} alt={alt} unoptimized={protectedPhoto || unoptimized} />;
});

export default FolioImage;

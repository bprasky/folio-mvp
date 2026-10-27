'use client';
import { PROJECT_PHOTO_PREFIX } from './projectPhotoUrl';

/** Protected photos must reach their authorization route on every request.
 * Other images retain the standard Next optimizer URL and quality. */
export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (src.startsWith(PROJECT_PHOTO_PREFIX)) return src;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 75}`;
}

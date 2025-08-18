'use client';
import Image, { type ImageProps } from 'next/image';
import { ALLOWED_IMAGE_HOSTS } from '@/lib/allowedImageHosts';

export default function SafeImage(props: ImageProps) {
  const raw = String(props.src ?? '');
  let host = '';
  try { host = new URL(raw).hostname; } catch {}
  const allowed = host && ALLOWED_IMAGE_HOSTS.has(host);
  
  // Merge incoming className with absolute fill classes for fallback
  const fallbackClassName = `${props.className || ''} absolute inset-0 h-full w-full object-cover`.trim();
  
  // If allowed, use next/image; otherwise fall back to plain <img>
  return allowed ? (
    <Image {...props} />
  ) : (
    // Emulate fill behavior for fallback images
    <img 
      src={raw || '/images/event-placeholder.jpg'} 
      alt={props.alt || ''} 
      className={fallbackClassName}
      style={{ objectFit: "cover" }}
    />
  );
} 
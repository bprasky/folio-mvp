'use client';

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';
import { Package } from 'lucide-react';

interface SafeImageProps extends Omit<ImageProps, 'src' | 'onError'> {
  src: string | null | undefined;
  fallback?: string;
  showIcon?: boolean;
}

/**
 * Safe image component that handles broken URLs gracefully
 * - Falls back to placeholder on error
 * - Logs warning to console
 * - Never shows broken image icon
 */
export default function SafeImage({ 
  src, 
  alt, 
  fallback = '/images/product-placeholder.jpg',
  showIcon = true,
  className,
  ...rest 
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);
  const [originalSrc] = useState(src);

  // If no src provided or error occurred, show fallback
  const shouldUseFallback = !src || hasError;

  if (shouldUseFallback && showIcon && rest.fill) {
    // For fill images, show a placeholder icon
    return (
      <div className={`flex items-center justify-center bg-surface-elevated dark:bg-surface-elevated ${className || ''}`}>
        <Package className="w-8 h-8 text-folio-text-tertiary" />
      </div>
    );
  }

  return (
    <Image
      {...rest}
      src={shouldUseFallback ? fallback : src!}
      alt={alt || ''}
      className={className}
      onError={(e) => {
        if (!hasError) {
          console.warn('🖼️ SafeImage fallback triggered for:', originalSrc);
          setHasError(true);
        }
      }}
    />
  );
}





'use client';

import { Package } from 'lucide-react';
import { useState } from 'react';

interface ProductThumbnailProps {
  imageUrl: string | null;
  productName: string;
}

export function ProductThumbnail({ imageUrl, productName }: ProductThumbnailProps) {
  const [hasError, setHasError] = useState(false);

  if (!imageUrl || hasError) {
    return (
      <div className="h-10 w-10 rounded overflow-hidden bg-stone-100 dark:bg-stone-800 flex-shrink-0 flex items-center justify-center">
        <Package className="w-4 h-4 text-stone-400" />
      </div>
    );
  }

  return (
    <div className="h-10 w-10 rounded overflow-hidden bg-stone-100 dark:bg-stone-800 flex-shrink-0">
      <img
        src={imageUrl}
        alt={productName}
        className="h-full w-full object-cover"
        onError={() => {
          console.warn('🖼️ Failed to load thumbnail:', imageUrl);
          setHasError(true);
        }}
      />
    </div>
  );
}





'use client';

interface ProductFloatFallbackProps {
  imageUrl: string;
  name: string;
}

/**
 * Fallback for products without a 3D mesh.
 * Renders the product image on transparent background (no card container).
 * Static — no rotation, no scale animation.
 */
export function ProductFloatFallback({ imageUrl, name }: ProductFloatFallbackProps) {
  return (
    <div className="w-full aspect-square flex items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={name}
        className="max-w-full max-h-full object-contain drop-shadow-md"
      />
    </div>
  );
}

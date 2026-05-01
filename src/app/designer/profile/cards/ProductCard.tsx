'use client';

import SafeImage from '@/components/SafeImage';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    vendor?: string;
    price?: string | number | null;
    imageUrl?: string | null;
    cropUrl?: string | null;
    projectCount?: number;
    category?: string | null;
  };
  onClick?: () => void;
}

export default function ProductCard({ product, onClick }: ProductCardProps) {
  const formattedPrice =
    product.price != null
      ? typeof product.price === 'number'
        ? `$${product.price.toLocaleString()}`
        : product.price
      : null;

  // Prefer contextual crop over catalog image
  const displayImageUrl = product.cropUrl || product.imageUrl || '';

  return (
    <button
      onClick={onClick}
      className="product-card group relative overflow-hidden rounded-xl cursor-pointer w-full text-left"
    >
      <SafeImage
        src={displayImageUrl}
        alt={product.name}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      {product.projectCount !== undefined && product.projectCount > 0 && (
        <div className="absolute top-2.5 right-2.5">
          <span className="mosaic-badge-count">
            In {product.projectCount} project{product.projectCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-3.5">
        <h4 className="text-[var(--type-meta)] font-semibold text-white mb-0.5">{product.name}</h4>
        <div className="text-[var(--type-eyebrow)] text-white/70">
          {[product.vendor, formattedPrice].filter(Boolean).join(' \u00B7 ')}
        </div>
      </div>
      <style jsx>{`
        .product-card {
          position: relative;
          min-height: 200px;
          height: 100%;
        }
        .mosaic-badge-count {
          padding: 3px 8px;
          border-radius: 4px;
          background: rgba(250, 249, 247, 0.9);
          color: var(--text-secondary);
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 500;
        }
      `}</style>
    </button>
  );
}

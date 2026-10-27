import React from 'react';
import Image from '@/components/FolioImage';

interface ProductCardProps {
  id: string;
  name: string;
  brand: string;
  price: string;
  image: string;
  tags: string[];
  onSave?: () => void;
  isSaved?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  name,
  brand,
  price,
  image,
  tags,
  onSave,
  isSaved = false,
}) => {
  return (
    <div className="rounded-2xl overflow-hidden border border-[rgba(190,175,155,0.12)] bg-white transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_12px_32px_-8px_rgba(120,100,80,0.15)]">
      <div className="relative h-48 w-full">
        <Image
          src={image}
          alt={name}
          fill
          className="object-cover"
        />
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-folio-text">{name}</h3>
        <p className="text-sm text-folio-border">{brand}</p>
        <p className="text-lg font-bold text-folio-gold mt-2">{price}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 text-xs bg-folio-muted text-folio-text rounded-full border border-folio-border"
            >
              {tag}
            </span>
          ))}
        </div>
        {onSave && (
          <button
            onClick={onSave}
            className={`mt-4 w-full py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
              isSaved
                ? 'bg-folio-gold text-white'
                : 'bg-folio-muted text-folio-text hover:bg-folio-card border border-folio-border'
            }`}
          >
            {isSaved ? 'Saved' : 'Save to Folder'}
          </button>
        )}
      </div>
    </div>
  );
}; 
import React from 'react';
import Image from 'next/image';

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
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="relative h-48 w-full">
        <Image
          src={image}
          alt={name}
          fill
          className="object-cover"
        />
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-800">{name}</h3>
        <p className="text-sm text-gray-600">{brand}</p>
        <p className="text-lg font-bold text-gray-900 mt-2">{price}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
        {onSave && (
          <button
            onClick={onSave}
            className={`mt-4 w-full py-2 px-4 rounded-md transition-colors duration-200 ${
              isSaved
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isSaved ? 'Saved' : 'Save to Folder'}
          </button>
        )}
      </div>
    </div>
  );
}; 
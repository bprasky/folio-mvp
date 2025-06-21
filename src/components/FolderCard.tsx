import React from 'react';
import Image from 'next/image';

interface FolderCardProps {
  id: string;
  name: string;
  designer: {
    id: string;
    name: string;
    profileImage: string;
  };
  productCount: number;
  previewImages?: string[];
  onClick?: () => void;
}

export const FolderCard: React.FC<FolderCardProps> = ({
  name,
  designer,
  productCount,
  previewImages = [],
  onClick,
}) => {
  return (
    <div
      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer"
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-center mb-4">
          <div className="relative h-10 w-10 rounded-full overflow-hidden">
            <Image
              src={designer.profileImage}
              alt={designer.name}
              fill
              className="object-cover"
            />
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">{designer.name}</p>
            <p className="text-xs text-gray-600">{productCount} products</p>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-800 mb-3">{name}</h3>

        {previewImages.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {previewImages.slice(0, 4).map((image, index) => (
              <div
                key={index}
                className="relative h-24 w-full rounded-md overflow-hidden"
              >
                <Image
                  src={image}
                  alt={`Preview ${index + 1}`}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 
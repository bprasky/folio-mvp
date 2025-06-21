import React from 'react';
import Image from 'next/image';

interface EventCardProps {
  id: string;
  title: string;
  date: string;
  location: string;
  coverImage: string;
  featuredDesigner?: {
    id: string;
    name: string;
    profileImage: string;
  };
  previewProducts?: {
    id: string;
    image: string;
  }[];
}

export const EventCard: React.FC<EventCardProps> = ({
  title,
  date,
  location,
  coverImage,
  featuredDesigner,
  previewProducts = [],
}) => {
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="relative h-48 w-full">
        <Image
          src={coverImage}
          alt={title}
          fill
          className="object-cover"
        />
      </div>
      <div className="p-4">
        <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
        <div className="mt-2 text-sm text-gray-600">
          <p>{formattedDate}</p>
          <p>{location}</p>
        </div>
        
        {featuredDesigner && (
          <div className="mt-4 flex items-center">
            <div className="relative h-10 w-10 rounded-full overflow-hidden">
              <Image
                src={featuredDesigner.profileImage}
                alt={featuredDesigner.name}
                fill
                className="object-cover"
              />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">Featured Designer</p>
              <p className="text-sm text-gray-600">{featuredDesigner.name}</p>
            </div>
          </div>
        )}

        {previewProducts.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-900 mb-2">Preview Products</p>
            <div className="flex gap-2">
              {previewProducts.map((product) => (
                <div
                  key={product.id}
                  className="relative h-16 w-16 rounded-md overflow-hidden"
                >
                  <Image
                    src={product.image}
                    alt="Product preview"
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 
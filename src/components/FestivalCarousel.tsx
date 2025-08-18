'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Festival } from '../lib/fetchEvents';
import FestivalCard from './FestivalCard';

interface FestivalCarouselProps {
  festivals: Festival[];
  className?: string;
  canEdit?: boolean;
}

export default function FestivalCarousel({ festivals, className = '', canEdit = false }: FestivalCarouselProps) {
  const [expandedFestival, setExpandedFestival] = useState<string | null>(null);

  if (festivals.length === 0) {
    return (
      <div className={`w-full bg-gray-50 rounded-lg p-8 text-center ${className}`}>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Festivals Yet</h3>
        <p className="text-gray-500 mb-4">Be the first to create an amazing design festival!</p>
        <Link 
          href="/admin/festivals/create"
          className="inline-block bg-folio-accent text-white px-4 py-2 rounded-md hover:bg-folio-accent-dark transition-colors"
        >
          Create Festival
        </Link>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Featured Festivals</h2>
        <Link 
          href="/admin/festivals/create"
          className="text-folio-accent hover:text-folio-accent-dark font-medium"
        >
          Create New Festival →
        </Link>
      </div>
      
      {/* Responsive Festival Carousel */}
      <div className="flex overflow-x-auto space-x-6 pb-4 scrollbar-hide">
        {festivals.map((festival) => {
          const isExpanded = expandedFestival === festival.id;
          
          return (
            <div key={festival.id} className="flex-shrink-0 w-80">
              <FestivalCard
                festival={festival}
                isExpanded={isExpanded}
                onToggleExpand={() => setExpandedFestival(isExpanded ? null : festival.id)}
                className="h-full"
                canEdit={canEdit}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
} 
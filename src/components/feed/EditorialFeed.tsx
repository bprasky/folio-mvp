"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import Hero from './slices/Hero';
import Duotile from './slices/Duotile';
import Triptych from './slices/Triptych';
import MosaicFour from './slices/MosaicFour';

export interface UIEvent {
  id: string;
  slug: string;
  title: string;
  city: string;
  venue: string;
  eventTypes: string[];
  heroImage?: string;
  coverImage?: string;
  startsAt: string;
  endsAt?: string;
}

interface EditorialFeedProps {
  items: UIEvent[];
  canEdit?: boolean;
  onItemClick?: (id: string) => void;
}

export default function EditorialFeed({ items, canEdit = false, onItemClick }: EditorialFeedProps) {
  const router = useRouter();

  const handleItemClick = (id: string) => {
    if (onItemClick) {
      onItemClick(id);
    } else {
      // Default navigation behavior
      router.push(`/events/${id}`);
    }
  };

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No events to display</p>
      </div>
    );
  }

  const renderSlice = (startIndex: number, sliceType: string, count: number) => {
    const sliceItems = items.slice(startIndex, startIndex + count);
    
    switch (sliceType) {
      case 'hero':
        return <Hero item={sliceItems[0]} onClick={handleItemClick} canEdit={canEdit} />;
      case 'duotile':
        return <Duotile items={sliceItems} onClick={handleItemClick} canEdit={canEdit} />;
      case 'triptych':
        return <Triptych items={sliceItems} onClick={handleItemClick} canEdit={canEdit} />;
      case 'mosaic':
        return <MosaicFour items={sliceItems} onClick={handleItemClick} canEdit={canEdit} />;
      default:
        return null;
    }
  };

  const buildSlices = () => {
    const slices = [];
    let currentIndex = 0;
    
    // Define the slice pattern
    const pattern = [
      { type: 'hero', count: 1 },
      { type: 'duotile', count: 2 },
      { type: 'triptych', count: 3 },
      { type: 'duotile', count: 2 },
      { type: 'mosaic', count: 4 }
    ];

    // Build slices following the pattern
    while (currentIndex < items.length) {
      for (const slice of pattern) {
        if (currentIndex >= items.length) break;
        
        const remainingItems = items.length - currentIndex;
        let actualCount = slice.count;
        
        // Degrade gracefully if fewer items remain
        if (remainingItems < slice.count) {
          if (slice.type === 'hero' && remainingItems > 0) {
            actualCount = 1;
          } else if (slice.type === 'duotile' && remainingItems >= 1) {
            actualCount = remainingItems;
          } else if (slice.type === 'triptych' && remainingItems >= 1) {
            actualCount = remainingItems;
          } else if (slice.type === 'mosaic' && remainingItems >= 1) {
            actualCount = remainingItems;
          } else {
            break;
          }
        }

        if (actualCount > 0) {
          slices.push(
            <div key={`${slice.type}-${currentIndex}`} className="mb-8">
              {renderSlice(currentIndex, slice.type, actualCount)}
            </div>
          );
          currentIndex += actualCount;
        }
      }
    }

    return slices;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {buildSlices()}
      </div>
    </div>
  );
} 
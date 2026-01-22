'use client';

import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import SafeImage from '@/components/SafeImage';

interface PinnedItem {
  id: string;
  type: 'project' | 'media' | 'recognition' | 'collaboration';
  data: {
    title: string;
    image?: string;
    subtitle?: string;
  };
}

interface PinnedCarouselProps {
  items: PinnedItem[];
}

export default function PinnedCarousel({ items }: PinnedCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(items.length > 1);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.offsetWidth;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  if (items.length === 0) return null;

  return (
    <div
      className="border-b relative"
      style={{ borderColor: '#E8E4DF', backgroundColor: '#F5F3F0' }}
    >
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center gap-4">
          <span
            className="text-xs uppercase tracking-wider flex-shrink-0"
            style={{ color: '#8B8178' }}
          >
            Pinned
          </span>

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-x-auto scrollbar-hide flex gap-4"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {items.map(item => (
              <PinnedCard key={item.id} item={item} />
            ))}
          </div>

          {items.length > 1 && (
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => scroll('left')}
                disabled={!canScrollLeft}
                className="p-1 rounded-full disabled:opacity-30 transition-opacity"
                style={{ color: '#6B635B' }}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => scroll('right')}
                disabled={!canScrollRight}
                className="p-1 rounded-full disabled:opacity-30 transition-opacity"
                style={{ color: '#6B635B' }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PinnedCard({ item }: { item: PinnedItem }) {
  const getBadgeLabel = () => {
    switch (item.type) {
      case 'project':
        return 'Project';
      case 'media':
        return 'Media';
      case 'recognition':
        return 'Recognition';
      case 'collaboration':
        return 'Collaboration';
      default:
        return 'Pinned';
    }
  };

  const getHref = () => {
    switch (item.type) {
      case 'project':
        return `/project/${item.id}`;
      default:
        return '#';
    }
  };

  return (
    <Link
      href={getHref()}
      className="flex items-center gap-4 flex-shrink-0 cursor-pointer group"
      style={{ scrollSnapAlign: 'start', minWidth: '320px' }}
    >
      <div
        className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 relative"
        style={{ backgroundColor: '#D4CEC6' }}
      >
        {item.data.image ? (
          <SafeImage
            src={item.data.image}
            alt={item.data.title}
            fill
            className="object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-xs"
            style={{ color: '#8B8178' }}
          >
            {getBadgeLabel()[0]}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
          >
            {getBadgeLabel()}
          </span>
        </div>
        <p
          className="text-sm font-medium mt-1 truncate group-hover:underline"
          style={{ color: '#2C2825' }}
        >
          {item.data.title}
        </p>
        {item.data.subtitle && (
          <p className="text-xs truncate" style={{ color: '#8B8178' }}>
            {item.data.subtitle}
          </p>
        )}
      </div>
    </Link>
  );
}

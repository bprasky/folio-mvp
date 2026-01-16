'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import SafeImage from '@/components/SafeImage';

interface PinnedItem {
  id: string;
  type: 'project' | 'media' | 'recognition' | 'collaboration';
  data: any;
  pinOrder?: number | null;
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
    <div className="border-b relative" style={{ borderColor: '#E8E4DF', backgroundColor: '#F5F3F0' }}>
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center gap-4">
          <span
            className="text-xs uppercase tracking-wider flex-shrink-0 font-medium"
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
                className="p-1.5 rounded-full disabled:opacity-30 transition-opacity hover:bg-white/50"
                style={{ color: '#6B635B' }}
                aria-label="Scroll left"
              >
                <ChevronLeftIcon />
              </button>
              <button
                onClick={() => scroll('right')}
                disabled={!canScrollRight}
                className="p-1.5 rounded-full disabled:opacity-30 transition-opacity hover:bg-white/50"
                style={{ color: '#6B635B' }}
                aria-label="Scroll right"
              >
                <ChevronRightIcon />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PinnedCard({ item }: { item: PinnedItem }) {
  const content = getCardContent(item);
  const href = getItemHref(item);

  return (
    <Link
      href={href}
      className="flex items-center gap-4 flex-shrink-0 group min-w-[280px] md:min-w-[320px]"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div
        className="w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden flex-shrink-0 relative"
        style={{ backgroundColor: '#D4CEC6' }}
      >
        {content.image ? (
          <SafeImage
            src={content.image}
            alt={content.title}
            width={64}
            height={64}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-xs font-medium"
            style={{ color: '#8B8178' }}
          >
            {content.badge?.[0]}
          </div>
        )}
        {content.showPlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center">
              <span className="text-xs ml-0.5">&#9654;</span>
            </div>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
          >
            {content.badge}
          </span>
        </div>
        <p
          className="text-sm font-medium mt-1 truncate group-hover:underline"
          style={{ color: '#2C2825' }}
        >
          {content.title}
        </p>
        <p className="text-xs truncate" style={{ color: '#8B8178' }}>
          {content.subtitle}
        </p>
      </div>
    </Link>
  );
}

function getCardContent(item: PinnedItem) {
  switch (item.type) {
    case 'project':
      return {
        image: item.data.imageUrl || item.data.images?.[0]?.url,
        title: item.data.title || item.data.name,
        subtitle: `${item.data.city || 'Project'} · ${item.data.saveCount || item.data.saves || 0} saves`,
        badge: 'Project',
      };
    case 'media':
      return {
        image: item.data.thumbnailUrl,
        title: item.data.title,
        subtitle: `${formatMediaType(item.data.type)} · ${formatDuration(item.data.duration)}`,
        badge: item.data.type === 'PODCAST' ? 'Podcast' : 'Video',
        showPlay: true,
      };
    case 'recognition':
      return {
        image: item.data.imageUrl,
        title: item.data.title,
        subtitle: item.data.source,
        badge: item.data.type === 'AWARD' ? 'Award' : 'Press',
      };
    case 'collaboration':
      return {
        image: item.data.imageUrl,
        title: item.data.title,
        subtitle: `with ${item.data.partnerName || item.data.vendor?.name || 'Partner'}`,
        badge: 'Collaboration',
      };
    default:
      return { title: '', subtitle: '', badge: '' };
  }
}

function getItemHref(item: PinnedItem): string {
  switch (item.type) {
    case 'project':
      return `/project/${item.id}`;
    case 'media':
      return item.data.sourceUrl || '#';
    case 'recognition':
      return item.data.url || '#';
    case 'collaboration':
      return item.data.projectId ? `/project/${item.data.projectId}` : '#';
    default:
      return '#';
  }
}

function formatMediaType(type: string): string {
  const typeMap: Record<string, string> = {
    VIDEO: 'Video',
    PODCAST: 'Podcast',
    INTERVIEW: 'Interview',
    WEBINAR: 'Webinar',
    SPEAKING: 'Speaking',
    BEHIND_THE_SCENES: 'BTS',
  };
  return typeMap[type] || type;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

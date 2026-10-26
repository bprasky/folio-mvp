'use client';

import { workflowRequest } from '@/lib/client/workflowRequest';
import { useState, useEffect } from 'react';
import FeedFilters from './FeedFilters';
import ProjectCard from './feed-cards/ProjectCard';
import MediaCard from './feed-cards/MediaCard';
import RecognitionCard from './feed-cards/RecognitionCard';
import CollaborationCard from './feed-cards/CollaborationCard';

interface FeedItem {
  id: string;
  type: 'project' | 'media' | 'recognition' | 'collaboration';
  data: any;
  publishedAt: string | null;
  pinnedAt: string | null;
  engagement: number;
}

interface ProfileFeedProps {
  userId: string;
  initialFilter?: string;
  initialSort?: string;
}

export default function ProfileFeed({
  userId,
  initialFilter = 'all',
  initialSort = 'featured',
}: ProfileFeedProps) {
  const [retry, setRetry] = useState(0);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState(initialFilter);
  const [sort, setSort] = useState(initialSort);

  useEffect(() => {
    let active = true;
    const fetchFeed = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          filter,
          sort,
        });

        const response = await workflowRequest(`/api/profile/${userId}/feed?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch feed');
        }

        const data = await response.json();
        if (active) setItems(data.items || []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchFeed();
    return () => { active = false; };
  }, [userId, filter, sort, retry]);

  // Update state when URL params change
  useEffect(() => {
    setFilter(initialFilter);
    setSort(initialSort);
  }, [initialFilter, initialSort]);

  if (loading) {
    return <FeedSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p role="alert" className="text-folio-text-secondary">Unable to load content.</p>
        <button type="button" className="mt-3 min-h-11 rounded border px-4" onClick={() => setRetry(value => value + 1)}>Try again</button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div>
        <FeedFilters activeFilter={filter} activeSort={sort} userId={userId} />
        <EmptyFeedState filter={filter} />
      </div>
    );
  }

  return (
    <div>
      <FeedFilters activeFilter={filter} activeSort={sort} userId={userId} />

      {/* Masonry-style grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(item => (
          <FeedCard key={`${item.type}-${item.id}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  switch (item.type) {
    case 'project':
      return <ProjectCard project={item.data} />;
    case 'media':
      return <MediaCard media={item.data} />;
    case 'recognition':
      return <RecognitionCard recognition={item.data} />;
    case 'collaboration':
      return <CollaborationCard collaboration={item.data} />;
    default:
      return null;
  }
}

function FeedSkeleton() {
  return (
    <div>
      {/* Filter skeleton */}
      <div className="flex gap-2 mb-6">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className="h-8 w-20 rounded-full animate-pulse"
            style={{ backgroundColor: '#E8E4DF' }}
          />
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div
            key={i}
            className="rounded-xl overflow-hidden animate-pulse"
            style={{ backgroundColor: '#F5F3F0' }}
          >
            <div className="aspect-[4/3]" style={{ backgroundColor: '#E8E4DF' }} />
            <div className="p-4 space-y-2">
              <div className="h-4 w-3/4 rounded" style={{ backgroundColor: '#E8E4DF' }} />
              <div className="h-3 w-1/2 rounded" style={{ backgroundColor: '#E8E4DF' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyFeedState({ filter }: { filter: string }) {
  const getMessage = () => {
    switch (filter) {
      case 'projects':
        return 'No projects published yet.';
      case 'media':
        return 'No media content available.';
      case 'recognition':
        return 'No press or awards to display.';
      case 'collaborations':
        return 'No collaborations to show.';
      default:
        return 'No content to display yet.';
    }
  };

  return (
    <div className="text-center py-16">
      <div
        className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
        style={{ backgroundColor: '#F0EDE9' }}
      >
        <EmptyIcon />
      </div>
      <p style={{ color: '#8B8178' }}>{getMessage()}</p>
    </div>
  );
}

function EmptyIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#A09890"
      strokeWidth="1.5"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </svg>
  );
}

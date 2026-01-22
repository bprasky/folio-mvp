'use client';

import { useEffect, useState } from 'react';
import FeedFilters from './FeedFilters';
import ProjectCard from './feed-cards/ProjectCard';
import MediaCard from './feed-cards/MediaCard';
import RecognitionCard from './feed-cards/RecognitionCard';
import CollaborationCard from './feed-cards/CollaborationCard';

interface FeedItem {
  id: string;
  type: 'project' | 'media' | 'recognition' | 'collaboration';
  data: any;
  publishedAt?: string;
  pinnedAt?: string;
  engagement?: number;
}

interface OrgProfileFeedProps {
  orgId: string;
  initialFilter: string;
  initialSort: string;
}

export default function OrgProfileFeed({ orgId, initialFilter, initialSort }: OrgProfileFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilter);
  const [sort, setSort] = useState(initialSort);

  useEffect(() => {
    async function loadFeed() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filter !== 'all') params.set('filter', filter);
        if (sort !== 'featured') params.set('sort', sort);

        const response = await fetch(`/api/org/${orgId}/feed?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setItems(data.items || []);
        }
      } catch (error) {
        console.error('Failed to load feed:', error);
      } finally {
        setLoading(false);
      }
    }
    loadFeed();
  }, [orgId, filter, sort]);

  // Update filter/sort from URL changes
  useEffect(() => {
    setFilter(initialFilter);
    setSort(initialSort);
  }, [initialFilter, initialSort]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div>
      <FeedFilters activeFilter={filter} activeSort={sort} orgId={orgId} />

      {items.length === 0 ? (
        <div className="text-center py-16">
          <p style={{ color: '#8B8178' }}>No content yet</p>
          <p className="text-sm mt-2" style={{ color: '#A09890' }}>
            Projects and media will appear here once published
          </p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
          {items.map(item => (
            <div key={item.id} className="mb-4 break-inside-avoid">
              {renderCard(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderCard(item: FeedItem) {
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

function LoadingSkeleton() {
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
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div
            key={i}
            className="mb-4 rounded-lg animate-pulse break-inside-avoid"
            style={{
              backgroundColor: '#E8E4DF',
              aspectRatio: i % 2 === 0 ? '4/3' : '3/4',
            }}
          />
        ))}
      </div>
    </div>
  );
}

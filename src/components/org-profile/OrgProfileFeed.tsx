'use client';

import { useEffect, useState } from 'react';
import FeedFilters from './FeedFilters';
import AddRecognitionModal from './AddRecognitionModal';
import FeedLayoutSystem from './feed-layout/FeedLayoutSystem';

interface FeedItem {
  id: string;
  type: 'project' | 'media' | 'recognition' | 'collaboration';
  data: any;
  publishedAt?: string | null;
  pinnedAt?: string | null;
  engagement?: number;
}

interface OrgProfileFeedProps {
  initialItems?: FeedItem[];
  orgId: string;
  initialFilter: string;
  initialSort: string;
  isMember?: boolean;
  isAdmin?: boolean;
  projectCount?: number;
}

export default function OrgProfileFeed({
  initialItems,
  orgId,
  initialFilter,
  initialSort,
  isMember = false,
  isAdmin = false,
  projectCount = 0,
}: OrgProfileFeedProps) {
  const [items, setItems] = useState<FeedItem[]>(initialItems || []);
  const [loading, setLoading] = useState(!initialItems);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState(initialFilter);
  const [sort, setSort] = useState(initialSort);
  const [recognitionModalOpen, setRecognitionModalOpen] = useState(false);

  useEffect(() => {
    if (initialItems && filter === initialFilter && sort === initialSort && attempt === 0) {
      setItems(initialItems); setLoading(false); setError(''); return;
    }
    let cancelled = false;
    async function loadFeed() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (filter !== 'all') params.set('filter', filter);
        if (sort !== 'featured') params.set('sort', sort);

        const response = await fetch(`/api/org/${orgId}/feed?${params.toString()}`);
        if (!response.ok) throw new Error('The profile feed could not be loaded. Please try again.');
        const data = await response.json();
        if (!cancelled) setItems(data.items || []);
      } catch (error) {
        if (!cancelled) setError(error instanceof Error ? error.message : 'The profile feed could not be loaded. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadFeed();
    return () => { cancelled = true; };
  }, [orgId, filter, sort, attempt, initialItems, initialFilter, initialSort]);

  // Update filter/sort from URL changes
  useEffect(() => {
    setFilter(initialFilter);
    setSort(initialSort);
  }, [initialFilter, initialSort]);

  if (loading) {
    return <LoadingSkeleton projectCount={projectCount} />;
  }

  return (
    <div>
      {(items.length > 0 || filter !== 'all' || error) && <FeedFilters
        activeFilter={filter}
        activeSort={sort}
        orgId={orgId}
        isAdmin={isAdmin}
        onAddRecognition={() => setRecognitionModalOpen(true)}
      />}

      {error ? <div className="py-12 text-center"><p role="alert" className="folio-body">{error}</p><button className="mt-3 min-h-11 px-4 folio-ui underline" onClick={() => setAttempt(value => value + 1)}>Try again</button></div> : items.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--org-page-muted, var(--folio-text-secondary))' }}>
            <p>{filter === 'all' ? 'No content yet' : 'No entries in this section yet'}</p>
            <p className="text-sm mt-2">
              Projects and media will appear here once published
            </p>
          </div>
      ) : (
        <FeedLayoutSystem
          items={items}
          projectCount={projectCount}
          orgId={orgId}
          isMember={isMember}
        />
      )}

      <AddRecognitionModal
        open={recognitionModalOpen}
        onOpenChange={setRecognitionModalOpen}
        orgId={orgId}
      />

    </div>
  );
}

function LoadingSkeleton({ projectCount }: { projectCount: number }) {
  return (
    <div role="status" aria-label="Loading profile">
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

      {projectCount > 0 ? (
        <div className="grid grid-flow-dense grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 auto-rows-[8px] gap-3">
          {Array.from({ length: Math.min(projectCount, 6) }, (_, i) => (
            <div
              key={i}
              className={`${i === 0 ? 'sm:col-span-2 lg:col-span-3 xl:col-span-4' : i < 4 ? 'sm:col-span-2 lg:col-span-2' : 'col-span-1'} rounded-[20px] animate-pulse bg-stone-100`}
              style={{ gridRowEnd: `span ${i === 0 ? 34 : i < 4 ? 26 : 18}` }}
            />
          ))}
        </div>
      ) : (
        /* Default masonry skeleton */
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
      )}
    </div>
  );
}

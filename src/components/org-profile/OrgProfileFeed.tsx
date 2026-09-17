'use client';

import { useEffect, useState } from 'react';
import FeedFilters from './FeedFilters';
import GuidedSetupCard from './GuidedSetupCard';
import AddRecognitionModal from './AddRecognitionModal';
import InviteTeamModal from './InviteTeamModal';
import FeedLayoutSystem from './feed-layout/FeedLayoutSystem';

interface FeedItem {
  id: string;
  type: 'project' | 'media' | 'recognition' | 'collaboration';
  data: any;
  publishedAt?: string;
  pinnedAt?: string;
  engagement?: number;
}

interface SetupState {
  profileComplete: boolean;
  recognitionComplete: boolean;
  teamInviteComplete: boolean;
  firstProjectPublished: boolean;
}

interface OrgProfileFeedProps {
  orgId: string;
  initialFilter: string;
  initialSort: string;
  isMember?: boolean;
  isAdmin?: boolean;
  projectCount?: number;
  setupState?: SetupState;
}

export default function OrgProfileFeed({
  orgId,
  initialFilter,
  initialSort,
  isMember = false,
  isAdmin = false,
  projectCount = 0,
  setupState,
}: OrgProfileFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilter);
  const [sort, setSort] = useState(initialSort);
  const [recognitionModalOpen, setRecognitionModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

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
    return <LoadingSkeleton projectCount={projectCount} />;
  }

  const showSetupCard = isMember && projectCount === 0 && setupState;

  return (
    <div>
      <FeedFilters
        activeFilter={filter}
        activeSort={sort}
        orgId={orgId}
        isAdmin={isAdmin}
        onAddRecognition={() => setRecognitionModalOpen(true)}
      />

      {items.length === 0 ? (
        showSetupCard ? (
          <GuidedSetupCard
            orgId={orgId}
            setupState={setupState}
            onOpenRecognitionModal={() => setRecognitionModalOpen(true)}
            onOpenInviteModal={() => setInviteModalOpen(true)}
          />
        ) : (
          <div className="text-center py-16">
            <p style={{ color: '#8B8178' }}>No content yet</p>
            <p className="text-sm mt-2" style={{ color: '#A09890' }}>
              Projects and media will appear here once published
            </p>
          </div>
        )
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

      <InviteTeamModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        orgId={orgId}
      />
    </div>
  );
}

function LoadingSkeleton({ projectCount }: { projectCount: number }) {
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

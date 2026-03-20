'use client';

import { getFeedLayoutState, type FeedProjectItem } from '@/lib/feed/feed-layout';
import { FEED_LAYOUT_THRESHOLDS } from '@/lib/feed/feed-layout';
import NascentFeed from './NascentFeed';
import MosaicFeed from './MosaicFeed';
import MosaicActivationToast from './MosaicActivationToast';
import MediaCard from '../feed-cards/MediaCard';
import RecognitionCard from '../feed-cards/RecognitionCard';
import CollaborationCard from '../feed-cards/CollaborationCard';

interface FeedItem {
  id: string;
  type: 'project' | 'media' | 'recognition' | 'collaboration';
  data: any;
}

interface FeedLayoutSystemProps {
  items: FeedItem[];
  projectCount: number;
  orgId: string;
  isMember: boolean;
}

function mapToFeedProject(item: FeedItem): FeedProjectItem {
  const d = item.data;
  return {
    id: d.id,
    title: d.title || d.name || 'Untitled Project',
    heroImage: d.heroImage || d.images?.[0]?.url || null,
    location: d.location || d.city || null,
    isEditorial: d.isEditorial || false,
    roomCount: d.roomCount || 0,
    saveCount: d.saveCount || d.saves || 0,
  };
}

function renderNonProjectCard(item: FeedItem) {
  switch (item.type) {
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

export default function FeedLayoutSystem({
  items,
  projectCount,
  orgId,
  isMember,
}: FeedLayoutSystemProps) {
  const layoutState = getFeedLayoutState(projectCount);

  const projectItems = items.filter(i => i.type === 'project');
  const otherItems = items.filter(i => i.type !== 'project');
  const projects = projectItems.map(mapToFeedProject);

  return (
    <div className="relative">
      <MosaicActivationToast
        orgId={orgId}
        projectCount={projectCount}
        isMember={isMember}
      />

      {/* Project layout section */}
      {layoutState === 'nascent' && <NascentFeed projects={projects} />}
      {layoutState === 'mosaic' && <MosaicFeed projects={projects} />}

      {/* Non-project items */}
      {otherItems.length > 0 && (
        <div className={`columns-1 sm:columns-2 gap-4 ${projects.length > 0 ? 'mt-8' : ''}`}>
          {otherItems.map(item => (
            <div key={item.id} className="mb-4 break-inside-avoid">
              {renderNonProjectCard(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

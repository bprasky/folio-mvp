'use client';

import type { FeedProjectItem } from '@/lib/feed/feed-layout';
import MosaicActivationToast from './MosaicActivationToast';
import ProjectFlowMosaic from './ProjectFlowMosaic';
import MediaCard from '../feed-cards/MediaCard';
import RecognitionCard from '../feed-cards/RecognitionCard';
import CollaborationCard from '../feed-cards/CollaborationCard';
import { CoverageCard } from '@/components/coverage/CoverageCard';

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
    storyHref: d.storyHref ?? null,
    location: d.location || d.city || null,
    isEditorial: d.isEditorial || false,
    roomCount: d.roomCount || 0,
    saveCount: d.saveCount || d.saves || 0,
  };
}

function renderNonProjectCard(item: FeedItem) {
  if (item.data.coverage) return <CoverageCard item={item.data.coverage} />;
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
  // The query has already applied pins and the selected sort. Keep adjacent
  // projects in a mosaic without moving coverage out of its editorial position.
  const sections: Array<{ key: string; projects: FeedProjectItem[] } | { key: string; item: FeedItem }> = [];
  for (const item of items) {
    const previous = sections[sections.length - 1];
    if (item.type !== 'project') {
      sections.push({ key: item.type + '-' + item.id, item });
    } else if (previous && 'projects' in previous) {
      previous.projects.push(mapToFeedProject(item));
    } else {
      sections.push({ key: 'projects-' + item.id, projects: [mapToFeedProject(item)] });
    }
  }

  return (
    <div className="relative">
      <MosaicActivationToast orgId={orgId} projectCount={projectCount} isMember={isMember} />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-7">
        {sections.map(section => 'projects' in section ? (
          <div key={section.key} className={section.projects.length > 1 || sections.length === 1 ? 'min-w-0 md:col-span-2' : 'min-w-0'}>
            <ProjectFlowMosaic projects={section.projects} />
          </div>
        ) : (
          <div key={section.key} className="min-w-0 self-start">
            {renderNonProjectCard(section.item)}
          </div>
        ))}
      </div>
    </div>
  );
}

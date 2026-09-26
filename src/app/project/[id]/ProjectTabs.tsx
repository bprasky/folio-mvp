'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { LayoutGrid, Image as ImageIcon, MessageSquare, Share2, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditorialState } from '@/lib/editorial/getEditorialState';

type TabView = 'overview' | 'media' | 'boards' | 'drafts' | 'files' | 'publish' | 'story' | 'actions';

interface ProjectTabsProps {
  project: {
    id: string;
    title: string;
    rooms?: any[];
  };
  currentView: TabView;
  isPublished: boolean;
  hasDraftOrPublished?: boolean;
  editorialState?: EditorialState;
  /**
   * Whether the Story tab should be shown. Derived on the server (owner keeps it
   * once an interview exists; others only after publish). Falls back to the
   * published-only rule when not provided.
   */
  storyTabVisible?: boolean;
  /**
   * True once the project is in the publishing flow — created as finished work
   * ("PAST"), or any project that has started a draft. The working surfaces
   * (Boards / Action items / Media) belong to a project being built, not one
   * being published, and the stepper owns navigation there instead.
   */
  inPublishingFlow?: boolean;
}

export default function ProjectTabs({
  project,
  currentView,
  isPublished,
  hasDraftOrPublished,
  editorialState,
  storyTabVisible,
  inPublishingFlow = false,
}: ProjectTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const handleTabChange = (view: TabView) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', view);
    params.delete('room');
    // Tab navigation reviews a surface; it must not replay a prior CTA command.
    params.delete('action');
    router.replace(`${pathname}?${params.toString()}`);
  };

  const totalSelections =
    project.rooms?.reduce((sum: number, room: any) => sum + (room.selections?.length || 0), 0) || 0;

  // Story and Publish are the publishing flow's own surfaces — they never belong
  // to a project that's still being built. (A draft existing already implies the
  // publishing flow, so this gate only makes that explicit rather than changing
  // when Publish appears.)
  // The stepper owns Story and Publish in the publishing flow, always — it is
  // kept on screen there even once every step is complete, precisely so this
  // does not need a fallback.
  const ownedByStepper = inPublishingFlow;
  const showStory = !ownedByStepper && (storyTabVisible ?? editorialState === 'PUBLISHED');
  const showPublish =
    !ownedByStepper &&
    inPublishingFlow &&
    (editorialState === 'GENERATED' ||
      editorialState === 'PUBLISHED' ||
      editorialState === 'UNPUBLISHED');

  const allTabs = [
    {
      id: 'boards' as TabView,
      label: 'Boards',
      Icon: LayoutGrid,
      count: totalSelections > 0 ? totalSelections : undefined,
      // Boards is a real-selections surface — it only exists once products have
      // been tagged. No tags → no Boards tab. Gone entirely once publishing
      // starts, along with the other working surfaces.
      visible: !inPublishingFlow && totalSelections > 0,
    },
    {
      id: 'actions' as TabView,
      label: 'Action items',
      Icon: ClipboardList,
      count: undefined,
      visible: !inPublishingFlow && totalSelections > 0,
    },
    {
      id: 'media' as TabView,
      label: 'Media',
      Icon: ImageIcon,
      count: undefined,
      // In the publishing flow the photo/product steps are reached from the
      // stepper (Photos / Rooms / Tags), so a Media tab would duplicate it.
      visible: !inPublishingFlow,
    },
    {
      id: 'story' as TabView,
      label: 'Story',
      Icon: MessageSquare,
      count: undefined,
      visible: showStory,
    },
    {
      id: 'publish' as TabView,
      label: 'Publish',
      Icon: Share2,
      count: undefined,
      visible: showPublish,
    },
  ];

  const tabs = allTabs.filter(t => t.visible);

  // Nothing unique left to offer. An empty strip is still a visible rule and a
  // block of padding, so render nothing at all.
  if (tabs.length === 0) return null;

  return (
    <>
      <div role="tablist" className="flex gap-1 border-b border-folio-border-subtle mt-6">
        {tabs.map(tab => {
          const active = currentView === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'relative inline-flex items-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors duration-[220ms]',
                active
                  ? 'text-folio-text-primary'
                  : 'text-folio-text-secondary hover:text-folio-text-primary',
              )}
            >
              <tab.Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count != null && (
                <span className="text-folio-text-tertiary tabular-nums">{tab.count}</span>
              )}
              {active && (
                <span
                  className="absolute left-4 right-4 -bottom-px h-0.5 bg-[var(--accent)]"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

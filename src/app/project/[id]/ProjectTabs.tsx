'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { LayoutGrid, Image as ImageIcon, MessageSquare, Share2, ClipboardList, Lock } from 'lucide-react';
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
  /** Spec 20 §8 — completed projects lock Boards until products are tagged. */
  boardsLocked?: boolean;
}

export default function ProjectTabs({
  project,
  currentView,
  isPublished,
  hasDraftOrPublished,
  editorialState,
  boardsLocked = false,
}: ProjectTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const handleTabChange = (view: TabView) => {
    if (view === 'boards' && boardsLocked) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', view);
    params.delete('room');
    router.replace(`${pathname}?${params.toString()}`);
  };

  const totalSelections =
    project.rooms?.reduce((sum: number, room: any) => sum + (room.selections?.length || 0), 0) || 0;

  const showStory = editorialState === 'PUBLISHED';
  const showPublish =
    editorialState === 'GENERATED' ||
    editorialState === 'PUBLISHED' ||
    editorialState === 'UNPUBLISHED';

  const allTabs = [
    {
      id: 'boards' as TabView,
      label: 'Boards',
      Icon: LayoutGrid,
      count: totalSelections > 0 ? totalSelections : undefined,
      visible: true,
    },
    {
      id: 'actions' as TabView,
      label: 'Action items',
      Icon: ClipboardList,
      count: undefined,
      visible: totalSelections > 0,
    },
    {
      id: 'media' as TabView,
      label: 'Media',
      Icon: ImageIcon,
      count: undefined,
      visible: true,
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

  return (
    <>
      <div role="tablist" className="flex gap-1 border-b border-folio-border-subtle mt-6">
        {tabs.map(tab => {
          const active = currentView === tab.id;
          const locked = tab.id === 'boards' && boardsLocked;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              aria-disabled={locked}
              disabled={locked}
              title={locked ? 'Boards open once your products are tagged.' : undefined}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'relative inline-flex items-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors duration-[220ms]',
                locked
                  ? 'text-folio-text-tertiary cursor-not-allowed'
                  : active
                    ? 'text-folio-text-primary'
                    : 'text-folio-text-secondary hover:text-folio-text-primary',
              )}
            >
              {locked ? <Lock className="w-3.5 h-3.5" /> : <tab.Icon className="w-3.5 h-3.5" />}
              {tab.label}
              {tab.count != null && !locked && (
                <span className="text-folio-text-tertiary tabular-nums">{tab.count}</span>
              )}
              {active && !locked && (
                <span
                  className="absolute left-4 right-4 -bottom-px h-0.5 bg-[var(--accent)]"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
      {boardsLocked && (
        <p className="mt-2 folio-meta text-folio-text-tertiary">
          Boards open once your products are tagged.
        </p>
      )}
    </>
  );
}

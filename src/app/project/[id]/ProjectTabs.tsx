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
}

export default function ProjectTabs({
  project,
  currentView,
  isPublished,
  hasDraftOrPublished,
  editorialState,
}: ProjectTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const handleTabChange = (view: TabView) => {
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
  );
}

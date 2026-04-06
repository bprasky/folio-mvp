'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { LayoutGrid, ImageIcon, MessageSquare, Share2, ClipboardList } from 'lucide-react';
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

export default function ProjectTabs({ project, currentView, isPublished, hasDraftOrPublished, editorialState }: ProjectTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const handleTabChange = (view: TabView) => {
    const params = new URLSearchParams(searchParams.toString());
    // Always set ?view= explicitly so server picks the correct tab
    params.set('view', view);

    const newUrl = `${pathname}?${params.toString()}`;
    router.replace(newUrl);
  };

  // Calculate total selections count safely
  const totalSelections = project.rooms?.reduce((sum: number, room: any) => {
    return sum + (room.selections?.length || 0);
  }, 0) || 0;

  // Tab structure: BOARDS | MEDIA | (STORY) | (PUBLISH)
  // Visibility rules per editorial state (spec: 17_EDITORIAL_FLOW_SPEC.md §2):
  //   Story:   PUBLISHED only
  //   Publish: GENERATED, PUBLISHED, UNPUBLISHED
  const showStory = editorialState === 'PUBLISHED';
  const showPublish = editorialState === 'GENERATED' || editorialState === 'PUBLISHED' || editorialState === 'UNPUBLISHED';

  const allTabs = [
    {
      id: 'boards' as TabView,
      label: 'Boards',
      icon: LayoutGrid,
      badge: totalSelections > 0 ? totalSelections : undefined,
      visible: true,
    },
    {
      id: 'actions' as TabView,
      label: 'Action Items',
      icon: ClipboardList,
      visible: totalSelections > 0,
    },
    {
      id: 'media' as TabView,
      label: 'Media',
      icon: ImageIcon,
      visible: true,
    },
    {
      id: 'story' as TabView,
      label: 'Story',
      icon: MessageSquare,
      visible: showStory,
    },
    {
      id: 'publish' as TabView,
      label: 'Publish',
      icon: Share2,
      visible: showPublish,
    },
  ];

  const tabs = allTabs.filter(tab => tab.visible);

  return (
    <div className="bg-surface-ground py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="ridge-toggle-group" role="tablist">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentView === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                className={`ridge-toggle-item ${isActive ? 'active' : ''}`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="ml-2 bg-surface-canvas text-folio-text-secondary text-xs px-2 py-0.5 rounded-full border border-folio-border-subtle">
                    ({tab.badge})
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}


'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { LayoutGrid, FolderOpen, Share2 } from 'lucide-react';

type TabView = 'overview' | 'media' | 'boards' | 'drafts' | 'files' | 'publish';

interface ProjectTabsProps {
  project: {
    id: string;
    title: string;
    rooms?: any[];
  };
  currentView: TabView;
}

export default function ProjectTabs({ project, currentView }: ProjectTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const handleTabChange = (view: TabView) => {
    const params = new URLSearchParams(searchParams.toString());
    // Boards is now default, so delete param when switching to it
    if (view === 'boards') {
      params.delete('view');
    } else {
      params.set('view', view);
    }

    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl);
  };

  // Calculate total selections count safely
  const totalSelections = project.rooms?.reduce((sum: number, room: any) => {
    return sum + (room.selections?.length || 0);
  }, 0) || 0;

  // New tab structure: BOARDS | FILES | PUBLISH
  const tabs = [
    {
      id: 'boards' as TabView,
      label: 'Boards',
      icon: LayoutGrid,
      badge: totalSelections > 0 ? totalSelections : undefined,
    },
    {
      id: 'files' as TabView,
      label: 'Files',
      icon: FolderOpen,
    },
    {
      id: 'publish' as TabView,
      label: 'Publish',
      icon: Share2,
    },
  ];

  return (
    <div className="bg-[var(--bg-elevated)] py-4">
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
                  <span className="ml-2 bg-[var(--bg-base)] text-[var(--text-secondary)] text-xs px-2 py-0.5 rounded-full border border-[var(--ridge-outer)]">
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


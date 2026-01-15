'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { FaThLarge, FaImages, FaFileAlt } from 'react-icons/fa';

type TabView = 'overview' | 'media' | 'boards' | 'drafts';

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

  // Tabs reordered: Boards first, then Media, then Drafts (Overview moved to hero kebab menu)
  const tabs = [
    {
      id: 'boards' as TabView,
      label: 'Designer Boards',
      icon: FaThLarge,
      badge: totalSelections > 0 ? totalSelections : undefined,
    },
    {
      id: 'media' as TabView,
      label: 'Media',
      icon: FaImages,
    },
    {
      id: 'drafts' as TabView,
      label: 'Story',
      icon: FaFileAlt,
    },
  ];

  return (
    <div className="border-b border-[var(--border-default)] bg-[var(--bg-elevated)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="-mb-px flex space-x-8" role="tablist">
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
                className={`
                  py-2 px-4 folio-ui font-medium flex items-center gap-2
                  transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:ring-offset-2
                  ${isActive
                    ? 'border-b-2 border-[var(--accent)] text-[var(--text-primary)]'
                    : 'border-b-2 border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)]'
                  }
                `}
              >
                {Icon && <Icon className="w-4 h-4" />}
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="ml-2 bg-[var(--bg-base)] text-[var(--text-secondary)] text-xs px-2 py-0.5 rounded-full">
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


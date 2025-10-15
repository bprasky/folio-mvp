'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { FaThLarge, FaImages } from 'react-icons/fa';

type TabView = 'overview' | 'media' | 'boards';

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

  // Tabs reordered: Boards first, then Media (Overview moved to hero kebab menu)
  const tabs = [
    {
      id: 'boards' as TabView,
      label: 'Designer Boards',
      icon: FaThLarge,
      badge: project.rooms?.length ? project.rooms.reduce((sum: number, room: any) => sum + (room.selections?.length || 0), 0) : 0,
    },
    {
      id: 'media' as TabView,
      label: 'Media',
      icon: FaImages,
    },
  ];

  return (
    <div className="border-b border-neutral-200 bg-white/70 backdrop-blur">
      <div className="container mx-auto px-8">
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
                  py-2 px-4 text-sm font-medium flex items-center gap-2
                  transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2
                  ${isActive 
                    ? 'border-b-2 border-neutral-900 text-neutral-900' 
                    : 'border-b-2 border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                  }
                `}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <span className="ml-2 bg-neutral-100 text-neutral-600 text-xs px-2 py-0.5 rounded-full">
                    {tab.badge}
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


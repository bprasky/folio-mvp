'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface ProfileTabsProps {
  userId: string;
  activeTab: string;
  expertiseEnabled?: boolean;
}

const TABS = [
  { id: 'feed', label: 'Feed' },
  { id: 'shop', label: 'Shop' },
  { id: 'about', label: 'About' },
];

export default function ProfileTabs({ userId, activeTab, expertiseEnabled = false }: ProfileTabsProps) {
  const searchParams = useSearchParams();

  const createTabUrl = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    // Remove feed-specific params when switching to about or shop tab
    if (tabId !== 'feed') {
      params.delete('filter');
      params.delete('sort');
    }
    return `/profile/${userId}?${params.toString()}`;
  };

  return (
    <div className="border-b border-folio-border-subtle">
      <div className="max-w-6xl mx-auto px-6">
        <nav className="flex gap-8 overflow-x-auto" aria-label="Profile tabs">
          {(expertiseEnabled ? [...TABS, { id: 'expertise', label: 'Expertise' }] : TABS).map(tab => (
            <Link
              key={tab.id}
              href={createTabUrl(tab.id)}
              className={`relative py-4 text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'text-folio-text-primary' : 'text-folio-text-secondary'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-folio-text-primary"
                />
              )}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface ProfileTabsProps {
  userId: string;
  activeTab: string;
}

const TABS = [
  { id: 'feed', label: 'Feed' },
  { id: 'about', label: 'About' },
];

export default function ProfileTabs({ userId, activeTab }: ProfileTabsProps) {
  const searchParams = useSearchParams();

  const createTabUrl = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    // Remove filter when switching to about tab
    if (tabId === 'about') {
      params.delete('filter');
      params.delete('sort');
    }
    return `/profile/${userId}?${params.toString()}`;
  };

  return (
    <div className="border-b" style={{ borderColor: '#E8E4DF' }}>
      <div className="max-w-6xl mx-auto px-6">
        <nav className="flex gap-8" aria-label="Profile tabs">
          {TABS.map(tab => (
            <Link
              key={tab.id}
              href={createTabUrl(tab.id)}
              className="relative py-4 text-sm font-medium transition-colors"
              style={{
                color: activeTab === tab.id ? '#2C2825' : '#8B8178',
              }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: '#2C2825' }}
                />
              )}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

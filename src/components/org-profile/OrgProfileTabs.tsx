'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface OrgProfileTabsProps {
  activeTab: string;
  orgId: string;
}

export default function OrgProfileTabs({ activeTab, orgId }: OrgProfileTabsProps) {
  const searchParams = useSearchParams();

  const createUrl = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'feed') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const queryString = params.toString();
    return `/org/${orgId}${queryString ? `?${queryString}` : ''}`;
  };

  const tabs = [
    { id: 'feed', label: 'Feed' },
    { id: 'about', label: 'About' },
  ];

  return (
    <div
      className="sticky top-0 z-10 border-b"
      style={{ borderColor: '#E8E4DF', backgroundColor: '#FAF9F7' }}
    >
      <div className="max-w-6xl mx-auto px-6 flex gap-8">
        {tabs.map(tab => (
          <Link
            key={tab.id}
            href={createUrl(tab.id)}
            className="py-4 text-sm relative"
            style={{
              color: activeTab === tab.id ? '#2C2825' : '#8B8178',
              fontWeight: activeTab === tab.id ? 500 : 400,
            }}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: '#2C2825' }}
              />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

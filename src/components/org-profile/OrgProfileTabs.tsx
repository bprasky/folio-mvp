'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface OrgProfileTabsProps {
  activeTab: string;
  orgId: string;
  defaultTab?: string;
  orgType?: string;
  isMember?: boolean;
  isAdmin?: boolean;
}

export default function OrgProfileTabs({ activeTab, orgId, defaultTab = 'feed', orgType, isMember, isAdmin }: OrgProfileTabsProps) {
  const searchParams = useSearchParams();

  const createUrl = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === defaultTab) {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const queryString = params.toString();
    return `/org/${orgId}${queryString ? `?${queryString}` : ''}`;
  };

  const VENDOR_ORG_TYPES = ['VENDOR', 'MANUFACTURER', 'SHOWROOM'];
  const DESIGN_ORG_TYPES = ['DESIGN_FIRM', 'ARCHITECTURE_FIRM'];

  const tabs = [
    { id: 'feed', label: 'Feed' },
    { id: 'projects', label: 'Projects' },
    { id: 'shop', label: 'Shop' },
    // Relationships tab: only for vendor orgs, only for members
    ...(isMember && orgType && VENDOR_ORG_TYPES.includes(orgType)
      ? [{ id: 'relationships', label: 'Relationships' }]
      : []),
    { id: 'about', label: 'About' },
    { id: 'contact', label: 'Contact' },
  ];

  return (
    <div
      className="sticky top-0 z-10 border-b border-folio-border-subtle bg-surface-ground"
    >
      <div className="max-w-6xl mx-auto px-6 flex gap-8">
        {tabs.map(tab => (
          <Link
            key={tab.id}
            href={createUrl(tab.id)}
            className={`py-4 text-sm relative ${activeTab === tab.id ? 'text-folio-text-primary font-medium' : 'text-folio-text-secondary font-normal'}`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-folio-text-primary"
              />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

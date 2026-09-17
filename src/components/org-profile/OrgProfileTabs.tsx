'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface OrgProfileTabsProps {
  activeTab: string;
  orgId: string;
  defaultTab?: string;
  orgType?: string;
  isMember?: boolean;
}

export default function OrgProfileTabs({ activeTab, orgId, defaultTab = 'feed', orgType, isMember }: OrgProfileTabsProps) {
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
  const isVendorOrg = orgType && VENDOR_ORG_TYPES.includes(orgType);

  const tabs = isVendorOrg
    ? [
        // Vendor-specific tabs: Feed, Shop, Team & Inquiries, About
        { id: 'feed', label: 'Feed' },
        { id: 'shop', label: 'Shop' },
        { id: 'team', label: 'Team & Inquiries' },
        ...(isMember ? [{ id: 'relationships', label: 'Relationships' }] : []),
        { id: 'about', label: 'About' },
      ]
    : [
        // Published projects live in the Feed; a second projects grid duplicated them.
        { id: 'feed', label: 'Feed' },
        { id: 'shop', label: 'Shop' },
        { id: 'about', label: 'About' },
        { id: 'contact', label: 'Contact' },
      ];

  return (
    <div
      className="sticky top-0 z-10 border-b"
      style={{ borderColor: '#E8E4DF', backgroundColor: 'var(--surface-ground)' }}
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

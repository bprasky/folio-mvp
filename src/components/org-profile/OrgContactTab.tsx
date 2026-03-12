'use client';

import Link from 'next/link';

interface OrgContactTabProps {
  org: {
    website: string | null;
    location?: string | null;
    address?: string | null;
    serviceRegions?: string[];
  };
  isOwner: boolean;
}

export default function OrgContactTab({ org, isOwner }: OrgContactTabProps) {
  const hasInfo = org.website || org.location || org.address || (org.serviceRegions && org.serviceRegions.length > 0);

  if (!hasInfo) {
    return (
      <div className="text-center py-16">
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{ background: '#F0EDE9' }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8B8178" strokeWidth="1.5">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p style={{ fontFamily: 'var(--font-body, "Instrument Sans", sans-serif)', fontSize: '15px', color: '#8B8178' }}>
          No contact information yet
        </p>
        {isOwner && (
          <p style={{ fontFamily: 'var(--font-body, "Instrument Sans", sans-serif)', fontSize: '13px', color: '#A69E96', marginTop: '4px' }}>
            Add your contact details in your organization settings.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h3 className="text-lg font-semibold mb-6" style={{ color: '#2C2825', fontFamily: 'Georgia, serif' }}>
        Get in Touch
      </h3>

      <div className="space-y-5">
        {(org.location || org.address) && (
          <div>
            <div className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: '#A69E96' }}>
              Location
            </div>
            <div className="text-[15px]" style={{ color: '#2C2825' }}>
              {org.address || org.location}
            </div>
          </div>
        )}

        {org.serviceRegions && org.serviceRegions.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: '#A69E96' }}>
              Service Area
            </div>
            <div className="flex flex-wrap gap-1.5">
              {org.serviceRegions.map(region => (
                <span
                  key={region}
                  className="inline-block px-3 py-1 rounded-full text-[12px]"
                  style={{ backgroundColor: '#F0EDE9', color: '#5C554D' }}
                >
                  {region}
                </span>
              ))}
            </div>
          </div>
        )}

        {org.website && (
          <div>
            <div className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: '#A69E96' }}>
              Website
            </div>
            <a
              href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[15px] underline underline-offset-2"
              style={{ color: '#2C2825' }}
            >
              {org.website.replace(/^https?:\/\//, '')}
            </a>
          </div>
        )}

        <div className="pt-4 mt-6" style={{ borderTop: '1px solid #E8E4DF' }}>
          <p className="text-[13px]" style={{ color: '#A69E96' }}>
            Inquiry form coming soon. In the meantime, visit their website to get in touch.
          </p>
        </div>
      </div>
    </div>
  );
}

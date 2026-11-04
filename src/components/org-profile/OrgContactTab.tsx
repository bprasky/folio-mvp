'use client';

import { useRouter } from 'next/navigation';
import InquiryComposer from '@/components/messaging/InquiryComposer';

interface OrgContactTabProps {
  org: {
    id: string;
    name: string;
    website: string | null;
    location?: string | null;
    address?: string | null;
    serviceRegions?: string[];
  };
  isMember: boolean;
  currentUser: { id: string; name: string } | null;
}

export default function OrgContactTab({ org, isMember, currentUser }: OrgContactTabProps) {
  const router = useRouter();
  const hasInfo = org.website || org.location || org.address || (org.serviceRegions && org.serviceRegions.length > 0);

  return (
    <div className="max-w-lg mx-auto">
      {hasInfo && (
        <>
          <h3 className="text-lg font-semibold mb-6" style={{ color: 'var(--folio-text-primary)', fontFamily: 'var(--font-headline), Georgia, serif' }}>
            Get in Touch
          </h3>

          <div className="space-y-5">
            {(org.location || org.address) && (
              <div>
                <div className="text-[var(--type-eyebrow)] uppercase tracking-wider mb-1.5" style={{ color: 'var(--folio-text-secondary)' }}>
                  Location
                </div>
                <div className="text-[var(--type-body)]" style={{ color: 'var(--folio-text-primary)' }}>
                  {org.address || org.location}
                </div>
              </div>
            )}

            {org.serviceRegions && org.serviceRegions.length > 0 && (
              <div>
                <div className="text-[var(--type-eyebrow)] uppercase tracking-wider mb-1.5" style={{ color: 'var(--folio-text-secondary)' }}>
                  Service Area
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {org.serviceRegions.map(region => (
                    <span
                      key={region}
                      className="inline-block px-3 py-1 rounded-full text-[var(--type-meta)]"
                      style={{ backgroundColor: 'var(--surface-ground)', color: 'var(--folio-text-secondary)' }}
                    >
                      {region}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {org.website && (
              <div>
                <div className="text-[var(--type-eyebrow)] uppercase tracking-wider mb-1.5" style={{ color: 'var(--folio-text-secondary)' }}>
                  Website
                </div>
                <a
                  href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--type-body)] underline underline-offset-2"
                  style={{ color: 'var(--folio-text-primary)' }}
                >
                  {org.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
          </div>

          <div className="my-8" style={{ borderTop: '1px solid var(--folio-border-subtle)' }} />
        </>
      )}

      {/* Messaging section */}
      {!currentUser ? (
        <div className="text-center py-12">
          <p className="text-[var(--type-body)] mb-4" style={{ color: 'var(--folio-text-secondary)' }}>
            Sign in to send {org.name} a message.
          </p>
          <a
            href={`/auth/signin?callbackUrl=${encodeURIComponent(`/org/${org.id}?tab=contact#profile-content`)}`}
            className="inline-block px-6 py-3 rounded-xl text-white text-sm"
            style={{ backgroundColor: 'var(--folio-text-primary)', color: 'var(--surface-canvas)' }}
          >
            Sign in to reach out
          </a>
        </div>
      ) : isMember ? (
        <div className="text-center py-8">
          <p className="text-[var(--type-meta)]" style={{ color: 'var(--folio-text-secondary)' }}>
            Visitors can send your team a message here.
          </p>
        </div>
      ) : (
        <InquiryComposer
          recipientOrg={{ id: org.id, name: org.name }}
          context="CLIENT_INQUIRY"
          placeholder={`What are you working on? Tell ${org.name} a little about your project.`}
          onSent={(conversationId) => {
            router.push(`/inbox/${conversationId}`);
          }}
        />
      )}
    </div>
  );
}

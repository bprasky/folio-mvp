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
  isOwner: boolean;
  currentUser: { id: string; name: string } | null;
}

export default function OrgContactTab({ org, isOwner, currentUser }: OrgContactTabProps) {
  const router = useRouter();
  const hasInfo = org.website || org.location || org.address || (org.serviceRegions && org.serviceRegions.length > 0);

  return (
    <div className="max-w-lg">
      {hasInfo && (
        <>
          <h3 className="text-lg font-semibold mb-6 text-folio-text-primary" style={{ fontFamily: 'Georgia, serif' }}>
            Get in Touch
          </h3>

          <div className="space-y-5">
            {(org.location || org.address) && (
              <div>
                <div className="text-[11px] uppercase tracking-wider mb-1.5 text-folio-text-tertiary">
                  Location
                </div>
                <div className="text-[15px] text-folio-text-primary">
                  {org.address || org.location}
                </div>
              </div>
            )}

            {org.serviceRegions && org.serviceRegions.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider mb-1.5 text-folio-text-tertiary">
                  Service Area
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {org.serviceRegions.map(region => (
                    <span
                      key={region}
                      className="inline-block px-3 py-1 rounded-full text-[12px] bg-surface-elevated text-folio-text-secondary"
                    >
                      {region}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {org.website && (
              <div>
                <div className="text-[11px] uppercase tracking-wider mb-1.5 text-folio-text-tertiary">
                  Website
                </div>
                <a
                  href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[15px] underline underline-offset-2 text-folio-text-primary"
                >
                  {org.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
          </div>

          <div className="my-8 border-t border-folio-border-subtle" />
        </>
      )}

      {/* Messaging section */}
      {!currentUser ? (
        <div className="text-center py-12">
          <p className="text-[15px] mb-4 text-folio-text-secondary">
            Sign in to send {org.name} a message.
          </p>
          <a
            href={`/login?returnTo=/org/${org.id}?tab=contact`}
            className="inline-block px-6 py-3 rounded-xl text-white text-sm bg-folio-text-primary"
          >
            Sign in to reach out
          </a>
          {org.website && (
            <p className="text-xs mt-6 text-folio-text-tertiary">
              Or visit{' '}
              <a
                href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {org.website.replace(/^https?:\/\//, '')}
              </a>
            </p>
          )}
        </div>
      ) : isOwner ? (
        <div className="text-center py-8">
          <p className="text-[13px] text-folio-text-tertiary">
            This is how visitors will see your contact page and send you messages.
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

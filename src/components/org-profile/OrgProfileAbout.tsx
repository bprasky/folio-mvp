'use client';

import SafeImage from '@/components/SafeImage';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  headshotUrl?: string | null;
  bio?: string | null;
}

interface OrgProfileAboutProps {
  org: {
    id: string;
    name: string;
    type: string;
    description?: string | null;
    logo?: string | null;
    website?: string | null;
    phone?: string | null;
    address?: string | null;
    philosophy?: string | null;
    foundedYear?: number | null;
  };
  team: TeamMember[];
  isAdmin?: boolean;
}

export default function OrgProfileAbout({ org, team, isAdmin = false }: OrgProfileAboutProps) {
  const philosophy = (org as any).philosophy;
  const foundedYear = (org as any).foundedYear;

  return (
    <div>
      {/* Philosophy Quote */}
      {philosophy && (
        <div
          className="text-center py-8 mb-8 border-b border-folio-border-subtle"
        >
          <blockquote
            className="text-xl md:text-2xl italic max-w-2xl mx-auto text-folio-text-primary"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            "{philosophy}"
          </blockquote>
          <p className="mt-4 text-sm text-folio-text-secondary">
            — {org.name}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-12">
        {/* Left Column - Image & Details */}
        <div className="md:col-span-2">
          <div
            className="aspect-[3/4] rounded-lg mb-6 overflow-hidden relative bg-folio-border-subtle"
          >
            {org.logo && (
              <SafeImage
                src={org.logo}
                alt={org.name}
                fill
                className="object-cover"
              />
            )}
          </div>

          <div className="space-y-3 text-sm text-folio-text-secondary">
            {foundedYear && <DetailRow label="Founded" value={foundedYear} />}
            {team.length > 0 && <DetailRow label="Team Size" value={`${team.length} members`} />}
            {org.address && <DetailRow label="Location" value={org.address} />}
            {org.website && (
              <DetailRow
                label="Website"
                value={
                  <a
                    href={org.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline text-folio-text-primary"
                  >
                    {org.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                }
              />
            )}
          </div>
        </div>

        {/* Right Column - About & Team */}
        <div className="md:col-span-3">
          <h2
            className="text-xl mb-6 text-folio-text-primary"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            About
          </h2>
          <p className="text-folio-text-secondary">
            {org.description || 'No description yet.'}
          </p>

          {/* Team Section */}
          {team.length > 0 && (
            <div
              className="mt-12 pt-8 border-t border-folio-border-subtle"
            >
              <h3
                className="text-lg mb-6 text-folio-text-primary"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                Team
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {team.map(member => (
                  <div key={member.id} className="flex gap-4">
                    <div
                      className="w-14 h-14 rounded-full flex-shrink-0 overflow-hidden bg-folio-border-subtle"
                    >
                      {member.headshotUrl ? (
                        <SafeImage
                          src={member.headshotUrl}
                          alt={member.name}
                          width={56}
                          height={56}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-lg font-light text-folio-text-secondary"
                        >
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <p
                        className="text-sm font-medium text-folio-text-primary"
                      >
                        {member.name}
                      </p>
                      <p className="text-xs text-folio-text-secondary">
                        {member.role}
                      </p>
                      {member.bio && (
                        <p
                          className="text-xs mt-1 line-clamp-2 text-folio-text-secondary"
                        >
                          {member.bio}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty Team State for Admins */}
          {team.length === 0 && isAdmin && (
            <div
              className="mt-12 pt-8 border-t border-folio-border-subtle text-center py-8"
            >
              <p className="text-folio-text-secondary">No team members added yet</p>
              <button
                className="mt-4 px-4 py-2 text-sm rounded-full border hover:bg-surface-ground border-folio-border-strong text-folio-text-secondary"
              >
                Add Team Members
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex justify-between py-2 border-b border-folio-border-subtle"
    >
      <span>{label}</span>
      <span className="text-folio-text-primary">{value}</span>
    </div>
  );
}

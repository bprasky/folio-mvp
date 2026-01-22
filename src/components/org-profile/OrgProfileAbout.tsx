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
          className="text-center py-8 mb-8 border-b"
          style={{ borderColor: '#E8E4DF' }}
        >
          <blockquote
            className="text-xl md:text-2xl italic max-w-2xl mx-auto"
            style={{ fontFamily: 'Georgia, serif', color: '#2C2825' }}
          >
            "{philosophy}"
          </blockquote>
          <p className="mt-4 text-sm" style={{ color: '#8B8178' }}>
            — {org.name}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-12">
        {/* Left Column - Image & Details */}
        <div className="md:col-span-2">
          <div
            className="aspect-[3/4] rounded-lg mb-6 overflow-hidden relative"
            style={{ backgroundColor: '#E8E4DF' }}
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

          <div className="space-y-3 text-sm" style={{ color: '#6B635B' }}>
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
                    className="hover:underline"
                    style={{ color: '#2C2825' }}
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
            className="text-xl mb-6"
            style={{ fontFamily: 'Georgia, serif', color: '#2C2825' }}
          >
            About
          </h2>
          <p style={{ color: '#5C564F' }}>
            {org.description || 'No description yet.'}
          </p>

          {/* Team Section */}
          {team.length > 0 && (
            <div
              className="mt-12 pt-8 border-t"
              style={{ borderColor: '#E8E4DF' }}
            >
              <h3
                className="text-lg mb-6"
                style={{ fontFamily: 'Georgia, serif', color: '#2C2825' }}
              >
                Team
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {team.map(member => (
                  <div key={member.id} className="flex gap-4">
                    <div
                      className="w-14 h-14 rounded-full flex-shrink-0 overflow-hidden"
                      style={{ backgroundColor: '#E8E4DF' }}
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
                          className="w-full h-full flex items-center justify-center text-lg font-light"
                          style={{ color: '#6B635B' }}
                        >
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <p
                        className="text-sm font-medium"
                        style={{ color: '#2C2825' }}
                      >
                        {member.name}
                      </p>
                      <p className="text-xs" style={{ color: '#8B8178' }}>
                        {member.role}
                      </p>
                      {member.bio && (
                        <p
                          className="text-xs mt-1 line-clamp-2"
                          style={{ color: '#6B635B' }}
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
              className="mt-12 pt-8 border-t text-center py-8"
              style={{ borderColor: '#E8E4DF' }}
            >
              <p style={{ color: '#8B8178' }}>No team members added yet</p>
              <button
                className="mt-4 px-4 py-2 text-sm rounded-full border hover:bg-stone-50"
                style={{ borderColor: '#D4CEC6', color: '#6B635B' }}
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
      className="flex justify-between py-2 border-b"
      style={{ borderColor: '#E8E4DF' }}
    >
      <span>{label}</span>
      <span style={{ color: '#2C2825' }}>{value}</span>
    </div>
  );
}

'use client';

import SafeImage from '@/components/SafeImage';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  headshotUrl?: string | null;
  bio?: string | null;
  linkedUser?: {
    id: string;
    name: string;
    profileImage?: string | null;
  } | null;
}

interface ProfileInterview {
  generatedBio?: string | null;
  shortBio?: string | null;
  pullQuotes?: string[] | null;
  philosophyStatement?: string | null;
  processDescription?: string | null;
  status?: string;
}

interface Organization {
  id: string;
  name: string;
  type: string;
  logo?: string | null;
}

interface ProfileAboutProps {
  user: {
    id: string;
    name: string;
    bio?: string | null;
    title?: string | null;
    location?: string | null;
    website?: string | null;
    instagram?: string | null;
    linkedin?: string | null;
    specialties?: string[];
    createdAt?: string | Date;
    profileInterview?: ProfileInterview | null;
    // Architect-specific
    architectLicenseNumber?: string | null;
    architectLicensedStates?: string[];
    architectProjectScale?: string[];
    architectSpecializations?: string[];
    // Builder-specific
    builderProjectTypes?: string[];
    builderSquareFootageRange?: string | null;
    builderSpecialtyTrades?: string[];
    builderYearsInBusiness?: number | null;
  };
  team?: TeamMember[];
  organization?: Organization | null;
}

export default function ProfileAbout({ user, team = [], organization }: ProfileAboutProps) {
  const interview = user.profileInterview;
  const bio = interview?.generatedBio || user.bio;
  const processDescription = interview?.processDescription;
  const pullQuotes = interview?.pullQuotes as string[] | null;

  // Determine user profession type
  const isArchitect = user.architectLicenseNumber || (user.architectLicensedStates?.length ?? 0) > 0;
  const isBuilder = (user.builderProjectTypes?.length ?? 0) > 0;

  const joinYear = user.createdAt ? new Date(user.createdAt).getFullYear() : null;

  return (
    <div className="space-y-12">
      {/* Bio Section */}
      {bio && (
        <section>
          <SectionTitle>About</SectionTitle>
          <div
            className="prose prose-stone max-w-none text-folio-text-secondary"
            style={{ lineHeight: 1.8 }} /* folio-design-system: off-scale */
          >
            <p className="text-base whitespace-pre-line">{bio}</p>
          </div>
        </section>
      )}

      {/* Philosophy Quote */}
      {pullQuotes && pullQuotes.length > 0 && (
        <section
          className="py-8 px-6 rounded-xl -mx-2 bg-surface-elevated"
        >
          <blockquote
            className="text-xl md:text-2xl font-light italic text-center text-folio-text-primary"
            style={{ fontFamily: 'Georgia, serif', maxWidth: '640px', margin: '0 auto' }}
          >
            "{pullQuotes[0]}"
          </blockquote>
          <p className="text-center mt-4 text-sm text-folio-text-secondary">
            — {user.name}
          </p>
        </section>
      )}

      {/* Process Description */}
      {processDescription && (
        <section>
          <SectionTitle>Design Process</SectionTitle>
          <div className="text-folio-text-secondary" style={{ lineHeight: 1.8 }}> /* folio-design-system: off-scale */
            <p className="text-base whitespace-pre-line">{processDescription}</p>
          </div>
        </section>
      )}

      {/* Architect-specific Info */}
      {isArchitect && (
        <section>
          <SectionTitle>Credentials</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {user.architectLicenseNumber && (
              <InfoCard label="License Number" value={user.architectLicenseNumber} />
            )}
            {user.architectLicensedStates && user.architectLicensedStates.length > 0 && (
              <InfoCard
                label="Licensed States"
                value={user.architectLicensedStates.join(', ')}
              />
            )}
            {user.architectProjectScale && user.architectProjectScale.length > 0 && (
              <InfoCard
                label="Project Scale"
                value={user.architectProjectScale.map(formatLabel).join(', ')}
              />
            )}
            {user.architectSpecializations && user.architectSpecializations.length > 0 && (
              <InfoCard
                label="Specializations"
                value={user.architectSpecializations.map(formatLabel).join(', ')}
              />
            )}
          </div>
        </section>
      )}

      {/* Builder-specific Info */}
      {isBuilder && (
        <section>
          <SectionTitle>Builder Profile</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {user.builderProjectTypes && user.builderProjectTypes.length > 0 && (
              <InfoCard
                label="Project Types"
                value={user.builderProjectTypes.map(formatLabel).join(', ')}
              />
            )}
            {user.builderSquareFootageRange && (
              <InfoCard label="Square Footage Range" value={user.builderSquareFootageRange} />
            )}
            {user.builderSpecialtyTrades && user.builderSpecialtyTrades.length > 0 && (
              <InfoCard
                label="Specialty Trades"
                value={user.builderSpecialtyTrades.map(formatLabel).join(', ')}
              />
            )}
            {user.builderYearsInBusiness && (
              <InfoCard
                label="Years in Business"
                value={`${user.builderYearsInBusiness} years`}
              />
            )}
          </div>
        </section>
      )}

      {/* Specialties */}
      {user.specialties && user.specialties.length > 0 && (
        <section>
          <SectionTitle>Specialties</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {user.specialties.map(specialty => (
              <span
                key={specialty}
                className="px-4 py-2 text-sm rounded-full bg-surface-elevated text-folio-text-secondary"
              >
                {specialty}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Team Section */}
      {team.length > 0 && (
        <section>
          <SectionTitle>Team</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {team.map(member => (
              <TeamMemberCard key={member.id} member={member} />
            ))}
          </div>
        </section>
      )}

      {/* Organization */}
      {organization && (
        <section>
          <SectionTitle>Firm</SectionTitle>
          <div
            className="flex items-center gap-4 p-4 rounded-xl bg-surface-elevated"
          >
            {organization.logo ? (
              <div
                className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-surface-canvas"
              >
                <SafeImage
                  src={organization.logo}
                  alt={organization.name}
                  width={64}
                  height={64}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 bg-folio-border-subtle text-folio-text-secondary"
              >
                <BuildingIcon />
              </div>
            )}
            <div>
              <p className="font-medium text-folio-text-primary">
                {organization.name}
              </p>
              <p className="text-sm text-folio-text-secondary">
                {formatOrgType(organization.type)}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Footer info */}
      <section
        className="pt-8 border-t flex flex-wrap gap-6 border-folio-border-subtle"
      >
        {joinYear && (
          <div className="text-sm text-folio-text-secondary">
            <span className="font-medium text-folio-text-secondary">
              Member since
            </span>{' '}
            {joinYear}
          </div>
        )}
        {user.location && (
          <div className="text-sm text-folio-text-secondary">
            <span className="font-medium text-folio-text-secondary">
              Based in
            </span>{' '}
            {user.location}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-sm uppercase tracking-wider font-medium mb-4 text-folio-text-secondary"
    >
      {children}
    </h2>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="p-4 rounded-lg bg-surface-elevated"
    >
      <p className="text-xs uppercase tracking-wider mb-1 text-folio-text-secondary">
        {label}
      </p>
      <p className="font-medium text-folio-text-primary">
        {value}
      </p>
    </div>
  );
}

function TeamMemberCard({ member }: { member: TeamMember }) {
  const imageUrl = member.linkedUser?.profileImage || member.headshotUrl;
  const name = member.linkedUser?.name || member.name;
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="p-4 rounded-xl text-center bg-surface-elevated"
    >
      <div
        className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-3 bg-folio-border-subtle"
      >
        {imageUrl ? (
          <SafeImage
            src={imageUrl}
            alt={name}
            width={64}
            height={64}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-lg font-light text-folio-text-secondary"
          >
            {initials}
          </div>
        )}
      </div>
      <p className="font-medium text-folio-text-primary">
        {name}
      </p>
      <p className="text-sm text-folio-text-secondary">
        {member.role}
      </p>
      {member.bio && (
        <p className="text-xs mt-2 line-clamp-2 text-folio-text-secondary">
          {member.bio}
        </p>
      )}
    </div>
  );
}

function formatLabel(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatOrgType(type: string): string {
  const typeMap: Record<string, string> = {
    VENDOR: 'Vendor',
    DESIGN_FIRM: 'Design Firm',
    MANUFACTURER: 'Manufacturer',
    SHOWROOM: 'Showroom',
    CONTRACTOR: 'Contractor',
    ARCHITECTURE_FIRM: 'Architecture Firm',
  };
  return typeMap[type] || type;
}

function BuildingIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-3" />
      <path d="M9 9v.01" />
      <path d="M9 12v.01" />
      <path d="M9 15v.01" />
      <path d="M9 18v.01" />
    </svg>
  );
}

'use client';

import Link from 'next/link';
import SafeImage from '@/components/SafeImage';

interface ProfileHeroProps {
  user: {
    name: string;
    title?: string | null;
    location?: string | null;
    bio?: string | null;
    profileImage?: string | null;
    specialties?: string[];
    website?: string | null;
    instagram?: string | null;
    linkedin?: string | null;
  };
  organization?: { id: string; name: string } | null;
  profileInterview?: {
    shortBio?: string | null;
    philosophyStatement?: string | null;
  } | null;
  saveCount: number;
  boardCount: number;
  isOwner: boolean;
}

export default function ProfileHero({
  user,
  organization,
  profileInterview,
  saveCount,
  boardCount,
  isOwner,
}: ProfileHeroProps) {
  const tagline = profileInterview?.shortBio || user.bio;
  const fingerprint = user.specialties || [];

  const initials = user.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="profile-hero" style={{ maxWidth: 960, margin: '0 auto', padding: '36px 24px 0' }}>
      <div className="flex gap-6 items-start mb-7">
        {/* Avatar */}
        <div className="profile-avatar flex-shrink-0">
          {user.profileImage ? (
            <SafeImage
              src={user.profileImage}
              alt={user.name}
              width={96}
              height={96}
              className="w-24 h-24 rounded-full object-cover"
            />
          ) : (
            <div className="profile-avatar-fallback">{initials}</div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1 className="folio-h2 mb-0.5">{user.name}</h1>
          {(user.title || organization) && (
            <div className="folio-body mb-0.5">
              {user.title && organization ? (
                <>
                  {user.title} at{' '}
                  <Link href={`/org/${organization.id}`} style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                    {organization.name} ↗
                  </Link>
                </>
              ) : user.title ? (
                user.title
              ) : organization ? (
                <Link href={`/org/${organization.id}`} style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                  {organization.name} ↗
                </Link>
              ) : null}
            </div>
          )}
          {user.location && (
            <div className="folio-meta mb-3.5">{user.location}</div>
          )}

          {/* Stats */}
          <div className="flex gap-8 mb-3.5">
            <StatPill value={saveCount} label="Saves" />
            <StatPill value={boardCount} label="Boards" />
          </div>

          {/* Tagline */}
          {tagline && (
            <p
              className="folio-quote mb-3"
              style={{ fontSize: '17px', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}
            >
              &ldquo;{tagline}&rdquo;
            </p>
          )}

          {/* Fingerprint tags */}
          {fingerprint.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-4">
              {fingerprint.map(tag => (
                <span key={tag} className="fingerprint-tag">{tag}</span>
              ))}
            </div>
          )}

          {/* CTAs */}
          <div className="flex gap-2.5 items-center">
            {isOwner ? (
              <>
                <Link
                  href="/profile"
                  className="accent-btn pill-btn px-7 py-2.5 text-[13px] no-underline inline-block"
                >
                  Edit Profile
                </Link>
                {organization && (
                  <Link
                    href={`/org/${organization.id}`}
                    className="ridge-btn pill-btn px-6 py-2 text-[13px] no-underline inline-block"
                  >
                    View {organization.name} ↗
                  </Link>
                )}
              </>
            ) : (
              <>
                <button className="accent-btn pill-btn px-7 py-2.5 text-[13px]">
                  Contact
                </button>
                <button className="ridge-btn pill-btn px-6 py-2 text-[13px]">
                  Follow
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .profile-avatar-fallback {
          width: 96px;
          height: 96px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--shadow-dark) 0%, var(--text-tertiary) 100%);
          color: var(--bg-base);
          font-size: 34px;
          font-weight: 600;
          letter-spacing: 0.05em;
          flex-shrink: 0;
        }
        .fingerprint-tag {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          border: 1px solid var(--border);
          font-family: var(--font-body);
          font-size: 11px;
          color: var(--text-secondary);
          letter-spacing: 0.03em;
          background: rgba(250, 250, 249, 0.5);
        }
        @media (max-width: 640px) {
          .profile-hero .flex.gap-6 {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          .profile-hero .flex.gap-8 {
            justify-content: center;
          }
          .profile-hero .flex.gap-1\\.5 {
            justify-content: center;
          }
          .profile-hero .flex.gap-2\\.5 {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}

function StatPill({ value, label }: { value: number; label: string }) {
  const formatted = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString();
  return (
    <div className="text-center">
      <div className="folio-h3" style={{ fontSize: '22px' }}>{formatted}</div>
      <div
        className="folio-meta"
        style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '1px' }}
      >
        {label}
      </div>
    </div>
  );
}

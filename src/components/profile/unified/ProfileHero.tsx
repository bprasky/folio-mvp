'use client';

import ProfileFollowButton from './ProfileFollowButton';
import Link from 'next/link';
import SafeImage from '@/components/SafeImage';

interface ProfileInterview {
  philosophyStatement?: string | null;
  shortBio?: string | null;
}

interface ProfileHeroProps {
  user: {
    id: string;
    name: string;
    title?: string | null;
    location?: string | null;
    bio?: string | null;
    profileImage?: string | null;
    specialties?: string[];
    followers?: number;
    website?: string | null;
    instagram?: string | null;
    linkedin?: string | null;
    profileInterview?: ProfileInterview | null;
  };
  projectCount?: number;
  featuredCount?: number;
  isOwner?: boolean;
  initiallyFollowing?: boolean;
}

export default function ProfileHero({
  user,
  projectCount = 0,
  featuredCount = 0,
  isOwner = false,
  initiallyFollowing = false,
}: ProfileHeroProps) {
  const tagline = user.profileInterview?.philosophyStatement || user.bio;
  const initials = user.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="border-b border-folio-border-subtle">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row items-start gap-6 md:gap-8">
          {/* Profile Image */}
          <div
            className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-folio-border-subtle"
          >
            {user.profileImage ? (
              <SafeImage
                src={user.profileImage}
                alt={user.name}
                width={112}
                height={112}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-2xl md:text-3xl font-medium bg-folio-border-subtle text-folio-text-secondary"
              >
                {initials}
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="min-w-0">
                <h1
                  className="break-words text-folio-h3 md:text-folio-h2 font-medium tracking-tight text-folio-text-primary"
                  style={{ fontFamily: 'var(--font-headline)' }}
                >
                  {user.name}
                </h1>
                <p className="text-sm mt-1 text-folio-text-secondary">
                  {user.title || 'Designer'}
                  {user.location && ` · ${user.location}`}
                </p>

                {tagline && (
                  <p
                    className="mt-3 text-base line-clamp-2 text-folio-text-secondary"
                    style={{ maxWidth: '480px' }}
                  >
                    {tagline}
                  </p>
                )}

                {/* Specialty Pills */}
                {user.specialties && user.specialties.length > 0 && (
                  <div className="flex gap-2 mt-4 flex-wrap">
                    {user.specialties.slice(0, 5).map(tag => (
                      <span
                        key={tag}
                        className="px-3 py-1 text-xs rounded-full bg-surface-elevated text-folio-text-secondary"
                      >
                        {tag}
                      </span>
                    ))}
                    {user.specialties.length > 5 && (
                      <span
                        className="px-3 py-1 text-xs rounded-full bg-surface-elevated text-folio-text-secondary"
                      >
                        +{user.specialties.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Stats & CTAs */}
              <div className="flex flex-col items-start md:items-end gap-4">
                <div className="flex gap-6 md:gap-8">
                  <Stat label="Projects" value={projectCount} />
                  <Stat label="Followers" value={user.followers || 0} />
                  <Stat label="Featured" value={featuredCount} />
                </div>

                <div className="flex gap-3">
                  {isOwner ? (
                    <Link
                      href="/profile"
                      className="min-h-11 px-5 py-2 text-sm rounded-full transition-all hover:opacity-80 bg-folio-text-primary text-surface-ground"
                    >
                      Edit Profile
                    </Link>
                  ) : (
                    <>
                      <ProfileFollowButton userId={user.id} initiallyFollowing={initiallyFollowing} />
                      {user.website && <a href={user.website} target="_blank" rel="noopener noreferrer"
                        className="min-h-11 px-5 py-2 text-sm rounded-full border border-folio-text-primary text-folio-text-primary">Visit website</a>}
                    </>
                  )}
                </div>

                {/* Social Links */}
                {(user.website || user.instagram || user.linkedin) && (
                  <div className="flex gap-4 text-sm text-folio-text-secondary">
                    {user.website && (
                      <a
                        href={user.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        Website
                      </a>
                    )}
                    {user.instagram && (
                      <a
                        href={`https://instagram.com/${user.instagram.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        Instagram
                      </a>
                    )}
                    {user.linkedin && (
                      <a
                        href={user.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        LinkedIn
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const formatted = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString();

  return (
    <div className="text-center">
      <div className="text-xl md:text-2xl font-medium text-folio-text-primary">
        {formatted}
      </div>
      <div className="text-xs text-folio-text-secondary">
        {label}
      </div>
    </div>
  );
}

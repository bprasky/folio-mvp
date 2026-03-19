'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import SafeImage from '@/components/SafeImage';

interface OrgProfileHeroProps {
  org: {
    id: string;
    name: string;
    type: string;
    logo?: string | null;
    tagline?: string | null;
    location?: string | null;
    specialties?: string[];
    website?: string | null;
  };
  projectCount: number;
  featuredCount: number;
  followerCount: number;
  isOwner?: boolean;
  isMember?: boolean;
}

const DESIGN_ORG_TYPES = ['DESIGN_FIRM', 'ARCHITECTURE_FIRM'];

export default function OrgProfileHero({
  org,
  projectCount,
  featuredCount,
  followerCount,
  isOwner = false,
  isMember = false,
}: OrgProfileHeroProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  const showVendorsLink = isMember && DESIGN_ORG_TYPES.includes(org.type);
  const initials = org.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="border-b" style={{ borderColor: '#E8E4DF' }}>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row items-start gap-6 md:gap-8">
          {/* Logo */}
          <div
            className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden flex-shrink-0 ring-2"
            style={{ ringColor: '#E8E4DF' }}
          >
            {org.logo ? (
              <SafeImage
                src={org.logo}
                alt={org.name}
                width={112}
                height={112}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-2xl md:text-3xl font-light"
                style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
              >
                {initials}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="min-w-0">
                <h1
                  className="text-2xl md:text-3xl font-light tracking-tight"
                  style={{ fontFamily: 'Georgia, serif', color: '#2C2825' }}
                >
                  {org.name}
                </h1>
                <p className="text-sm mt-1" style={{ color: '#8B8178' }}>
                  {getTypeLabel(org.type)}
                  {org.location && ` · ${org.location}`}
                </p>

                {(org as any).tagline && (
                  <p
                    className="mt-3 text-base line-clamp-2"
                    style={{ color: '#5C564F', maxWidth: '480px' }}
                  >
                    {(org as any).tagline}
                  </p>
                )}

                {/* Specialty Pills */}
                {(org as any).specialties && (org as any).specialties.length > 0 && (
                  <div className="flex gap-2 mt-4 flex-wrap">
                    {(org as any).specialties.slice(0, 5).map((tag: string) => (
                      <span
                        key={tag}
                        className="px-3 py-1 text-xs rounded-full"
                        style={{ backgroundColor: '#F0EDE9', color: '#6B635B' }}
                      >
                        {tag}
                      </span>
                    ))}
                    {(org as any).specialties.length > 5 && (
                      <span
                        className="px-3 py-1 text-xs rounded-full"
                        style={{ backgroundColor: '#F0EDE9', color: '#8B8178' }}
                      >
                        +{(org as any).specialties.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Stats & CTAs */}
              <div className="flex flex-col items-start md:items-end gap-4">
                <div className="flex gap-6 md:gap-8">
                  <Stat label="Projects" value={projectCount} />
                  <Stat label="Followers" value={followerCount} />
                  <Stat label="Featured" value={featuredCount} />
                </div>

                <div className="flex gap-3 items-center">
                  {isOwner ? (
                    <Link
                      href={`/org/${org.id}/settings`}
                      className="px-5 py-2 text-sm rounded-full transition-all hover:opacity-80"
                      style={{ backgroundColor: '#2C2825', color: '#FAF9F7' }}
                    >
                      Edit Profile
                    </Link>
                  ) : (
                    <>
                      <button
                        className="px-5 py-2 text-sm rounded-full transition-all hover:opacity-80"
                        style={{ backgroundColor: '#2C2825', color: '#FAF9F7' }}
                      >
                        Follow
                      </button>
                      <button
                        className="px-5 py-2 text-sm rounded-full border transition-all hover:bg-stone-50"
                        style={{ borderColor: '#2C2825', color: '#2C2825' }}
                      >
                        Contact
                      </button>
                    </>
                  )}

                  {showVendorsLink && (
                    <div className="relative" ref={menuRef}>
                      <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="w-9 h-9 rounded-full border flex items-center justify-center transition-all hover:bg-stone-50"
                        style={{ borderColor: '#E8E4DF', color: '#6B635B' }}
                        aria-label="More options"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <circle cx="8" cy="3" r="1.5" />
                          <circle cx="8" cy="8" r="1.5" />
                          <circle cx="8" cy="13" r="1.5" />
                        </svg>
                      </button>

                      {menuOpen && (
                        <div
                          className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg border z-50"
                          style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DF' }}
                        >
                          <Link
                            href={`/org/${org.id}/vendors`}
                            className="block px-4 py-3 text-sm transition-colors hover:bg-stone-50 rounded-lg"
                            style={{ color: '#2C2825' }}
                            onClick={() => setMenuOpen(false)}
                          >
                            Our Vendors
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Website Link */}
                {org.website && (
                  <a
                    href={org.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm hover:underline"
                    style={{ color: '#8B8178' }}
                  >
                    {org.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
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
      <div className="text-xl md:text-2xl font-light" style={{ color: '#2C2825' }}>
        {formatted}
      </div>
      <div className="text-xs" style={{ color: '#8B8178' }}>
        {label}
      </div>
    </div>
  );
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    DESIGN_FIRM: 'Interior Design',
    ARCHITECTURE_FIRM: 'Architecture',
    CONTRACTOR: 'Contractor',
    VENDOR: 'Vendor',
    MANUFACTURER: 'Manufacturer',
    SHOWROOM: 'Showroom',
    DEVELOPER: 'Developer',
  };
  return labels[type] || 'Design Firm';
}

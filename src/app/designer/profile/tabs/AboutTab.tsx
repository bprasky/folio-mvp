'use client';

import { useState } from 'react';
import SafeImage from '@/components/SafeImage';
import BioSetupFlow from '@/components/designer-bio/BioSetupFlow';
import type { ProfileTeamMember, DesignerBioData } from '../types';

interface AboutTabProps {
  user: {
    name: string;
    bio: string | null;
    website: string | null;
    instagram: string | null;
    linkedin: string | null;
  };
  profileInterview: {
    generatedBio: string | null;
    shortBio: string | null;
    pullQuotes: string[] | null;
    philosophyStatement: string | null;
    processDescription: string | null;
  } | null;
  designerBio: DesignerBioData | null;
  teamMembers: ProfileTeamMember[];
  organization: { name: string } | null;
  isOwner: boolean;
}

export default function AboutTab({
  user,
  profileInterview,
  designerBio,
  teamMembers,
  organization,
  isOwner,
}: AboutTabProps) {
  const [justPublished, setJustPublished] = useState(false);

  const bio = profileInterview?.generatedBio || user.bio;
  const pullQuotes = profileInterview?.pullQuotes;
  const philosophy = profileInterview?.philosophyStatement;
  const processDesc = profileInterview?.processDescription;

  const hasBio = !!bio;
  const hasPullQuote = pullQuotes && pullQuotes.length > 0;
  const hasPhilosophy = !!philosophy;
  const hasProcess = !!processDesc;
  const hasTeam = teamMembers.length > 0;
  const hasSocial = user.website || user.instagram || user.linkedin;

  const hasAnyContent = hasBio || hasPullQuote || hasPhilosophy || hasProcess || hasTeam || hasSocial;

  // Show setup flow for owners without published bio content
  const bioIsPublished = designerBio?.status === 'published';
  const showSetupFlow = isOwner && !hasAnyContent && !bioIsPublished && !justPublished;

  if (showSetupFlow) {
    return (
      <div className="py-8">
        <BioSetupFlow
          designerBio={designerBio}
          userWebsite={user.website}
          onPublished={() => {
            setJustPublished(true);
            // Reload page to fetch the published bio content
            window.location.reload();
          }}
        />
      </div>
    );
  }

  if (!hasAnyContent && !justPublished) {
    return (
      <div className="text-center py-16">
        <p className="folio-body" style={{ color: 'var(--text-tertiary)' }}>
          This designer hasn&rsquo;t added their bio yet.
        </p>
      </div>
    );
  }

  return (
    <div className="about-grid">
      {/* Left column */}
      <div className="about-col">
        {hasBio && (
          <section className="about-section">
            <h3 className="about-section-title">About</h3>
            <p className="folio-body whitespace-pre-line" style={{ lineHeight: 1.7 }}> /* folio-design-system: off-scale */
              {bio}
            </p>
          </section>
        )}

        {hasPullQuote && (
          <section className="about-quote-card">
            <div className="about-quote-mark">&ldquo;</div>
            <p className="folio-quote" style={{ fontSize: '19px', color: 'white', margin: 0, lineHeight: 'var(--lh-body)' }}> /* folio-design-system: off-scale */
              {pullQuotes![0]}
            </p>
          </section>
        )}

        {hasProcess && (
          <section className="about-section">
            <h3 className="about-section-title">Process</h3>
            <div className="flex items-center flex-wrap gap-0">
              {processDesc!.split(/\s*[→>]\s*/).map((step, i, arr) => (
                <div key={i} className="flex items-center">
                  <span className="about-process-step" data-first={i === 0}>
                    {step.trim()}
                  </span>
                  {i < arr.length - 1 && (
                    <svg width="18" height="10" viewBox="0 0 18 10" style={{ margin: '0 3px' }}>
                      <path d="M2 5h12M11 2l3 3-3 3" stroke="var(--shadow-dark)" strokeWidth="1.5" fill="none" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Right column */}
      <div className="about-col">
        {hasPhilosophy && (
          <section className="about-section">
            <h3 className="about-section-title">Design Philosophy</h3>
            <p className="folio-body" style={{ lineHeight: 1.7 }}> /* folio-design-system: off-scale */
              {philosophy}
            </p>
          </section>
        )}

        {hasTeam && (
          <section className="about-section">
            <h3 className="about-section-title">Team</h3>
            <div className="flex flex-col gap-2.5">
              {teamMembers.map(member => (
                <TeamRow key={member.id} member={member} />
              ))}
            </div>
          </section>
        )}

        {hasSocial && (
          <section className="about-section">
            <h3 className="about-section-title">Connect</h3>
            <div className="flex flex-col gap-2">
              {user.instagram && (
                <SocialLink
                  label={user.instagram.startsWith('@') ? user.instagram : `@${user.instagram}`}
                  sub="Instagram"
                  href={`https://instagram.com/${user.instagram.replace('@', '')}`}
                />
              )}
              {user.website && (
                <SocialLink
                  label={user.website.replace(/^https?:\/\//, '')}
                  sub="Website"
                  href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
                />
              )}
              {user.linkedin && (
                <SocialLink
                  label={user.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/(in\/)?/, '')}
                  sub="LinkedIn"
                  href={user.linkedin.startsWith('http') ? user.linkedin : `https://linkedin.com/in/${user.linkedin}`}
                />
              )}
            </div>
          </section>
        )}
      </div>

      <style jsx>{`
        .about-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        @media (max-width: 768px) {
          .about-grid {
            grid-template-columns: 1fr;
          }
        }
        .about-col {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .about-section {
          padding: 24px;
          border-radius: 12px;
          background: var(--surface-canvas);
          border: 1px solid var(--border);
        }
        .about-section-title {
          font-family: var(--font-headline);
          font-size: 20px;
          font-weight: 500;
          color: var(--text-primary);
          margin: 0 0 12px 0;
        }
        .about-quote-card {
          padding: 24px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--text-primary) 0%, #3D3630 100%);
        }
        .about-quote-mark {
          font-family: var(--font-headline);
          font-size: 32px;
          color: var(--accent);
          line-height: 1;
          margin-bottom: 8px;
        }
        .about-process-step {
          padding: 7px 16px;
          border-radius: 20px;
          background: var(--surface-ground);
          color: var(--text-secondary);
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 500;
        }
        .about-process-step[data-first='true'] {
          background: var(--text-primary);
          color: var(--surface-canvas);
        }
      `}</style>
    </div>
  );
}

function TeamRow({ member }: { member: ProfileTeamMember }) {
  const imageUrl = member.headshotUrl || member.profileImage;
  const initials = member.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex gap-3 items-center">
      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
        {imageUrl ? (
          <SafeImage
            src={imageUrl}
            alt={member.name}
            width={40}
            height={40}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-sm font-light"
            style={{ background: 'var(--surface-ground)', color: 'var(--text-tertiary)' }}
          >
            {initials}
          </div>
        )}
      </div>
      <div>
        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {member.name}
        </div>
        <div className="folio-meta">{member.role}</div>
      </div>
    </div>
  );
}

function SocialLink({ label, sub, href }: { label: string; sub: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="social-link flex justify-between items-center p-2.5 px-3.5 rounded-lg no-underline"
    >
      <div>
        <div className="text-[var(--type-meta)] font-medium" style={{ color: 'var(--text-primary)' }}>
          {label}
        </div>
        <div className="folio-meta" style={{ fontSize: 'var(--type-eyebrow)' }}>{sub}</div>
      </div>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
        <path d="M5 2h7v7M12 2L2 12" />
      </svg>
      <style jsx>{`
        .social-link {
          border: 1px solid var(--border);
          background: var(--surface-canvas);
          transition: background 0.15s ease;
        }
        .social-link:hover {
          background: var(--surface-ground);
        }
      `}</style>
    </a>
  );
}

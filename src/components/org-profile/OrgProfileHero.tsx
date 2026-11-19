'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import SafeImage from '@/components/SafeImage';
import {
  defaultOrgAppearance, profileFacts, profileIntroduction, PROFILE_FACTS,
  type OrgProfileAppearance, type ProfileCover, type ProfileOrganization,
} from '@/lib/org-profile-appearance';
import styles from './OrgProfileAppearance.module.css';

interface OrgProfileHeroProps {
  org: ProfileOrganization;
  projectCount: number;
  appearance?: OrgProfileAppearance;
  cover?: ProfileCover;
  year: number;
  isAdmin?: boolean;
  isMember?: boolean;
  preview?: boolean;
  studioDetails?: ReactNode;
  aboutOpen?: boolean;
  tools?: ReactNode;
}

export default function OrgProfileHero({ org, projectCount, appearance = defaultOrgAppearance(),
  cover = null, year, studioDetails, tools, aboutOpen = false, isAdmin = false, preview = false }: OrgProfileHeroProps) {
  const portrait = appearance.portrait;
  const cinematic = Boolean(portrait) || process.env.NEXT_PUBLIC_FOLIO_EDITORIAL_PROFILE_HERO === 'true' && Boolean(cover);
  const identityUrl = appearance.identity.mode === 'initials' ? null : appearance.identity.url || org.logo;
  const words = org.name.trim().split(/\s+/);
  const initials = /^[A-Z]{2,3}$/.test(words[0]) ? words[0] : words.map(word => word[0]).join('').slice(0, 2).toUpperCase();
  const facts = profileFacts(appearance, org, projectCount, year);
  const introduction = profileIntroduction(appearance, org);
  const vendor = ['VENDOR', 'MANUFACTURER', 'SHOWROOM'].includes(org.type);
  const hasProjects = !vendor && projectCount > 0;
  const profileUrl = `/org/${org.id}`;
  const typeLabel: Record<string, string> = { DESIGN_FIRM: 'Interior design studio', ARCHITECTURE_FIRM: 'Architecture studio',
    CONTRACTOR: 'Construction & craft', VENDOR: 'Design partner', MANUFACTURER: 'Design & making', SHOWROOM: 'Showroom', DEVELOPER: 'Property development' };

  return (
    <section className={`${styles.heroContainer} ${cinematic ? styles.cinematicHero : ''} ${portrait ? styles.withPortrait : ''}`} aria-label={preview ? 'Cover preview' : `${org.name} profile`}>
      {tools && <div className={styles.heroTools}>{tools}</div>}
      {!preview && isAdmin && (
        <nav className={styles.profileTools} aria-label="Manage profile">
          <span>Manage profile</span>
          <Link href={`${profileUrl}/settings#appearance`}>Customize page</Link>
          <Link href={`${profileUrl}/edit`}>Edit profile</Link>
        </nav>
      )}
      <div className={`${styles.cover} ${!cover ? styles.withoutPhoto : ''}`}>
        {cover && <SafeImage key={cover.url} src={cover.url} alt={cover.projectTitle || `${org.name} cover photograph`}
          fill priority={!preview} sizes="(max-width: 768px) 100vw, 95vw" className={styles.coverPhoto}
          style={{ objectPosition: `${appearance.coverPosition.x}% ${appearance.coverPosition.y}%` }} />}
        <div className={styles.glass}>
          <p className={styles.eyebrow}>{typeLabel[org.type] || 'Design studio'}</p>
          <div className={styles.identity}>
            {identityUrl ? <SafeImage key={identityUrl} src={identityUrl} alt={appearance.identity.mode === 'portrait' ? `${org.name} studio portrait` : `${org.name} logo`}
              width={180} height={180} className={appearance.identity.mode === 'portrait' ? styles.portrait : styles.logo} />
              : <span className={styles.initials} aria-label={`${org.name} monogram`}>{initials}</span>}
          </div>
          {preview ? <h2 className={styles.title}>{org.name}</h2> : <h1 className={styles.title}>{org.name}</h1>}
          {introduction && <p className={styles.introduction}>{introduction}</p>}
          {!preview && <div className={styles.coverActions}>
            {hasProjects && <Link className={styles.primaryButton} href={`${profileUrl}?tab=feed&filter=projects#profile-content`}>Explore projects</Link>}
            {!aboutOpen && <Link className={hasProjects ? styles.secondaryButton : styles.primaryButton} href={`${profileUrl}?tab=about#profile-content`}>About the studio</Link>}
            <Link className={styles.secondaryButton} href={`${profileUrl}?tab=${vendor ? 'team' : 'contact'}#profile-content`}>Get in touch</Link>
          </div>}
          {facts.length > 0 && <dl className={styles.facts}>
            {facts.map(fact => <div key={fact.key} className={styles.fact}>
              <dt>{PROFILE_FACTS.find(option => option.key === fact.key)?.label}</dt>
              <dd>{fact.value}</dd>
            </div>)}
          </dl>}
          {studioDetails && <div className={styles.heroDetails}>{studioDetails}</div>}
        </div>
        {portrait && <figure className={`${styles.founderPortrait} ${portrait.treatment === 'original' ? styles.originalPortrait : ''}`}
          style={{ '--portrait-position': `${portrait.position}%`, '--portrait-scale': portrait.scale / 100 } as CSSProperties}>
          <SafeImage key={portrait.treatment === 'cutout' ? portrait.cutoutUrl! : portrait.originalUrl}
            src={portrait.treatment === 'cutout' ? portrait.cutoutUrl! : portrait.originalUrl}
            alt={portrait.caption || `${org.name} studio portrait`} fill sizes="(max-width: 700px) 90vw, 45vw" priority={!preview} />
          {portrait.caption && <figcaption>{portrait.caption}</figcaption>}
        </figure>}
        {cover?.projectTitle && <span className={styles.photoCredit}>{cover.projectTitle}</span>}
      </div>
    </section>
  );
}

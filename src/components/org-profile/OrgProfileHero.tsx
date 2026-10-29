'use client';

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
}

export default function OrgProfileHero({ org, projectCount, appearance = defaultOrgAppearance(),
  cover = null, year, isAdmin = false, isMember = false, preview = false }: OrgProfileHeroProps) {
  const identityUrl = appearance.identity.mode === 'initials' ? null : appearance.identity.url || org.logo;
  const initials = org.name.split(/\s+/).filter(Boolean).map(word => word[0]).join('').slice(0, 2).toUpperCase();
  const facts = profileFacts(appearance, org, projectCount, year);
  const introduction = profileIntroduction(appearance, org);
  const vendor = ['VENDOR', 'MANUFACTURER', 'SHOWROOM'].includes(org.type);
  const typeLabel: Record<string, string> = { DESIGN_FIRM: 'Interior design studio', ARCHITECTURE_FIRM: 'Architecture studio',
    CONTRACTOR: 'Construction & craft', VENDOR: 'Design partner', MANUFACTURER: 'Design & making', SHOWROOM: 'Showroom', DEVELOPER: 'Property development' };

  return (
    <section className={styles.heroContainer} aria-label={preview ? 'Cover preview' : `${org.name} profile`}>
      {!preview && (
        <div className={styles.topline}>
          <span>{org.name}</span>
          <div className={styles.topActions}>
            {isMember && ['DESIGN_FIRM', 'ARCHITECTURE_FIRM'].includes(org.type) && <Link href={`/org/${org.id}/vendors`}>Our vendors</Link>}
            {isAdmin && <Link href={`/org/${org.id}/settings#appearance`}>Customize page</Link>}
            {isAdmin && <Link href={`/org/${org.id}/edit`}>Edit profile</Link>}
            <Link href={`/org/${org.id}?tab=${vendor ? 'team' : 'contact'}#profile-content`}>Get in touch</Link>
          </div>
        </div>
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
            {projectCount > 0 && <Link className={styles.primaryButton} href={`/org/${org.id}?tab=feed&filter=projects#profile-content`}>Explore projects</Link>}
            <Link className={styles.secondaryButton} href={`/org/${org.id}?tab=about#profile-content`}>About the firm</Link>
          </div>}
          {facts.length > 0 && <dl className={styles.facts}>
            {facts.map(fact => <div key={fact.key} className={styles.fact}>
              <dt>{PROFILE_FACTS.find(option => option.key === fact.key)?.label}</dt>
              <dd>{fact.value}</dd>
            </div>)}
          </dl>}
        </div>
        {cover?.projectTitle && <span className={styles.photoCredit}>{cover.projectTitle}</span>}
      </div>
    </section>
  );
}

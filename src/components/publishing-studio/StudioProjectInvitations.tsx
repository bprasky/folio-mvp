'use client';

import Link from 'next/link';
import type { ProjectPublicationInvitation } from '@/lib/publish/projectPublication';
import styles from './StudioProjectInvitations.module.css';

export function StudioProjectInvitations({ projects = [], subject = '' }: { projects?: ProjectPublicationInvitation[]; subject?: string }) {
  if (subject === 'about-me') return null;
  const visible = projects.filter(project => !subject || subject === 'studio-wide' || project.id === subject);
  if (!visible.length) return null;
  const card = (project: ProjectPublicationInvitation) => <li key={project.id} className={styles.project}>
    {project.thumbnail && <div className={styles.photo}>
      {/* Protected project photos use the viewer's existing session. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={project.thumbnail} alt="" loading="lazy" />
    </div>}
    <div className={styles.copy}><h3 className="folio-h4">{project.title}</h3>
      <p className="folio-meta text-folio-text-secondary">{project.photosOnProfile ? 'Photos on your profile' : 'Private project'} · {project.status}</p>
      <Link className={styles.action} href={project.href}>{project.action}<span className="sr-only"> for {project.title}</span><span aria-hidden> ↗</span></Link>
    </div>
  </li>;
  return <section className={styles.section} aria-label="Unlock publishing for your projects">
    <div className={styles.heading}><h2 className="folio-h3">Your photographs are the beginning.</h2>
      <p className="folio-body text-folio-text-secondary">Photos make your Folio profile ready to share. Complete a project’s interview and publish its Folio Feature to unlock its publishing tools and make it eligible for the main feed.</p></div>
    <ul className={styles.projects}>{visible.slice(0, 3).map(card)}</ul>
    {visible.length > 3 && <details className={styles.more}><summary>Show {visible.length - 3} more projects</summary><ul className={styles.projects}>{visible.slice(3).map(card)}</ul></details>}
  </section>;
}

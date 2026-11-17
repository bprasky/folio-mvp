import Link from 'next/link';
import SafeImage from '@/components/SafeImage';
import type { PublicCoverage } from '@/lib/coverage/schema';
import styles from './Coverage.module.css';

export function CoverageCard({ item }: { item: PublicCoverage }) {
  return <article className={styles.card}>
    {item.imageUrl && <div className={styles.image}><SafeImage src={item.imageUrl} alt={item.project?.title || item.title} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" /></div>}
    <div className={styles.cardBody}>
      <p className={styles.eyebrow}>{item.category === 'feature' ? 'In the press' : item.category} · {item.source}</p>
      <h3 className={styles.headline}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a></h3>
      {item.publicationDate && <time className={styles.meta} dateTime={item.publicationDate}>{new Date(`${item.publicationDate}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</time>}
      <a className={styles.sourceLink} href={item.url} target="_blank" rel="noopener noreferrer">Read at {item.source}<span aria-hidden> ↗</span></a>
      {item.project && <Link className={styles.projectLink} href={item.project.href}>Explore {item.project.title} on Folio</Link>}
    </div>
  </article>;
}

import { getPublicCoverage } from '@/lib/coverage/service';
import { CoverageCard } from './CoverageCard';
import styles from './Coverage.module.css';

export async function ProjectCoverage({ projectId }: { projectId: string }) {
  const items = await getPublicCoverage({ projectId });
  if (!items.length) return null;
  return <section className={styles.projectSection} aria-label="Published coverage of this project">
    <h2 className={styles.title}>Elsewhere in print & online</h2>
    <div className={styles.grid}>{items.map(item => <CoverageCard key={item.id} item={item} />)}</div>
  </section>;
}

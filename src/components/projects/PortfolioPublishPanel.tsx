'use client';

import { useState } from 'react';
import { UnpublishProjectDialog } from './UnpublishProjectDialog';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { unpublishPortfolioAction } from '@/app/actions/portfolio';
import styles from './PortfolioPublishPanel.module.css';

export type PortfolioPublishPanelProps = {
  projectId: string; isPublic: boolean; canPublish: boolean; canUnpublish: boolean;
  featureStatus: string | null; profileHref: string;
};

/** A compact status in the workspace; photograph approval has its own step. */
export function PortfolioPublishPanel(props: PortfolioPublishPanelProps) {
  const router = useRouter();
  const [withdrawing, setWithdrawing] = useState(false);
  const canReview = !props.featureStatus || props.featureStatus === 'DRAFT';
  return <section className={styles.summary} aria-label="Profile photographs">
    <p className="folio-meta">{props.isPublic ? 'Photographs are on your profile.' : 'Add photographs to your profile before creating a feature.'}</p>
    <div className={styles.actions}>
      {props.isPublic && <Link className={styles.quiet} href={props.profileHref}>View my profile ↗</Link>}
      {props.canPublish && canReview && <Link className={styles.quiet} href={`/project/${props.projectId}?publish=photos`}>{props.isPublic ? 'Edit profile photographs' : 'Add photos to my profile'}</Link>}
      <Link className={styles.quiet} href={`/designer/studio?project=${encodeURIComponent(props.projectId)}`}>Publishing Studio</Link>
      {props.canUnpublish && props.isPublic && <button className={styles.quiet} type="button" onClick={() => setWithdrawing(true)}>Unpublish project</button>}
    </div>
    {withdrawing && <UnpublishProjectDialog onClose={() => setWithdrawing(false)} onConfirm={async () => {
      await unpublishPortfolioAction(props.projectId);
      router.refresh();
    }} />}
  </section>;
}

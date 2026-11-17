'use client';

import { useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Description } from '@headlessui/react';
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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canReview = !props.featureStatus || props.featureStatus === 'DRAFT';
  async function withdraw() {
    setBusy(true); setError('');
    try { await unpublishPortfolioAction(props.projectId); setWithdrawing(false); router.refresh(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not unpublish your project. Please try again.'); }
    finally { setBusy(false); }
  }
  return <section className={styles.summary} aria-label="Profile photographs">
    <p className="folio-meta">{props.isPublic ? 'Photographs are on your profile.' : 'Add photographs to your profile before creating a feature.'}</p>
    <div className={styles.actions}>
      {props.isPublic && <Link className={styles.quiet} href={props.profileHref}>View my profile ↗</Link>}
      {props.canPublish && canReview && <Link className={styles.quiet} href={`/project/${props.projectId}?publish=photos`}>{props.isPublic ? 'Edit profile photographs' : 'Add photos to my profile'}</Link>}
      <Link className={styles.quiet} href={`/designer/studio?project=${encodeURIComponent(props.projectId)}`}>Publishing Studio</Link>
      {props.canUnpublish && props.isPublic && <button className={styles.quiet} type="button" onClick={() => { setError(''); setWithdrawing(true); }}>Unpublish project</button>}
    </div>
    <Dialog open={withdrawing} onClose={() => { if (!busy) setWithdrawing(false); }} className={styles.dialog}>
      <DialogBackdrop className={styles.backdrop} />
      <div className={styles.viewport}><DialogPanel className={styles.review}>
        <div className={styles.heading}><DialogTitle className={styles.title}>Unpublish this project?</DialogTitle><button type="button" className={styles.close} aria-label="Close publishing review" disabled={busy} onClick={() => setWithdrawing(false)}><span aria-hidden>×</span></button></div>
        <Description className="folio-meta text-folio-text-secondary">This hides the public project and its feature. Your photographs and interview stay saved privately.</Description>
        {error && <p role="alert" className="folio-meta">{error}</p>}
        <div className={styles.actions}><button className={styles.primary} type="button" disabled={busy} onClick={() => void withdraw()}>{busy ? 'Unpublishing…' : 'Unpublish project'}</button><button className={styles.secondary} type="button" disabled={busy} onClick={() => setWithdrawing(false)}>Keep public</button></div>
      </DialogPanel></div>
    </Dialog>
  </section>;
}

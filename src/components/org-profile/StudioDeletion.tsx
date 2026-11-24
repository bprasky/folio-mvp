'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { StudioDeletionReview } from '@/lib/studio-deletion';
import controls from './ProfileControls.module.css';
import styles from './StudioDeletion.module.css';

export default function StudioDeletion({ orgId }: { orgId: string }) {
  const { update } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<StudioDeletionReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const submitting = useRef(false);
  const alive = useRef(true);
  const request = useRef<AbortController | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); }; }, []);

  function close() {
    if (submitting.current) return;
    request.current?.abort(); setOpen(false); setReview(null); setError(''); setConfirmation(''); setAcknowledged(false);
  }

  async function loadReview() {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setOpen(true); setLoading(true); setReview(null); setError(''); setConfirmation(''); setAcknowledged(false);
    try {
      const response = await fetch(`/api/orgs/${orgId}/deletion`, { cache: 'no-store', signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not review this studio.');
      if (!controller.signal.aborted) setReview(data);
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not review this studio.'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }

  async function remove() {
    if (submitting.current || !review || review.blockers.length || confirmation !== review.name || !acknowledged) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(`/api/orgs/${orgId}/deletion`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation, version: review.version, acknowledged }) });
      const data = await response.json();
      if (!response.ok || data.deleted !== true) throw new Error(data.error || 'Deletion was not confirmed. Retry to check its result safely.');
      // The account is retained; only its selected workspace may have changed.
      await update().catch(() => undefined);
      if (alive.current) { router.replace('/settings'); router.refresh(); }
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'Deletion was not confirmed. Retry to check its result safely.'); }
    finally { submitting.current = false; if (alive.current) setBusy(false); }
  }

  return <section className={styles.section} aria-labelledby="studio-deletion-title">
    <h2 id="studio-deletion-title" className={styles.title}>Delete studio</h2>
    <p className={styles.copy}>Permanently remove this studio and its projects from Folio. Your personal account and other studios stay active.</p>
    <button type="button" onClick={() => void loadReview()} className={`${styles.button} ${controls.secondary} mt-4`}>Review studio deletion</button>
    <Dialog open={open} onOpenChange={value => { if (!value) close(); }}>
      <DialogContent className={`${controls.dialog} ${styles.dialog}`} onEscapeKeyDown={event => { if (submitting.current) event.preventDefault(); }}>
        <div className={styles.header}>
          <DialogTitle className={styles.heading}>Delete this studio?</DialogTitle>
          <button type="button" onClick={close} disabled={busy} className={`${styles.button} ${controls.quiet}`}>Cancel</button>
        </div>
        <DialogDescription className={styles.copy}>Review what will be removed before confirming. This cannot be undone.</DialogDescription>
        <div className={`${styles.body} mt-5`}>
          {loading && <p role="status">Reviewing studio records…</p>}
          {review && <>
            <p className={styles.copy}>You are deleting <strong>{review.name}</strong>.</p>
            <dl className={styles.counts}>
              <div><dt>Studio projects</dt><dd>{review.counts.projects}</dd></div>
              <div><dt>Published projects</dt><dd>{review.counts.publishedProjects}</dd></div>
              <div><dt>Memberships removed</dt><dd>{review.counts.members}</dd></div>
              <div><dt>Profile features</dt><dd>{review.counts.profileItems}</dd></div>
            </dl>
            {review.counts.activeImports > 0 && <p className={styles.notice} role="status">{review.counts.activeImports === 1 ? 'An import is still running.' : `${review.counts.activeImports} imports are still running.`} You can stop {review.counts.activeImports === 1 ? 'it' : 'them'} and delete this studio now.</p>}
            <p className={styles.copy}>This removes the studio profile, project pages, project interview records, publications, team memberships, invitations, and profile features. Members keep their personal accounts. Projects belonging to other studios remain.</p>
            <p className={styles.copy}>Any running website or project imports will stop when you confirm. All of this studio’s projects are deleted, including drafts added after this review.</p>
            <p className={styles.copy}>Previously shared image links, exports, and backups are not erased by this action.</p>
            {review.blockers.length > 0 ? <div className={styles.notice} role="alert"><strong>A few things need attention first</strong><ul>{review.blockers.map(message => <li key={message}>{message}</li>)}</ul></div> : <>
              <label className={styles.label} htmlFor="studio-delete-name"><span>Type <strong>{review.name}</strong> to confirm</span>
                <input id="studio-delete-name" className={styles.input} autoComplete="off" spellCheck={false} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} />
              </label>
              <label className={styles.acknowledgment}><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} disabled={busy} />
                <span>I understand this permanently deletes the studio and its projects for every member.</span>
              </label>
            </>}
          </>}
          {error && <p role="alert" className={styles.notice}>{error}</p>}
          {busy && <p role="status">Deleting studio…</p>}
          <div className={styles.actions}>
            {!loading && (!review || error || review.blockers.length > 0) && <button type="button" onClick={() => void loadReview()} disabled={busy} className={`${styles.button} ${controls.secondary}`}>Review again</button>}
            {review && !review.blockers.length && <button type="button" onClick={() => void remove()} disabled={busy || confirmation !== review.name || !acknowledged} className={`${styles.button} ${controls.primary}`}>{busy ? 'Deleting…' : error ? 'Retry deletion' : review.counts.activeImports > 0 ? 'Stop imports and delete studio' : 'Permanently delete studio'}</button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </section>;
}

'use client';

import { useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Description } from '@headlessui/react';
import styles from './PortfolioPublishPanel.module.css';

type Props = {
  projectTitle?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
};

export function UnpublishProjectDialog({ projectTitle, onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch {
      setError('Could not unpublish this project. Check your connection and publishing access, then try again.');
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={() => { if (!busy) onClose(); }} className={styles.dialog}>
      <DialogBackdrop className={styles.backdrop} />
      <div className={styles.viewport}>
        <DialogPanel className={styles.review}>
          <div className={styles.heading}>
            <DialogTitle className={styles.title}>{projectTitle ? `Unpublish “${projectTitle}”?` : 'Unpublish this project?'}</DialogTitle>
            <button type="button" className={styles.close} aria-label="Close publishing review" disabled={busy} onClick={onClose}><span aria-hidden>×</span></button>
          </div>
          <Description className="folio-meta text-folio-text-secondary">This hides the public project and any published feature. Your photographs and interview stay saved privately.</Description>
          {error && <p role="alert" className="folio-meta">{error}</p>}
          <div className={styles.actions}>
            <button className={styles.primary} type="button" disabled={busy} onClick={() => void confirm()}>{busy ? 'Unpublishing…' : 'Unpublish project'}</button>
            <button className={styles.secondary} type="button" disabled={busy} onClick={onClose}>Keep public</button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

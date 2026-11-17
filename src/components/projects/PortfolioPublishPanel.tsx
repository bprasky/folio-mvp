'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Description } from '@headlessui/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { publishPortfolioAction, unpublishPortfolioAction } from '@/app/actions/portfolio';
import styles from './PortfolioPublishPanel.module.css';

export type PortfolioPublishPanelProps = {
  interviewStarted?: boolean; description?: string | null; initialReview?: boolean; projectId: string; title: string; version: string; coverImageId: string | null;
  photos: Array<{ id: string; url: string; name: string | null; inclusion: string }>;
  isPublic: boolean; canPublish: boolean; canUnpublish: boolean; featureSlug?: string | null; featureStatus: string | null; editorialState: string;
};

export function PortfolioPublishPanel(props: PortfolioPublishPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(props.initialReview));
  const [withdrawing, setWithdrawing] = useState(false);
  const [title, setTitle] = useState(props.title);
  const [included, setIncluded] = useState<string[]>(() => props.photos.filter(photo => photo.inclusion !== 'EXCLUDED').map(photo => photo.id));
  const [cover, setCover] = useState(() => included.includes(props.coverImageId || '') ? props.coverImageId! : included[0] || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const canReview = !props.featureStatus || props.featureStatus === 'DRAFT';
  const featureReady = ['GENERATED', 'UNPUBLISHED'].includes(props.editorialState);
  const featurePublished = props.featureStatus === 'PUBLISHED';
  const inReview = props.featureStatus === 'REVIEW';
  const interviewLabel = featurePublished ? 'View your feature' : inReview ? 'Feature in review' : featureReady ? 'Review your feature'
    : props.interviewStarted || props.editorialState === 'INTERVIEWED' ? 'Continue interview' : 'Start interview';
  const interviewHref = featurePublished && props.featureSlug ? `/p/${encodeURIComponent(props.featureSlug)}/feature` : `/project/${props.projectId}?view=${featurePublished || featureReady || inReview ? 'publish' : 'story'}`;

  function review() {
    const selected = props.photos.filter(photo => photo.inclusion !== 'EXCLUDED').map(photo => photo.id);
    setTitle(props.title); setIncluded(selected);
    setCover(selected.includes(props.coverImageId || '') ? props.coverImageId! : selected[0] || '');
    setError(''); setOpen(true);
  }
  function toggle(id: string) {
    const next = included.includes(id) ? included.filter(value => value !== id) : [...included, id];
    setIncluded(next);
    if (!next.includes(cover)) setCover(next[0] || '');
  }
  async function save(withdraw = false) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      if (withdraw) await unpublishPortfolioAction(props.projectId);
      else await publishPortfolioAction({ projectId: props.projectId, title, coverImageId: cover, includedImageIds: included, version: props.version });
      setOpen(false); setWithdrawing(false);
      window.dispatchEvent(new Event('folio:notifications-changed'));
      router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save your project. Please try again.'); }
    finally { saving.current = false; setBusy(false); }
  }
  return <section className={styles.panel} aria-label="Project publication">
    <div><h2 className="folio-h3">{props.isPublic ? 'Your project is live' : 'Publish your photos. Tell the story next.'}</h2>
      <p className="folio-meta text-folio-text-secondary">{props.isPublic
        ? featurePublished ? 'Your photographs and Folio Feature are ready to share.'
          : 'Your photographs stay live while you create your Folio Feature. Tell the story behind them to prepare editorial content to share and help Folio identify relevant media opportunities.'
        : 'Review your title, cover and photographs, then publish. Organize rooms and add products when you prepare your interview.'}</p></div>
    <div className={styles.actions}>
      {props.isPublic && <Link className={styles.secondary} href={`/project/${props.projectId}?view=public`}>View public project ↗</Link>}
      {props.isPublic && props.featureStatus !== 'ARCHIVED' && <Link className={styles.primary} href={interviewHref}>{interviewLabel}</Link>}
      {props.canPublish && canReview && props.photos.length > 0 && <button className={props.isPublic ? styles.secondary : styles.primary} type="button" onClick={review}>
        {props.isPublic ? 'Review project photos' : 'Review & publish project'}</button>}
      {props.canUnpublish && props.isPublic && <button className={styles.secondary} type="button" onClick={() => { setError(''); setWithdrawing(true); }}>Unpublish project</button>}
    </div>
    <Dialog open={open || withdrawing} onClose={() => { if (!busy) { setOpen(false); setWithdrawing(false); } }} className={styles.dialog}>
      <DialogBackdrop className={styles.backdrop} />
      <div className={styles.viewport}><DialogPanel className={styles.review}>
        <div className={styles.heading}><DialogTitle className={styles.title}>{withdrawing ? 'Unpublish this project?' : 'Review your project'}</DialogTitle><button type="button" className={styles.close} aria-label="Close publishing review" disabled={busy} onClick={() => { setOpen(false); setWithdrawing(false); }}><span aria-hidden>×</span></button></div>
        <Description className="folio-meta text-folio-text-secondary">{withdrawing
          ? 'This hides the public project and its feature. Your photographs and interview stay saved privately.'
          : 'Only the included photographs and project details will be public. Your interview and feature draft stay private.'}</Description>
        {error && <p ref={errorRef} tabIndex={-1} role="alert" className="folio-meta">{error}</p>}
        {!withdrawing && <form onSubmit={event => { event.preventDefault(); void save(); }}>
          <label className={styles.titleField}>Project title<input className={styles.input} value={title} onChange={event => setTitle(event.target.value)} maxLength={200} required disabled={busy} /></label>
          {props.description && <p className="folio-meta text-folio-text-secondary">{props.description}</p>}
          <fieldset disabled={busy} className={styles.photos}><legend>{included.length} {included.length === 1 ? 'photograph' : 'photographs'} included · Choose a cover</legend>
            {props.photos.map((photo, index) => <div key={photo.id} className={styles.photo}>
              {/* Session-protected imported photos must load directly. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.name || `Project photograph ${index + 1}`} loading="lazy" />
              <label><input type="checkbox" checked={included.includes(photo.id)} onChange={() => toggle(photo.id)} />Include photograph {index + 1}</label>
              <label><input type="radio" name="cover" checked={cover === photo.id} disabled={!included.includes(photo.id) || busy} onChange={() => setCover(photo.id)} />Use as cover<span className="sr-only">, photograph {index + 1}</span></label>
            </div>)}
          </fieldset>
          <div className={styles.footer}><button className={styles.primary} type="submit" disabled={busy || !title.trim() || !included.length || !cover}>{busy ? 'Publishing…' : props.isPublic ? 'Save public project' : 'Publish project'}</button>
            <button className={styles.secondary} type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button></div>
        </form>}
        {withdrawing && <div className={styles.actions}><button className={styles.primary} type="button" disabled={busy} onClick={() => void save(true)}>{busy ? 'Unpublishing…' : 'Unpublish project'}</button>
          <button className={styles.secondary} type="button" disabled={busy} onClick={() => setWithdrawing(false)}>Keep public</button></div>}
      </DialogPanel></div>
    </Dialog>
  </section>;
}

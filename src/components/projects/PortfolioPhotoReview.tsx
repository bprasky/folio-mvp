'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { publishPortfolioAction } from '@/app/actions/portfolio';
import styles from './PortfolioPublishPanel.module.css';

export type PortfolioPhotoReviewProps = {
  projectId: string; title: string; version: string; coverImageId: string | null; isPublic: boolean;
  profileHref: string; featureHref: string; featureAction: string;
  photos: Array<{ id: string; url: string; name: string | null; inclusion: string; roomName: string | null }>;
  rooms: Array<{ name: string }>;
  nextProject: { id: string; title: string } | null;
};

/** Focused approval step: the full project workspace begins after this page. */
export function PortfolioPhotoReview(props: PortfolioPhotoReviewProps) {
  // A background refresh must not silently approve a newer photo set than the one reviewed.
  const [reviewVersion] = useState(props.version);
  const [title, setTitle] = useState(props.title);
  const [included, setIncluded] = useState(() => props.photos.filter(photo => photo.inclusion !== 'EXCLUDED').map(photo => photo.id));
  const [cover, setCover] = useState(() => included.includes(props.coverImageId || '') ? props.coverImageId! : included[0] || '');
  const [roomNames, setRoomNames] = useState(() => Object.fromEntries(props.photos.map(photo => [photo.id, photo.roomName || ''])));
  const [organizing, setOrganizing] = useState(false);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false), errorRef = useRef<HTMLParagraphElement>(null), successRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => { if (approved) successRef.current?.focus(); }, [approved]);

  function toggle(id: string) {
    const next = included.includes(id) ? included.filter(value => value !== id) : [...included, id];
    setIncluded(next); if (!next.includes(cover)) setCover(next[0] || '');
  }
  async function approve() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const roomAssignments = props.photos.filter(photo => included.includes(photo.id) && (roomNames[photo.id] || '').trim() !== (photo.roomName || ''))
        .map(photo => ({ imageId: photo.id, roomName: (roomNames[photo.id] || '').trim() || null }));
      await publishPortfolioAction({ projectId: props.projectId, title, coverImageId: cover, includedImageIds: included, version: reviewVersion,
        ...(roomAssignments.length ? { roomAssignments } : {}) });
      setApproved(true);
      toast.success('Your project photos are now visible on your Folio profile.', { style: { background: 'var(--surface-canvas)', color: 'var(--folio-text-primary)' } });
      window.dispatchEvent(new Event('folio:notifications-changed'));
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save your photographs. Please try again.'); }
    finally { saving.current = false; setBusy(false); }
  }

  if (approved) return <main className={`${styles.page} ${styles.success}`}>
    <p className={styles.eyebrow}>On your Folio profile</p>
    <h1 ref={successRef} tabIndex={-1} className="folio-h1">Your photographs are live.</h1>
    <p className="folio-body text-folio-text-secondary">{title} is now part of your public profile.</p>
    <Link className={styles.quiet} href={props.profileHref}>View my profile ↗</Link>
    <nav className={styles.choices} aria-label="What would you like to do next?">
      <Link className={styles.choice} href={props.featureHref}><span className="folio-h3">{props.featureAction} <span aria-hidden>↗</span></span><span>Publish your feature for the main feed and Publishing Studio tools.</span></Link>
      {props.nextProject && <Link className={styles.choice} href={`/project/${encodeURIComponent(props.nextProject.id)}?publish=photos`}><span className="folio-h3">Next project <span aria-hidden>→</span></span><span>Add photographs from {props.nextProject.title} to your profile.</span></Link>}
      <Link className={styles.choice} href={props.profileHref}><span className="folio-h3">Finish &amp; exit <span aria-hidden>↗</span></span><span>Go to your Folio profile. You can come back to the interview anytime.</span></Link>
    </nav>
  </main>;

  return <main className={styles.page}>
    <Link className={styles.quiet} href={props.profileHref}>← Back to my profile</Link>
    <header className={styles.pageHeading}>
      <p className={styles.eyebrow}>Your Folio profile</p>
      <h1 className="folio-h1">{props.isPublic ? 'Update your photographs.' : 'Make your work visible.'}</h1>
      <p className="folio-body text-folio-text-secondary">Choose the photographs to show on your profile and pick a cover. Your interview can come later.</p>
    </header>
    <form onSubmit={event => { event.preventDefault(); void approve(); }}>
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>{error} <a className={styles.quiet} href={`/project/${encodeURIComponent(props.projectId)}?publish=photos`}>Reload review</a></p>}
      <label className={styles.titleField}>Project title<input className={styles.input} value={title} onChange={event => setTitle(event.target.value)} maxLength={200} required disabled={busy} /></label>
      <details className={styles.organize} onToggle={event => setOrganizing(event.currentTarget.open)}>
        <summary>Organize rooms <span className="text-folio-text-secondary">(optional)</span></summary>
        <p>Name a room below each photograph to group it. Use the same name for photographs of the same space, or leave them unsorted.</p>
      </details>
      <datalist id={`rooms-${props.projectId}`}>{Array.from(new Set([...props.rooms.map(room => room.name), ...Object.values(roomNames)].filter(Boolean))).map(name => <option key={name} value={name} />)}</datalist>
      <fieldset disabled={busy} className={styles.photos}><legend>{included.length} {included.length === 1 ? 'photograph' : 'photographs'} selected</legend>
        {props.photos.map((photo, index) => <div key={photo.id} className={styles.photo}>
          <label className={styles.photoSelection}>
            {/* Imported photographs load directly with the viewer's existing session. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={photo.name || `Project photograph ${index + 1}`} loading="lazy" />
            <input type="checkbox" checked={included.includes(photo.id)} onChange={() => toggle(photo.id)} /><span className="sr-only">Include photograph {index + 1}</span>
          </label>
          <label className={styles.coverChoice}><input type="radio" name="cover" checked={cover === photo.id} disabled={!included.includes(photo.id) || busy} onChange={() => setCover(photo.id)} />{cover === photo.id ? 'Cover photograph' : 'Use as cover'}<span className="sr-only">, photograph {index + 1}</span></label>
          {organizing && <label className={styles.roomField}>Room<span className="sr-only"> for photograph {index + 1}</span><input className={styles.input} list={`rooms-${props.projectId}`} value={roomNames[photo.id] || ''} placeholder="Unsorted" maxLength={120} disabled={!included.includes(photo.id)} onChange={event => setRoomNames(current => ({ ...current, [photo.id]: event.target.value }))} /></label>}
        </div>)}
      </fieldset>
      <footer className={styles.approval}>
        <p>Approving makes these photographs and project details public on your Folio profile.</p>
        <button className={styles.primary} type="submit" disabled={busy || !title.trim() || !included.length || !cover}>{busy ? 'Saving…' : props.isPublic ? 'Approve changes' : 'Approve & add to profile'}</button>
      </footer>
    </form>
  </main>;
}

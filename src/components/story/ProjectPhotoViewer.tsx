'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useRef, type RefObject } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import type { ChannelTile } from '@/lib/project-channel/curation';
import styles from './ProjectChannel.module.css';

/** Kept separate from the editorial reader; receives public photographs only. */
export function ProjectPhotoViewer({ photos, photoId, projectTitle, onChange, returnTo }: {
  photos: ChannelTile[]; photoId: string | null; projectTitle: string;
  onChange: (id: string | null) => void; returnTo: RefObject<HTMLButtonElement>;
}) {
  const close = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const index = photos.findIndex(photo => photo.id === photoId);
  const photo = photos[index];
  function move(direction: number) { onChange(photos[(index + direction + photos.length) % photos.length].id); }
  return <Dialog.Root open={!!photo} onOpenChange={open => { if (!open) onChange(null); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[99]" />
      <Dialog.Content className={styles.viewer} aria-describedby={undefined}
        onOpenAutoFocus={event => { event.preventDefault(); close.current?.focus(); }}
        onCloseAutoFocus={event => { event.preventDefault(); returnTo.current?.focus({ preventScroll: true }); }}
        onKeyDown={event => {
          if (photos.length < 2) return;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); }
        }}>
        <header className={styles.viewerHeader}>
          <Dialog.Title>{projectTitle}</Dialog.Title>
          <Dialog.Close ref={close} aria-label="Return to project photographs"><X size={20} aria-hidden="true" /></Dialog.Close>
        </header>
        <div className={styles.viewerPhoto}
          onTouchStart={event => { touchStart.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }}
          onTouchMove={event => { if (event.touches.length !== 1) touchStart.current = null; }}
          onTouchCancel={() => { touchStart.current = null; }}
          onTouchEnd={event => {
            const start = touchStart.current; touchStart.current = null;
            if (!start || photos.length < 2 || !event.changedTouches[0]) return;
            const dx = event.changedTouches[0].clientX - start.x, dy = event.changedTouches[0].clientY - start.y;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
          }}>
          {photo?.imageUrl && <SafeImage key={photo.id} src={photo.imageUrl} alt={photo.title} fill sizes="100vw" className="object-contain" />}
        </div>
        <footer className={styles.viewerFooter}>
          {photos.length > 1 && <button type="button" aria-label="Previous photograph" onClick={() => move(-1)}><ChevronLeft aria-hidden="true" /></button>}
          <div className={styles.viewerCaption} role="status" aria-live="polite" aria-atomic="true"><span>{photo?.title}</span><p>{index + 1} / {photos.length}</p></div>
          {photos.length > 1 && <button type="button" aria-label="Next photograph" onClick={() => move(1)}><ChevronRight aria-hidden="true" /></button>}
        </footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

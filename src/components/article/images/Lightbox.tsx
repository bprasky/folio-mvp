"use client";

import { useRef, useState } from "react";
import * as Dialog from '@radix-ui/react-dialog';

export default function Lightbox({ images, openIndex, onClose, dim = true }: {
  images: { url: string; alt?: string | null; caption?: string | null; tags?: any[] }[];
  openIndex: number;
  onClose: () => void;
  dim?: boolean;
}) {
  const [idx, setIdx] = useState(openIndex);
  const previousFocus = useRef<HTMLElement | null>(null);
  const im = images[idx];
  if (!im) return null;

  const control = 'min-h-11 min-w-11 rounded-full bg-surface-canvas px-3 py-2 folio-meta text-folio-text-primary hover:bg-surface-ground transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className={`fixed inset-0 z-[80] grid place-items-center p-4 ${dim ? 'glass-backdrop' : ''}`}>
        <Dialog.Content className="relative max-w-5xl w-full max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain focus:outline-none"
          aria-describedby={undefined}
          onOpenAutoFocus={() => { previousFocus.current = document.activeElement as HTMLElement; }}
          onCloseAutoFocus={event => { event.preventDefault(); previousFocus.current?.focus(); }}
          onKeyDown={event => {
            if (event.key === 'ArrowRight') { event.preventDefault(); setIdx(i => Math.min(i + 1, images.length - 1)); }
            if (event.key === 'ArrowLeft') { event.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
          }}>
          <Dialog.Title className="sr-only">Project photographs</Dialog.Title>
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.url} alt={im.alt || ''} className={`w-full max-h-[75dvh] object-contain rounded-xl ${dim ? '' : 'shadow-2xl ring-1 ring-black/10'}`} />
            <button onClick={onClose} className={`absolute top-2 right-2 ${control}`}>Close</button>
            {images.length > 1 && <div className="absolute top-1/2 -translate-y-1/2 left-2 right-2 flex justify-between pointer-events-none">
              <button onClick={() => setIdx(i => Math.max(i - 1, 0))} disabled={idx === 0} aria-label="Previous photograph" className={`${control} pointer-events-auto`}>←</button>
              <button onClick={() => setIdx(i => Math.min(i + 1, images.length - 1))} disabled={idx === images.length - 1} aria-label="Next photograph" className={`${control} pointer-events-auto`}>→</button>
            </div>}
          </div>
          {im.caption || (im.tags?.length ?? 0) > 0 ? <div className="mt-2 rounded-xl bg-surface-canvas p-3 folio-meta text-folio-text-primary">
            {im.caption ? <p className="mb-1 break-words">{im.caption}</p> : null}
            {im.tags && im.tags.length > 0 && <div className="flex flex-wrap gap-2">{im.tags.slice(0, 6).map((t, i) => <span key={i} className="rounded-full bg-surface-ground px-2 py-0.5 folio-meta ring-1 ring-black/5">{t?.label || t?.name || t?.productName || 'Tagged'}</span>)}</div>}
          </div> : null}
          {images.length > 1 && <div className="mt-2 rounded-full bg-surface-canvas px-3 py-2 text-center folio-meta text-folio-text-secondary" role="status">{idx + 1} / {images.length}</div>}
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Portal>
  </Dialog.Root>;
}

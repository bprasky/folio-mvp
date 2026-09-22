'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, X } from 'lucide-react';
import { studioAction } from './StudioWorkspace';

/** A native modal keeps keyboard focus and background interaction inside the pitch. */
export function StudioPitchDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const node = dialog.current;
    node?.showModal();
    closeButton.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      node?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-folio-border-subtle bg-surface-canvas p-0 text-folio-text-primary shadow-xl backdrop:bg-black/40">
    <div className="p-5 sm:p-8">
      <header className="mb-6 flex items-start justify-between gap-5">
        <h2 id={titleId} className="folio-h2">{title}</h2>
        <button ref={closeButton} type="button" aria-label="Close details" onClick={onClose} className="shrink-0 rounded-full border border-folio-border-subtle p-2 focus-visible:outline focus-visible:outline-2"><X className="h-5 w-5" /></button>
      </header>
      {children}
    </div>
  </dialog>;
}

/** Browsing opens a pitch; only its explicit CTA enters the existing work flow. */
export function StudioPitchCard({ eyebrow, title, image, children, actionLabel, href, onAction, disabled = false, showImageInPitch = true }: {
  eyebrow: string; title: string; image?: ReactNode; children: ReactNode;
  actionLabel: string; href?: string; onAction?(): void; disabled?: boolean;
  showImageInPitch?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <article className="min-w-0">
    <button type="button" aria-label={`View idea: ${title}`} aria-haspopup="dialog" onClick={() => setOpen(true)}
      className="group flex h-full w-full flex-col text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
      {image && <div className="w-full [&>img]:rounded-xl [&>div]:rounded-xl">{image}</div>}
      <div className="w-full py-4">
        <p className="folio-meta text-folio-text-secondary">{eyebrow}</p>
        <div className="mt-2 flex items-start justify-between gap-4"><h3 className="folio-h3 line-clamp-3">{title}</h3><ArrowUpRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-folio-text-secondary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div>
      </div>
    </button>
    {open && <StudioPitchDialog title={title} onClose={() => setOpen(false)}>
      <p className="folio-meta mb-4 text-folio-text-secondary">{eyebrow}</p>
      <div className={image && showImageInPitch ? 'grid items-start gap-6 sm:grid-cols-2' : ''}>
        {image && showImageInPitch && <div className="mx-auto w-full max-w-xs [&>img]:rounded-xl [&>div]:rounded-xl">{image}</div>}
        <div className="space-y-4 folio-body">{children}</div>
      </div>
      <div className="mt-8 border-t border-folio-border-subtle pt-5">
        {href ? <Link href={href} className={studioAction}>{actionLabel}</Link> : <button type="button" disabled={disabled} className={studioAction} onClick={() => { setOpen(false); onAction?.(); }}>{actionLabel}</button>}
      </div>
    </StudioPitchDialog>}
  </article>;
}

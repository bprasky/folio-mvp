'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { studioAction } from './StudioWorkspace';

/** Presentation contract; callers derive readiness and contribution from their current records. */
export interface PublicationCardContent {
  title: string;
  benefit: string;
  contribution: string;
  actionLabel: string;
  supportingSources?: string[];
  readiness?: 'prepared' | 'working' | 'saved' | 'published' | 'needs_source';
  metadata?: string;
}

export function StudioPublicationCard({ preview, title, benefit, contribution, actionLabel, href, onAction, disabled, metadata, supportingSources, readiness }: PublicationCardContent & {
  preview: ReactNode; href?: string; onAction?(): void; disabled?: boolean;
}) {
  const previewClass = 'block w-full overflow-hidden rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4';
  return <article className="flex min-w-0 flex-col" data-readiness={readiness} data-sources={supportingSources?.join(',')}>
    {href ? <Link href={href} aria-label={`${actionLabel}: ${title}`} className={previewClass}>{preview}</Link> :
      <button type="button" onClick={onAction} disabled={disabled} aria-label={`${actionLabel}: ${title}`} className={`${previewClass} disabled:opacity-60`}>{preview}</button>}
    <div className="flex flex-1 flex-col items-start pt-4">
      {metadata && <p className="folio-meta text-folio-text-secondary">{metadata}</p>}
      <p className="folio-ui mt-2">{benefit}</p>
      <p className="folio-meta mt-2 text-folio-text-secondary">{contribution}</p>
      <div className="mt-auto pt-4">{href ? <Link href={href} className={studioAction}>{actionLabel}</Link> :
        <button type="button" disabled={disabled} onClick={onAction} className={studioAction}>{actionLabel}</button>}</div>
    </div>
  </article>;
}

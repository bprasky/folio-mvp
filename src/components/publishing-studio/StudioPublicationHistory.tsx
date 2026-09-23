'use client';

import { useState } from 'react';
import { StudioPitchDialog } from './StudioPitchCard';
import type { StudioFeedCard } from '@/lib/publishing-studio/types';
import type { ProjectPublicationHistory } from '@/lib/publishing-studio/history';

export function StudioPublicationHistory({ item, history, onClose, onChanged }: {
  item: StudioFeedCard | null; history: ProjectPublicationHistory[]; onClose(): void; onChanged(): void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  async function record(projectId: string, sourceId: string, kind: 'published' | 'dismissed' | 'restored', destination?: 'instagram' | 'other') {
    if (pending) return;
    setPending(true); setError('');
    try {
      const response = await fetch('/api/publishing-studio/history', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, sourceId, revision: item?.revision || item?.updatedAt, expectedVersion: history.find(row => row.projectId === projectId)?.version || 0, kind, destination }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save this correction.');
      onClose(); onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this correction.'); }
    finally { setPending(false); }
  }
  return <>
    {history.some(row => row.entries.length) && <button className="folio-meta underline underline-offset-4" onClick={() => { setShowHistory(true); setError(''); }}>Sharing history</button>}
    {(item || showHistory) && <StudioPitchDialog title={item ? 'Already shared this story?' : 'Sharing history'} onClose={() => { if (!pending) { onClose(); setShowHistory(false); setError(''); } }}>
      {error && <p role="alert" className="folio-body mb-4">{error}</p>}
      {item ? <><p className="folio-h3">{item.title}</p><p className="folio-body my-4">Confirm where you shared this story. Folio will stop suggesting the same angle. Your saved work stays available.</p>
        <div className="flex flex-wrap gap-4">
          <button disabled={pending} className="folio-ui rounded-full border px-4 py-2" onClick={() => record(item.projectIds[0], item.id, 'published', 'instagram')}>Shared on Instagram</button>
          <button disabled={pending} className="folio-ui rounded-full border px-4 py-2" onClick={() => record(item.projectIds[0], item.id, 'published', 'other')}>Shared elsewhere</button>
          <button disabled={pending} className="folio-ui underline underline-offset-4" onClick={() => record(item.projectIds[0], item.id, 'dismissed')}>Don’t suggest this story</button>
        </div><p className="folio-meta mt-5">A Folio publication, upload or download does not confirm social sharing. You can undo a correction in Sharing history.</p></> :
        <ul className="space-y-6">{history.flatMap(row => row.entries.map(entry => <li key={`${row.projectId}:${entry.sourceId}`}>
          <p className="folio-h3">{entry.headline}</p><p className="folio-meta my-2">{entry.kind === 'dismissed' ? 'Dismissed' : entry.destination === 'instagram' ? 'Shared on Instagram · Confirmed by you' : 'Shared elsewhere · Confirmed by you'}</p>
          <button disabled={pending} className="folio-ui underline underline-offset-4" onClick={() => record(row.projectId, entry.sourceId, 'restored')}>Undo correction</button>
        </li>))}</ul>}
      {pending && <p role="status" className="folio-meta mt-4">Saving correction…</p>}
    </StudioPitchDialog>}
  </>;
}

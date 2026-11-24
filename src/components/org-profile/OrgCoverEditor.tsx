'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SafeImage from '@/components/SafeImage';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { resolveProfileCover, type OrgAppearanceData, type OrgProfileAppearance, type ProfileCover } from '@/lib/org-profile-appearance';
import OrgProfileHero from './OrgProfileHero';
import PortraitControls from './PortraitControls';
import styles from './OrgProfileAppearance.module.css';

export default function OrgCoverEditor({ orgId, importId, previewCover, portraitAction, onSaved }: {
  orgId: string; importId?: string; previewCover?: ProfileCover; onSaved?: (appearance: OrgProfileAppearance, cover: ProfileCover) => void;
  portraitAction?: string;
}) {
  const [panel, setPanel] = useState<'cover' | 'portrait' | null>(null);
  const open = panel !== null;
  const [data, setData] = useState<OrgAppearanceData | null>(null);
  const [draft, setDraft] = useState<OrgProfileAppearance | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const request = new AbortController(); setData(null); setDraft(null); setError('');
    fetch(`/api/orgs/${orgId}/appearance`, { cache: 'no-store', signal: request.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); if (!request.signal.aborted) { setData(body); setDraft(body.appearance); } })
      .catch(reason => { if (!request.signal.aborted) setError(reason.message || 'Could not load your cover.'); });
    return () => request.abort();
  }, [open, orgId, retry]);
  async function save() {
    if (!draft) return;
    setSaving(true); setError('');
    try {
      const response = await fetch(`/api/orgs/${orgId}/appearance`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Could not save your cover.');
      onSaved?.(body.appearance, cover); setPanel(null); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save your cover.'); }
    finally { setSaving(false); }
  }
  const cover = data && draft ? draft.cover.kind === 'auto' && previewCover ? previewCover : resolveProfileCover(draft, data.projects) : null;
  return <>
    {portraitAction && <button type="button" className={styles.manageTrigger} onClick={() => setPanel('portrait')}>{portraitAction}</button>}
    <button type="button" className={styles.manageTrigger} onClick={() => setPanel('cover')}>Edit cover</button>
    <Dialog open={open} onOpenChange={value => { if (!value && !busy && !saving) setPanel(null); }} placement="right">
      <DialogContent placement="right" className={styles.coverSheet}>
        <div className={styles.sheetHeader}><div><DialogTitle>{panel === 'portrait' ? 'Studio portrait' : 'Edit your cover'}</DialogTitle><DialogDescription>{panel === 'portrait' ? 'Upload a founder or team photograph, or choose a suggestion from your website.' : 'Choose the project and the people that introduce your studio.'}</DialogDescription></div>
          <button type="button" className={styles.textButton} disabled={busy || saving} onClick={() => setPanel(null)} aria-label="Close cover editor">Close</button></div>
        {!data || !draft ? <div className="p-6"><p role={error ? 'alert' : 'status'}>{error || 'Loading your cover…'}</p>{error && <button type="button" className={styles.textButton} onClick={() => setRetry(value => value + 1)}>Try again</button>}</div> : <>
          <div className={styles.coverEditorBody} data-panel={panel}>
            <div className={styles.coverEditorPreview}><OrgProfileHero org={data.org} appearance={draft} cover={cover} projectCount={data.projectCount} year={new Date().getFullYear()} preview /></div>
            <div className={`${styles.editor} ${styles.coverEditorControls}`}>
              <fieldset disabled={saving || busy}>
                <PortraitControls orgId={orgId} importId={importId} portrait={draft.portrait} onChange={portrait => setDraft(current => current ? { ...current, portrait } : current)} onBusy={setBusy} />
                {panel === 'cover' && <div className="mt-8"><h3>Project background</h3>
                  <select aria-label="Cover background" value={draft.cover.kind} onChange={event => {
                    const kind = event.target.value;
                    if (kind === 'auto' || kind === 'none') setDraft({ ...draft, cover: { kind } });
                    else if (kind === 'project') { const image = data.projects.flatMap(project => project.images)[0]; if (image) setDraft({ ...draft, cover: { kind, imageId: image.id } }); }
                  }}>
                    <option value="auto">Automatic project photograph</option><option value="project" disabled={!data.projects.some(project => project.images.length)}>Choose a published project</option>
                    {draft.cover.kind === 'upload' && <option value="upload">Your uploaded cover</option>}<option value="none">No background photograph</option>
                  </select>
                  {draft.cover.kind === 'project' && <div className={styles.choices}>{data.projects.flatMap(project => project.images.map((photo, index) => <button type="button" key={photo.id} className={styles.imageChoice}
                    aria-label={`${project.title}, photograph ${index + 1}`} aria-pressed={draft.cover.kind === 'project' && draft.cover.imageId === photo.id}
                    onClick={() => setDraft({ ...draft, cover: { kind: 'project', imageId: photo.id } })}><SafeImage src={photo.url} fill alt="" sizes="140px" /><span>{project.title}</span></button>))}</div>}
                  {importId && !data.projects.length && <p>Your imported project becomes the background after you approve its photographs.</p>}
                  {cover && <div className="mt-4 space-y-3">{(['x', 'y'] as const).map(axis => <label key={axis}>{axis === 'x' ? 'Horizontal' : 'Vertical'} background framing<input type="range" min="0" max="100" value={draft.coverPosition[axis]} onChange={event => setDraft({ ...draft, coverPosition: { ...draft.coverPosition, [axis]: Number(event.target.value) } })} /></label>)}</div>}
                </div>}
              </fieldset>
            </div>
          </div>
          <div className={styles.sheetFooter}><p role={error ? 'alert' : undefined}>{error || (importId ? 'Saving updates your public cover. Approve project photographs separately to publish them.' : '')}</p><button type="button" className={styles.textButton} disabled={busy || saving} onClick={() => setPanel(null)}>Cancel</button>
            <button type="button" className={styles.saveButton} disabled={busy || saving || JSON.stringify(draft) === JSON.stringify(data.appearance)} onClick={() => void save()}>{saving ? 'Saving…' : panel === 'portrait' ? 'Save portrait' : 'Save cover'}</button></div>
        </>}
      </DialogContent>
    </Dialog>
  </>;
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SafeImage from '@/components/SafeImage';
import OrgProfileHero from './OrgProfileHero';
import {
  PROFILE_FACTS, factSuggestion, profileFacts, profileIntroduction, profilePageStyle, resolveProfileCover,
  type OrgAppearanceData, type OrgProfileAppearance, type ProfileFact, type ProfileFactKey,
} from '@/lib/org-profile-appearance';
import styles from './OrgProfileAppearance.module.css';

export default function OrgAppearanceSettings({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [data, setData] = useState<OrgAppearanceData | null>(null);
  const [draft, setDraft] = useState<OrgProfileAppearance | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'cover' | 'identity' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const year = new Date().getUTCFullYear();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    setDraft(null);
    fetch(`/api/orgs/${orgId}/appearance`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load page appearance.');
        if (!controller.signal.aborted) { setData(result); setDraft(result.appearance); }
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message || 'Could not load page appearance.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [orgId, retry]);

  const change = (update: Partial<OrgProfileAppearance>) => {
    setDraft(current => current ? { ...current, ...update } : current);
    setMessage('');
    setError('');
  };

  async function upload(file: File | undefined, target: 'cover' | 'identity') {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a JPEG, PNG or WebP image under 5 MB.'); return;
    }
    setUploading(target); setError(''); setMessage('');
    try {
      const body = new FormData(); body.set('file', file);
      const response = await fetch(`/api/orgs/${orgId}/appearance/image`, { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not upload the image.');
      setDraft(current => current ? target === 'cover'
        ? { ...current, cover: { kind: 'upload', url: result.url }, coverPosition: { x: 50, y: 50 } }
        : { ...current, identity: { ...current.identity, mode: current.identity.mode === 'initials' ? 'logo' : current.identity.mode, url: result.url } }
        : current);
      setMessage('Image ready. Save appearance to show it on your page.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not upload the image.'); }
    finally { setUploading(null); }
  }

  async function save() {
    if (!draft) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/orgs/${orgId}/appearance`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save page appearance.');
      setDraft(result.appearance);
      setData(current => current ? { ...current, appearance: result.appearance } : current);
      setMessage('Appearance saved. Your public page is updated.');
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save page appearance.'); }
    finally { setSaving(false); }
  }

  if (loading) return <section id="appearance" className={styles.editor} aria-busy="true"><h2>Page appearance</h2><p>Loading your page…</p></section>;
  if (!data || !draft) return <section id="appearance" className={styles.editor}><h2>Page appearance</h2>
    <p role="alert">{error || 'Could not load page appearance.'}</p><button className={styles.textButton} onClick={() => setRetry(value => value + 1)}>Try again</button></section>;

  const facts = draft.facts ?? profileFacts(draft, data.org, data.projectCount, year);
  const cover = resolveProfileCover(draft, data.projects);
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.appearance);
  const busy = saving || uploading !== null;
  const moveFact = (index: number, direction: number) => {
    const updated = [...facts];
    [updated[index], updated[index + direction]] = [updated[index + direction], updated[index]];
    change({ facts: updated });
  };
  const updateFact = (key: ProfileFactKey, value: string) => change({ facts: facts.map(fact => fact.key === key ? { ...fact, value } : fact) });
  const addFact = (key: ProfileFactKey) => {
    if (!key || facts.length >= 4 || facts.some(fact => fact.key === key)) return;
    const fact: ProfileFact = { key, value: factSuggestion(key, data.org, data.projectCount, year).slice(0, 48) };
    change({ facts: [...facts, fact] });
  };

  return <section id="appearance" className={styles.editor} aria-labelledby="appearance-heading">
    <h2 id="appearance-heading">Page appearance</h2>
    <p>Make this the opening of your firm’s magazine. Preview your choices, then save to update the public page.</p>
    <fieldset disabled={busy}>
      <div className={styles.editorGrid}>
        <div className={styles.controls}>
          <div>
            <h3>Page color</h3>
            <div className={styles.inlineControls}>
              <input type="color" aria-label="Page background color" value={draft.backgroundColor || '#ffffff'} onChange={event => change({ backgroundColor: event.target.value })} />
              <span className="text-xs">{draft.backgroundColor || 'Folio default'}</span>
              <button type="button" className={styles.textButton} onClick={() => change({ backgroundColor: null })}>Use site default</button>
            </div>
          </div>
          <div>
            <h3>Banner photograph</h3>
            <label>Background image
              <select value={draft.cover.kind} onChange={event => {
                const kind = event.target.value;
                if (kind === 'auto' || kind === 'none') change({ cover: { kind } });
                else if (kind === 'project') {
                  const first = data.projects.find(project => project.images.length)?.images[0];
                  if (first) change({ cover: { kind: 'project', imageId: first.id } });
                }
              }}>
                <option value="auto">Automatic · a published project photo</option>
                <option value="project" disabled={!data.projects.some(project => project.images.length)}>Choose from published projects</option>
                {draft.cover.kind === 'upload' && <option value="upload">Uploaded photograph</option>}
                <option value="none">No photograph</option>
              </select>
            </label>
            {draft.cover.kind === 'project' && <div className={styles.choices} aria-label="Published project photographs">
              {data.projects.flatMap(project => project.images.map((image, index) => <button key={image.id} type="button"
                className={styles.imageChoice} aria-label={`${project.title}, photograph ${index + 1}`} aria-pressed={draft.cover.kind === 'project' && draft.cover.imageId === image.id}
                onClick={() => change({ cover: { kind: 'project', imageId: image.id }, coverPosition: { x: 50, y: 50 } })}>
                <SafeImage src={image.url} alt="" fill sizes="140px" /><span>{project.title}</span>
              </button>))}
            </div>}
            <label className="mt-3">Upload a banner photograph
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { void upload(event.target.files?.[0], 'cover'); event.target.value = ''; }} />
            </label>
            <p>JPEG, PNG or WebP, up to 5 MB. Use an image you want to share publicly.</p>
            {!cover && draft.cover.kind === 'project' && <p role="status">This photograph is no longer public. Choose another image.</p>}
            {cover && <div className="mt-3 space-y-3">
              <label>Horizontal framing <input type="range" min="0" max="100" value={draft.coverPosition.x}
                onChange={event => change({ coverPosition: { ...draft.coverPosition, x: Number(event.target.value) } })} /></label>
              <label>Vertical framing <input type="range" min="0" max="100" value={draft.coverPosition.y}
                onChange={event => change({ coverPosition: { ...draft.coverPosition, y: Number(event.target.value) } })} /></label>
            </div>}
          </div>
          <div>
            <h3>Logo or portrait</h3>
            <label>Image treatment
              <select value={draft.identity.mode} onChange={event => change({ identity: { ...draft.identity, mode: event.target.value as OrgProfileAppearance['identity']['mode'] } })}>
                <option value="logo">Logo · show the whole image</option><option value="portrait">Portrait · fill the frame</option><option value="initials">Firm initials</option>
              </select>
            </label>
            {draft.identity.mode !== 'initials' && <>
              <label className="mt-3">Upload a logo or studio portrait
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { void upload(event.target.files?.[0], 'identity'); event.target.value = ''; }} />
              </label>
              <button type="button" className={styles.textButton} onClick={() => change({ identity: { mode: 'logo', url: null } })}>Use existing firm logo</button>
            </>}
          </div>
          <div>
            <h3>Cover introduction</h3>
            <label>A short opening to your firm’s story
              <textarea rows={5} maxLength={360} value={profileIntroduction(draft, data.org)} onChange={event => change({ introduction: event.target.value })} />
            </label>
            <p>{profileIntroduction(draft, data.org).length}/360 characters. Your full About page stays available below the cover.</p>
            <button type="button" className={styles.textButton} onClick={() => change({ introduction: null })}>Use existing profile introduction</button>
          </div>
          <div>
            <h3>Featured facts · {facts.length}/4</h3>
            <p>Choose what matters to your firm. Lifetime projects completed is your own total; Projects on Folio updates automatically.</p>
            {facts.map((fact, index) => {
              const label = PROFILE_FACTS.find(option => option.key === fact.key)?.label || fact.key;
              return <div className={styles.factEditor} key={fact.key}>
                <div className={styles.factEditorHeader}><strong>{label}</strong>
                  <button type="button" disabled={index === 0} aria-label={`Move ${label} earlier`} onClick={() => moveFact(index, -1)}>Earlier</button>
                  <button type="button" disabled={index === facts.length - 1} aria-label={`Move ${label} later`} onClick={() => moveFact(index, 1)}>Later</button>
                  <button type="button" aria-label={`Remove ${label}`} onClick={() => change({ facts: facts.filter(item => item.key !== fact.key) })}>Remove</button>
                </div>
                <input aria-label={`${label} value`} maxLength={48} value={fact.key === 'folio' ? data.projectCount : fact.value}
                  readOnly={fact.key === 'folio'} onChange={event => updateFact(fact.key, event.target.value)} />
              </div>;
            })}
            <label>Add a fact
              <select value="" disabled={facts.length >= 4} onChange={event => addFact(event.target.value as ProfileFactKey)}>
                <option value="">{facts.length >= 4 ? 'Four facts selected' : 'Choose a fact'}</option>
                {PROFILE_FACTS.filter(option => !facts.some(fact => fact.key === option.key)).map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </label>
            <button type="button" className={styles.textButton} onClick={() => change({ facts: null })}>Use suggested facts</button>
          </div>
        </div>
        <div className={styles.preview} style={profilePageStyle(draft.backgroundColor)}>
          <p>Cover preview{dirty ? ' · unsaved changes' : ''}</p>
          <OrgProfileHero org={data.org} appearance={draft} cover={cover} projectCount={data.projectCount} year={year} preview />
        </div>
      </div>
    </fieldset>
    <div className={styles.saveBar}>
      <button type="button" className={styles.saveButton} disabled={busy || !dirty} onClick={() => void save()}>{saving ? 'Saving…' : 'Save appearance'}</button>
      <button type="button" className={styles.textButton} disabled={busy || !dirty} onClick={() => { setDraft(data.appearance); setError(''); setMessage(''); }}>Undo changes</button>
      <Link href={`/org/${orgId}`} className={styles.textButton}>View public page</Link>
      {uploading && <span className={styles.status} role="status">Uploading {uploading === 'cover' ? 'banner' : 'identity image'}…</span>}
      {error && <span className={`${styles.status} ${styles.error}`} role="alert">{error}</span>}
      {!error && message && <span className={styles.status} role="status">{message}</span>}
    </div>
  </section>;
}

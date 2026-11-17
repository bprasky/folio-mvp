'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { CoverageReview, CoverageReviewItem, CoverageScope } from '@/lib/coverage/schema';
import forms from '@/components/ui/WorkflowForms.module.css';
import styles from './Coverage.module.css';

type Project = { id: string; title: string; isPublic: boolean };
type Review = { items: CoverageReviewItem[]; projects: Project[]; found?: number };
function ReviewFeature({ item, projects, busy, save }: { item: CoverageReviewItem; projects: Project[]; busy: boolean; save: (input: CoverageReview) => Promise<void> }) {
  const [title, setTitle] = useState(item.title);
  const [source, setSource] = useState(item.source);
  const [date, setDate] = useState(item.publicationDate || '');
  const [category, setCategory] = useState(item.category);
  const [project, setProject] = useState(item.projectId || '');
  const [context, setContext] = useState(item.useForInterview || item.state === 'pending' && item.category === 'interview');
  return <form className={styles.review} onSubmit={event => { event.preventDefault(); void save({ id: item.id, version: item.version, action: 'approve', title, source,
    category, publicationDate: date || null, projectId: project || null, useForInterview: context }); }}>
    <p className={styles.eyebrow}>{item.state === 'approved' ? 'On your Folio' : item.state === 'dismissed' ? 'Dismissed' : 'For your review'}</p>
    <p className={styles.copy}>{item.matchReason}</p>
    <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>Open original source ↗</a>
    <fieldset disabled={busy} className={forms.stack}>
      <label className={forms.label}>Headline<input className={forms.field} value={title} onChange={event => setTitle(event.target.value)} maxLength={300} required /></label>
      <div className={forms.row}>
        <label className={forms.label}>Publication<input className={forms.field} value={source} onChange={event => setSource(event.target.value)} maxLength={180} required /></label>
        <label className={forms.label}>Published date, if known<input className={forms.field} type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      </div>
      <label className={forms.label}>Format<select className={forms.field} value={category} onChange={event => setCategory(event.target.value as typeof category)}>
        <option value="feature">Feature</option><option value="interview">Interview</option><option value="podcast">Podcast</option><option value="video">Video</option>
      </select></label>
      <label className={forms.label}>Related project<select className={forms.field} value={project} onChange={event => setProject(event.target.value)}>
        <option value="">Profile only</option>{projects.map(value => <option key={value.id} value={value.id}>{value.title}{value.isPublic ? '' : ' · private draft'}</option>)}
      </select></label>
      {project && <p className={forms.help}>This feature also appears on the project when that project is public. Its photographs stay subject to your project publishing choices.</p>}
      <div className={forms.actions}><button className={forms.secondary} type="button" onClick={() => void save({ id: item.id, version: item.version, action: 'read' })}>{item.readStatus === 'unread' ? 'Read for interview context' : 'Read source again'}</button></div>
      {item.readMessage && <p role="status" className={forms.help}>{item.readMessage}</p>}
      {(project || item.scope.type === 'person') && <label className={styles.check}><input type="checkbox" checked={context} onChange={event => setContext(event.target.checked)} />Read available article text when I approve this feature and use it to inform {project ? "this project's" : 'my profile'} interview, so Folio can ask about what remains unexplored.</label>}
      {item.readStatus === 'read' && !project && item.scope.type === 'organization' && <p className={forms.help}>Connect a project to use this source in its interview.</p>}
      <div className={forms.actions}>
        <button type="submit" className={forms.primary}>{item.state === 'approved' ? 'Save changes' : 'This is our work — add to Folio'}</button>
        <button type="button" className={forms.quiet} onClick={() => void save({ id: item.id, version: item.version, action: item.state === 'approved' ? 'withdraw' : 'dismiss' })}>{item.state === 'approved' ? 'Remove from Folio' : 'Dismiss'}</button>
      </div>
    </fieldset>
  </form>;
}

export function CoverageManager({ scope, autoDiscover = false, sweepId }: { scope: CoverageScope; autoDiscover?: boolean; sweepId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Review>({ items: [], projects: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [url, setUrl] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const generation = useRef(0);
  const lock = useRef(false);
  const scopeKey = `${scope.type}:${scope.id}`;
  useEffect(() => { generation.current++; setData({ items: [], projects: [] }); setOpen(false); setError(''); setNotice(''); setBusy(false); lock.current = false; }, [scopeKey]);
  useEffect(() => {
    if (!autoDiscover) return;
    let cancelled = false;
    const key = `folio-coverage-sweep:${scopeKey}:${sweepId || 'profile'}`;
    void request('GET').then(result => {
      // A saved search result proves the sweep already ran for this profile; the
      // browser marker covers searches that found nothing. Neither repeats per tab.
      if (cancelled || !result || result.items.some(item => item.discoveredBy === 'search') || (!sweepId && result.items.length)) return;
      try { if (localStorage.getItem(key)) return; } catch { /* Storage can be unavailable. */ }
      void request('POST', { scope }).then(found => { if (found) { try { localStorage.setItem(key, 'complete'); } catch { /* Review remains saved on the server. */ } } });
    });
    return () => { cancelled = true; };
    // The sweep starts once for this authorized profile, independent of panel toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDiscover, scopeKey, sweepId]);
  async function request(method: 'GET' | 'POST' | 'PATCH', body?: unknown): Promise<Review | undefined> {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    const current = generation.current;
    try {
      const query = method === 'GET' ? `?${new URLSearchParams({ type: scope.type, id: scope.id })}` : '';
      const response = await fetch(`/api/coverage${query}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined,
        signal: AbortSignal.timeout(85000),
        body: body ? JSON.stringify(body) : undefined });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save this feature. Please try again.');
      if (!Array.isArray(result.items) || !Array.isArray(result.projects)) throw new Error('Could not load your coverage. Please reload the review.');
      if (current !== generation.current) return;
      setData(result);
      if (method === 'POST') setNotice(result.found ? 'Your finds are saved privately below. Review each before adding it to Folio.' : 'No matching features found. You can add a publication link below.');
      if (method === 'PATCH') { setNotice('Saved.'); router.refresh(); }
      if (method === 'POST' && url) setUrl('');
      return result;
    } catch (failure) { if (current === generation.current) setError(failure instanceof Error ? failure.message : 'Please try again.'); }
    finally { if (current === generation.current) { lock.current = false; setBusy(false); } }
  }
  const visible = data.items.filter(item => dismissed || item.state !== 'dismissed');
  return <section className={styles.offer}>
    <div className={styles.intro}><h2 className={styles.title}>Bring your story together.</h2>
      <p className={styles.copy}>Find features and interviews about your work. Choose what belongs on your Folio, and connect it to the projects behind it.</p></div>
    <button type="button" className={forms.secondary} onClick={() => { setOpen(true); void request('GET'); }}>{data.items.some(item => item.state === 'pending') ? `Review ${data.items.filter(item => item.state === 'pending').length} possible ${data.items.filter(item => item.state === 'pending').length === 1 ? 'feature' : 'features'}` : 'Find & manage coverage'}</button>
    {autoDiscover && !open && (busy || error || notice) && <p role={error ? 'alert' : 'status'} className={`${forms.help} mt-3`}>{busy ? 'Looking for published features while you review your photographs.' : error || notice}</p>}
    <Dialog open={open} onOpenChange={setOpen} placement="right" backdropClassName="bg-black/40">
      <DialogContent placement="right" className={forms.sheet} aria-describedby="coverage-review-description">
        <div className={forms.sheetHeader}><div><DialogTitle className={forms.sheetTitle}>Your work, elsewhere.</DialogTitle><p id="coverage-review-description" className={forms.help}>Nothing appears publicly until you approve it.</p></div>
          <button type="button" className={forms.close} aria-label="Close coverage review" onClick={() => setOpen(false)}>×</button></div>
        <div className={forms.sheetBody}>
          <div className={forms.stack}>
            <button className={forms.primary} type="button" disabled={busy} onClick={() => void request('POST', { scope })}>{busy ? 'Working…' : 'Find my coverage'}</button>
            <form className={forms.linkRow} onSubmit={event => { event.preventDefault(); void request('POST', { scope, url }); }}>
              <label className={forms.label}>Have a publication link?<input className={forms.field} type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://publication.com/your-feature" required disabled={busy} /></label>
              <button className={forms.secondary} disabled={busy} type="submit">Add link</button>
            </form>
            {error && <div role="alert" className={forms.notice}>{error}<button className={forms.quiet} type="button" disabled={busy} onClick={() => void request('GET')}>Reload review</button></div>}
            {notice && <p role="status" className={forms.notice}>{notice}</p>}
            {busy && <p role="status" className={forms.help}>Checking your coverage. Your saved features stay in place.</p>}
          </div>
          {visible.map(item => <ReviewFeature key={item.id} item={item} projects={data.projects} busy={busy} save={async input => { await request('PATCH', input); }} />)}
          {!!data.items.some(item => item.state === 'dismissed') && <label className={styles.check}><input type="checkbox" checked={dismissed} onChange={event => setDismissed(event.target.checked)} />Show dismissed features</label>}
        </div>
      </DialogContent>
    </Dialog>
  </section>;
}

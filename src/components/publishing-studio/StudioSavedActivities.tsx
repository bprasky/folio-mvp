'use client';

import { useEffect, useRef, useState } from 'react';
import { ActivityArticleCover } from './ActivityArticleCover';
import { StudioPublicationCard } from './StudioPublicationCard';
import type { ActivityContext } from '@/lib/publishing-studio/activities';
import type { ActivitySnapshot } from './StoryActivity';

export function StudioSavedActivities() {
  const [stories, setStories] = useState<ActivitySnapshot[]>([]);
  const [identity, setIdentity] = useState<NonNullable<ActivityContext['identity']>>({name:'The designer'});
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<ActivitySnapshot | null>(null);
  const [removeError, setRemoveError] = useState('');
  const [pending, setPending] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (removing) dialog.current?.showModal?.(); }, [removing]);
  async function removeDraft() {
    if (!removing || pending) return;
    setPending(true); setRemoveError('');
    try {
      const response = await fetch(`/api/publishing-studio/stories/${encodeURIComponent(removing.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'discard', revision: removing.revision }),
      });
      const data = await response.json();
      if (!response.ok || data.status !== 'withdrawn') throw new Error(data.error || 'Could not remove your draft. Your interview is still here.');
      setStories(current => current.filter(story => story.id !== removing.id));
      setRemoving(null);
    } catch (cause) { setRemoveError(cause instanceof Error ? cause.message : 'Could not remove your draft.'); }
    finally { setPending(false); }
  }
  useEffect(() => {
    let cancelled = false;
    fetch('/api/publishing-studio/stories', { cache: 'no-store' }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load your interviews.');
      if (!cancelled) { setStories(data.stories); setIdentity(data.context?.identity || {name:data.context?.designerName || 'The designer'}); }
    }).catch(() => { if (!cancelled) setError('Your interviews could not be loaded. Refresh to try again.'); });
    return () => { cancelled = true; };
  }, []);
  if (error) return <p role="alert" className="folio-body my-6">{error}</p>;
  if (!stories.length) return null;
  return <section className="my-10" aria-label="Your interviews"><h2 className="folio-h3 mb-5">Your interviews</h2>
    {removing && <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!pending) setRemoving(null); }} className="max-w-md rounded-2xl border border-folio-border-subtle p-6 backdrop:bg-black/40">
      <h3 className="folio-h3">Remove this interview draft?</h3>
      <p className="folio-body my-4">“{removing.definition.title}” and its saved answers will be removed from your Studio.</p>
      {removeError && <p role="alert" className="folio-body my-4">{removeError}</p>}
      <div className="flex flex-wrap gap-4"><button disabled={pending} className="folio-ui underline underline-offset-4" onClick={removeDraft}>{pending ? 'Removing…' : 'Remove saved draft'}</button><button disabled={pending} className="folio-ui underline underline-offset-4" onClick={() => setRemoving(null)}>Keep draft</button></div>
    </dialog>}
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{stories.map(story => <div key={story.id}>
      <StudioPublicationCard title={story.draft?.title || story.definition.title}
        preview={<ActivityArticleCover title={story.draft?.title || story.definition.title} identity={identity} projectImageUrl={story.projectImageUrl} working={!story.draft} />}
        benefit="Let readers hear the thinking behind your work."
        metadata={story.publishedUrl ? 'Published' : 'Saved work'}
        contribution={story.draft ? story.publishedUrl ? 'Your article is ready to share.' : 'Review your saved article before publishing.' : `${story.answers.filter(answer => answer.text.trim()).length} of ${story.definition.questions.length} answers saved.`}
        actionLabel={story.publishedUrl ? 'View article' : story.draft ? 'Review and publish' : 'Continue my interview'}
        href={`/designer/studio/activity?id=${encodeURIComponent(story.id)}`} readiness={story.publishedUrl ? 'published' : 'saved'} />
      {!story.publishedUrl && !story.previousPublishedUrl && <button className="folio-meta mt-3 underline underline-offset-4" onClick={() => { setRemoving(story); setRemoveError(''); }}>Remove draft</button>}
    </div>)}</div></section>;
}

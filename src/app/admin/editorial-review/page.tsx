'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type ReviewPost = {
  id: string; projectId: string; slug: string; status: string; updatedAt: string;
  project: { title: string; designer: { name: string | null } | null };
  review: { submittedAt?: string; reviewedBy?: string; reviewedAt?: string; reason?: string };
};

export default function EditorialReviewPage() {
  const [status, setStatus] = useState('REVIEW');
  const [posts, setPosts] = useState<ReviewPost[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/editorial-review?status=' + status);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load reviews');
      setPosts(result.posts);
    } catch (err) { setPosts([]); setError(err instanceof Error ? err.message : 'Unable to load reviews'); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void reload(); }, [reload]);

  async function review(post: ReviewPost, action: 'approve' | 'reject') {
    const reason = action === 'reject' ? window.prompt('Reason for returning this post to draft:') : undefined;
    if (action === 'reject' && !reason?.trim()) return;
    if (action === 'approve' && !window.confirm('Approve and publish this post?')) return;
    setBusy(post.id); setError('');
    try {
      const response = await fetch('/api/posting/project/' + post.projectId + '/status', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason, expectedUpdatedAt: post.updatedAt }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Review failed');
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'Review failed'); }
    finally { setBusy(null); }
  }

  return <main className="mx-auto max-w-5xl p-8">
    <h1 className="mb-2 text-3xl font-semibold">Editorial review</h1>
    <p className="mb-6 text-gray-600">Review submitted stories. Approval publishes the project and its article.</p>
    <nav className="mb-6 flex gap-4" aria-label="Review status">
      {[['REVIEW', 'Awaiting review'], ['PUBLISHED', 'Published'], ['DRAFT', 'Returned to draft']].map(([value, label]) =>
        <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}
          className={status === value ? 'font-bold underline' : ''}>{label}</button>)}
    </nav>
    {error && <p role="alert" className="mb-4 text-red-700">{error}</p>}
    {loading ? <p>Loading reviews…</p> : !posts.length ? <p>No posts in this view.</p> :
      <ul className="space-y-4">{posts.map(post => <li key={post.id} className="rounded-lg border p-5">
        <h2 className="text-xl font-semibold">{post.project.title || 'Untitled project'}</h2>
        <p>{post.project.designer?.name || 'Designer'}</p>
        <p className="text-sm text-gray-600">Submitted {post.review.submittedAt ? new Date(post.review.submittedAt).toLocaleString() : '—'}</p>
        {post.review.reason && <p className="mt-2">Review feedback: {post.review.reason}</p>}
        {post.review.reviewedBy && <p className="text-sm text-gray-600">Reviewed by {post.review.reviewedBy}</p>}
        <Link className="mr-4 underline" href={post.status === 'PUBLISHED' ? '/p/' + post.slug : '/project/' + post.projectId + '?view=publish'}>View story</Link>
        {post.status === 'REVIEW' && <span className="inline-flex gap-4">
          <button disabled={busy !== null} onClick={() => review(post, 'reject')}>Return to draft</button>
          <button disabled={busy !== null} onClick={() => review(post, 'approve')}>Approve &amp; publish</button>
        </span>}
      </li>)}</ul>}
  </main>;
}

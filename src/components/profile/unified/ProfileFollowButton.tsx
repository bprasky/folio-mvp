'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { workflowRequest } from '@/lib/client/workflowRequest';

export default function ProfileFollowButton({ userId, initiallyFollowing }: { userId: string; initiallyFollowing: boolean }) {
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setFollowing(initiallyFollowing); }, [initiallyFollowing]);
  const change = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await workflowRequest(`/api/users/${encodeURIComponent(userId)}/follow`, { method: following ? 'DELETE' : 'POST' });
      if (response.status === 401) { router.push(`/auth/signin?callbackUrl=${encodeURIComponent('/profile/' + userId)}`); return; }
      if (!response.ok && !(!following && response.status === 409) && !(following && response.status === 404)) {
        throw new Error('Your follow change was not confirmed. Refresh to check before retrying.');
      }
      setFollowing(!following); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not update following. Refresh to check.'); }
    finally { setBusy(false); }
  };
  return <div>
    <button type="button" disabled={busy} onClick={() => void change()} aria-pressed={following}
      className="min-h-11 px-5 py-2 text-sm rounded-full bg-folio-text-primary text-surface-ground disabled:opacity-50">{busy ? 'Saving…' : following ? 'Following' : 'Follow'}</button>
    {error && <p role="alert" className="mt-2 max-w-xs text-folio-meta">{error} <button type="button" className="min-h-11 underline" onClick={() => router.refresh()}>Refresh</button></p>}
  </div>;
}

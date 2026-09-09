'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function PrivateRecording({ interviewId }: { interviewId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/interviews/${interviewId}/media`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Recording access unavailable. Please retry.');
      setUrl((await response.json()).url);
    } catch (err) { setError(err instanceof Error ? err.message : 'Playback failed'); }
    finally { setLoading(false); }
  }
  return <div className="flex-1 space-y-2">
    {url && <audio src={url} controls onError={() => { setUrl(null); setError('Playback access expired or failed. Load the recording again.'); }} />}
    <Button onClick={load} disabled={loading}>{loading ? 'Loading…' : url ? 'Refresh recording access' : 'Load recording'}</Button>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>;
}

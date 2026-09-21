'use client';

import { useEffect, useState } from 'react';
import { renderSocialAnswerCard } from '@/lib/publishing-studio/social-answer-card';

export function ActivitySocialCard({ question, answer, designerName }: { question: string; answer: string; designerName: string }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  async function prepare() {
    setPending(true); setError('');
    try { setUrl(URL.createObjectURL(await renderSocialAnswerCard(question, answer, designerName))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not prepare the image.'); }
    finally { setPending(false); }
  }
  return <div className="mt-4">{error && <p role="alert" className="folio-meta mb-3">{error}</p>}{url ? <>
    {/* The generated local image is the exact downloadable artifact. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={url} alt={`Instagram card: ${question}`} width={1080} height={1350} className="mb-4 h-auto w-full rounded-xl" />
    <a href={url} download="folio-my-story.png" className="folio-ui underline underline-offset-4">Download Instagram image</a>
    <p className="folio-meta mt-2">1080 × 1350 PNG. Ready for you to share.</p>
  </> : <button disabled={pending} className="folio-ui underline underline-offset-4 disabled:opacity-50" onClick={prepare}>{pending ? 'Preparing image…' : 'Preview Instagram image'}</button>}</div>;
}

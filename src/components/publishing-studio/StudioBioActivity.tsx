'use client';

import { useState } from 'react';
import Link from 'next/link';
import BioSetupFlow from '@/components/designer-bio/BioSetupFlow';
import type { DesignerBioData } from '@/app/designer/profile/types';

/** Existing bio persistence is loaded only after the designer explicitly starts. */
export function StudioBioActivity({ profileUrl }: { profileUrl: string }) {
  const [activity, setActivity] = useState<{ bio: DesignerBioData | null; website: string | null } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);

  async function start() {
    setPending(true); setError('');
    try {
      const response = await fetch('/api/designer/bio', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not open your bio. Please try again.');
      setActivity({ website: data.user?.website || null, bio: data.bio ? {
        status: data.bio.status === 'published' ? 'generated' : data.bio.status,
        folioBio: data.bio.folioBio, sourceUrl: data.bio.sourceUrl,
        answerCount: Array.isArray(data.bio.interviewAnswers) ? data.bio.interviewAnswers.length : 0,
      } : null });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open your bio.'); }
    finally { setPending(false); }
  }
  async function copyProfile() {
    try { await navigator.clipboard.writeText(new URL(profileUrl, window.location.origin).href); setCopied(true); }
    catch { setError('Could not copy the link. Open your profile to share its address.'); }
  }

  return <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8">
    <Link href="/designer/studio" className="folio-ui underline underline-offset-4">Back to Studio</Link>
    <p className="folio-meta mt-10 text-folio-text-secondary">About me</p>
    <h1 className="folio-h1 mt-2">A bio that sounds like you.</h1>
    <p className="folio-body mt-4 mb-8 max-w-2xl text-folio-text-secondary">Tell us about your work and your approach. Review the finished bio, make it yours, and choose when to publish it to your Folio profile.</p>
    {error && <p role="alert" className="folio-body my-4">{error}</p>}
    {published ? <section className="rounded-2xl border border-folio-border-subtle p-6">
      <h2 className="folio-h3">Your story is on your profile.</h2>
      <p className="folio-body mt-3">Share your Folio profile with clients or add its link to your Instagram bio.</p>
      <div className="mt-6 flex flex-wrap gap-4"><Link href={profileUrl} className="rounded-full bg-folio-text-primary px-5 py-3 folio-ui text-white">View my profile</Link><button onClick={copyProfile} className="rounded-full border border-folio-border-subtle px-5 py-3 folio-ui">{copied ? 'Profile link copied' : 'Copy profile link'}</button></div>
    </section> : activity ? <BioSetupFlow designerBio={activity.bio} userWebsite={activity.website} onPublished={() => setPublished(true)} /> : <section className="rounded-2xl border border-folio-border-subtle bg-surface-muted p-6 sm:p-8">
      <h2 className="folio-h3">Your experience. Your point of view.</h2>
      <p className="folio-body mt-3 mb-6">Start with your website or a few questions. If you have already started, pick up your saved bio here. Nothing is published until you review and approve it.</p>
      <button onClick={start} disabled={pending} className="rounded-full bg-folio-text-primary px-5 py-3 folio-ui text-white disabled:opacity-50">{pending ? 'Opening your bio…' : 'Start or resume my bio'}</button>
    </section>}
  </main>;
}

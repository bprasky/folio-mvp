'use client';

import Link from 'next/link';
import { useStudio } from './useStudio';
import { studioHref } from '@/lib/publishing-studio/navigation';

/** Project and Studio surfaces read the same records; no separate local queue. */
export function ProjectSocialPanel({ projectId }: { projectId: string }) {
  const { data, error, reload } = useStudio(projectId);
  return (
    <section className="rounded-2xl border border-folio-border-subtle bg-surface-canvas p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="folio-h3">Social & campaigns</h2><p className="folio-body mt-2 text-folio-text-secondary">Your project’s pieces, connected to your Publishing Studio.</p></div>
        <Link href={studioHref('campaigns', projectId)} className="folio-ui underline underline-offset-4">View all in Publishing Studio</Link>
      </div>
      {error ? <div className="mt-4 folio-ui" role="alert"><p>{error}</p><button onClick={reload} className="underline">Try again</button></div> : !data ? <p className="mt-4 folio-ui" role="status">Loading social work…</p> : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {data.campaigns.slice(0, 2).map(campaign => <Link key={campaign.id} href={studioHref('campaigns', projectId, campaign.id)} className="min-w-0 rounded-xl border border-folio-border-subtle p-4 hover:bg-surface-ground"><span className="folio-meta text-folio-text-secondary">CAMPAIGN · {campaign.postCount} pieces saved</span><p className="folio-ui mt-1 break-words">{campaign.title}</p></Link>)}
            {data.posts.filter(post => post.kind === 'carousel').slice(0, 2).map(post => <Link key={post.id} href={studioHref('posts', projectId, post.id)} className="min-w-0 rounded-xl border border-folio-border-subtle p-4 hover:bg-surface-ground"><span className="folio-meta text-folio-text-secondary">CAROUSEL · {post.status}</span><p className="folio-ui mt-1 break-words">{post.title}</p></Link>)}
          </div>
          {!data.campaigns.length && !data.posts.length && <p className="mt-4 folio-ui text-folio-text-secondary">No social pieces yet. Start here or alongside your other projects in Studio.</p>}
          <div className="mt-5 flex flex-wrap gap-5 folio-ui">
            <Link href={studioHref('posts', projectId) + '&create=post'} className="underline underline-offset-4">Create a carousel</Link>
            <Link href={studioHref('campaigns', projectId) + '&create=campaign'} className="underline underline-offset-4">Create a campaign</Link>
          </div>
        </>
      )}
    </section>
  );
}

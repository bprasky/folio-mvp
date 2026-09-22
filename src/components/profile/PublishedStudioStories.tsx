import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { publicStory } from '@/lib/publishing-studio/story-service';
/** Only the owner's explicitly published articles belong on their profile. Private drafts stay workspace-scoped. */
export async function PublishedStudioStories({ userId }: { userId: string }) {
  const rows = await prisma.editorialStory.findMany({ where: { ownerId: userId, status: 'published' },
    select: { slug: true }, orderBy: { updatedAt: 'desc' }, take: 12 });
  const stories = (await Promise.all(rows.map(row => publicStory(row.slug)))).filter(story => story !== null);
  if (!stories.length) return null;
  return <section className="mx-auto max-w-6xl px-6 py-12" aria-label="In conversation">
    <h2 className="folio-h2">In conversation</h2><div className="mt-6 grid gap-6 sm:grid-cols-2">{stories.map(story => <Link key={story.slug} href={`/stories/${story.slug}`} className="rounded-xl border border-folio-border-subtle p-6">
      <p className="folio-meta">With Folio</p><h3 className="folio-h3 mt-2">{story.title}</h3><span className="mt-4 inline-block folio-ui underline underline-offset-4">Read the interview</span>
    </Link>)}</div>
  </section>;
}

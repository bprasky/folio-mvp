import { ActivityArticleCover } from '@/components/publishing-studio/ActivityArticleCover';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicStory } from '@/lib/publishing-studio/story-service';
export const dynamic = 'force-dynamic';
export default async function StoryPage({ params }: { params: { slug: string } }) {
  const story = await publicStory(params.slug);
  if (!story) notFound();
  return <article className="mx-auto max-w-3xl px-6 py-16">
    <ActivityArticleCover heading title={story.draft.title || story.title} identity={{name:story.owner.name || "The designer", portraitUrl:story.owner.profileImage, logoUrl:story.owner.brandProfile?.logoImageUrl}} />
    <Link href={`/profile/${story.owner.id}`} className="mt-4 inline-block folio-body underline underline-offset-4">{story.owner.name || 'Meet the designer'}</Link>
    <div className="mt-12 space-y-10">{story.draft.entries.map(entry => <section key={entry.questionId}>
      <h2 className="folio-h3">{entry.question}</h2><p className="mt-4 whitespace-pre-wrap folio-body">{entry.answer}</p>
    </section>)}</div>
    <Link href={`/profile/${story.owner.id}`} className="mt-12 inline-block folio-body underline underline-offset-4">Explore the designer’s work on Folio</Link>
  </article>;
}

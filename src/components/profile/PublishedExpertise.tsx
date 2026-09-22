import { expertiseEnabled } from '@/lib/publishing-studio/expertise/flag';
import Link from 'next/link';
import { publishedExpertise } from '@/lib/publishing-studio/expertise/service';
export async function PublishedExpertise({ userId }: { userId: string }) {
  if (!expertiseEnabled()) return null;
  const stories = await publishedExpertise(userId);
  return <section aria-label="Expertise" className="space-y-6"><header><h2 className="folio-h2">Expertise</h2><p className="folio-body mt-2 text-folio-text-secondary">The thinking behind the work, in the designer’s own words.</p></header>
    {!stories.length ? <p className="folio-body">Published expertise articles will appear here.</p> : <div className="grid gap-6 sm:grid-cols-2">{stories.map(story => <article key={story.id}><Link href={`/expertise/${story.slug}`} className="block">{(story.article.coverUrl || story.article.media[0]?.url) && <img src={story.article.coverUrl || story.article.media[0]?.url} alt={story.article.cover === 'portrait' ? `Portrait of ${story.owner.name || 'the designer'}` : story.article.cover === 'logo' ? 'Studio identity' : story.article.media[0]?.alt || story.title} style={story.article.cover === 'portrait' ? { objectPosition: `${story.article.coverPosition?.x ?? 50}% ${story.article.coverPosition?.y ?? 50}%` } : undefined} className={`aspect-[4/3] w-full rounded-xl ${story.article.cover === 'logo' ? 'object-contain' : 'object-cover'}`} />}<p className="folio-meta mt-3">{story.article.featured ? 'Featured by the designer' : 'Designer perspective'}</p><h3 className="folio-h3 mt-2">{story.title}</h3><p className="folio-body mt-2">{story.article.introduction}</p><span className="folio-ui mt-4 inline-block underline underline-offset-4">Read article</span></Link></article>)}</div>}
  </section>;
}

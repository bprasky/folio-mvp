import Link from 'next/link';
import type { ExpertiseArticle } from '@/lib/publishing-studio/expertise/types';

export function ExpertiseArticleView({ article, author }: { article: ExpertiseArticle; author: { id: string; name: string | null } }) {
  return <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
    <p className="folio-meta text-folio-text-secondary">Designer perspective</p>
    <h1 className="folio-h1 mt-4">{article.title}</h1>
    <Link className="folio-body mt-4 inline-block underline underline-offset-4" href={`/profile/${author.id}`}>By {author.name || 'the designer'}</Link>
    {article.coverUrl && <img src={article.coverUrl} alt={article.cover === 'portrait' ? `Portrait of ${author.name || 'the designer'}` : article.cover === 'logo' ? 'Studio identity' : article.media[0]?.alt || 'Project evidence'} style={article.cover === 'portrait' ? { objectPosition: `${article.coverPosition?.x ?? 50}% ${article.coverPosition?.y ?? 50}%` } : undefined} className={`mt-8 w-full rounded-xl ${article.cover === 'logo' ? 'h-36 object-contain' : article.cover === 'portrait' ? 'aspect-[4/5] max-h-[40rem] object-cover' : 'max-h-[32rem] object-contain'}`} />}
    <p className="folio-body mt-8 whitespace-pre-wrap">{article.introduction}</p>
    <div className="mt-10 space-y-10">{article.claims.map(claim => <section key={claim.id}>
      <p className="folio-body whitespace-pre-wrap">{claim.text}</p>
      {article.media.filter(media => claim.evidenceIds.includes(media.evidenceId)).map(media => <figure key={`${claim.id}:${media.evidenceId}`} className="mt-6">
        <img src={media.url} alt={media.alt} className="w-full rounded-xl" />
        <figcaption className="mt-3 folio-meta text-folio-text-secondary"><Link className="underline underline-offset-4" href={`/project/${media.projectId}`}>{media.projectName}</Link>{media.roomName ? ` · ${media.roomName}` : ''}<p className="mt-1">{media.caption}</p>{media.photographer && <p className="mt-1">Photography: {media.photographer}</p>}</figcaption>
      </figure>)}
    </section>)}</div>
    <Link href={`/profile/${author.id}?tab=expertise`} className="folio-ui mt-12 inline-block underline underline-offset-4">More from {author.name || 'this designer'}</Link>
  </article>;
}

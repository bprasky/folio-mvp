import Link from 'next/link';
import { ExpertiseArticleCover } from './ExpertiseArticleCover';
import type { ExpertiseArticle } from '@/lib/publishing-studio/expertise/types';

export function ExpertiseArticleView({ article, author }: { article: ExpertiseArticle; author: { id: string; name: string | null } }) {
  return <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
    <ExpertiseArticleCover title={article.title} name={author.name} article={article} />
    <Link className="folio-ui mt-4 inline-block underline underline-offset-4" href={`/profile/${author.id}`}>View {author.name || 'the designer'}’s profile</Link>
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

import type { ExpertiseArticle, ExpertiseEvidence } from '@/lib/publishing-studio/expertise/types';
import type { ExpertiseSnapshot } from './transport';

/** The same cover, source selection and typography serve the feed, interview and published article. */
export function ExpertiseArticleCover({ title, name, article, evidence = [], working = false, compact = false }: {
  title: string; name?: string | null; article?: ExpertiseArticle | null; evidence?: ExpertiseEvidence[]; working?: boolean; compact?: boolean;
}) {
  const media = article ? article.media : evidence.filter(item => item.imageUrl).map(item => ({ projectId: item.projectId, projectName: item.projectName, roomName: item.roomName, url: item.imageUrl!, alt: item.alt || `${item.roomName || 'Project detail'} at ${item.projectName}` }));
  const selected = article?.cover === 'project' ? media.find(item => item.url === article.coverUrl) : undefined;
  const ordered = selected ? [selected, ...media.filter(item => item !== selected)] : media;
  const projects = ordered.filter((item, index) => ordered.findIndex(other => other.projectId === item.projectId) === index).slice(0, 2);
  // Never revive an unavailable project asset via its old cover URL.
  const coverUrl = article?.cover === 'project' ? media.find(item => item.url === article.coverUrl)?.url : article?.coverUrl;
  const identityCover = article?.cover === 'portrait' || article?.cover === 'logo';
  const Heading = compact ? 'h3' : 'h1';
  return <header className={`overflow-hidden bg-surface-ground text-folio-text-primary ${compact ? 'rounded-xl' : ''}`}>
    <div className={compact ? 'p-5 sm:p-6' : 'p-6 sm:p-10'}>
      <div className="flex items-center justify-between gap-3"><p className="folio-meta uppercase tracking-widest">Designer perspective</p>{working && <span className="folio-meta text-folio-text-secondary">Working preview</span>}</div>
      <Heading className={`${compact ? 'folio-h2' : 'folio-h1'} mt-5`}>{title}</Heading>
      <p className="folio-ui mt-4">{name ? `By ${name}` : 'A designer perspective'}</p>
    </div>
    {coverUrl && identityCover && <img src={coverUrl} alt={article?.cover === 'portrait' ? `Portrait of ${name || 'the designer'}` : article?.cover === 'logo' ? 'Studio identity' : media.find(item => item.url === coverUrl)?.alt || 'Project evidence'} style={article?.cover === 'portrait' ? { objectPosition: `${article.coverPosition?.x ?? 50}% ${article.coverPosition?.y ?? 50}%` } : undefined} className={`w-full ${article?.cover === 'logo' ? 'h-32 object-contain px-6 pb-6' : identityCover ? 'aspect-[4/3] object-cover' : 'aspect-[4/3] object-cover'}`} />}
    {!!projects.length && <div className={`grid ${projects.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-1`}>
      {projects.map(project => <div key={project.projectId} className="min-w-0"><img src={project.url} alt={project.alt} className="aspect-[4/3] w-full object-cover" /><p className="folio-meta px-4 py-3">{project.projectName}{project.roomName ? ` · ${project.roomName}` : ''}</p></div>)}
    </div>}
  </header>;
}

export function expertisePreviewState(item: ExpertiseSnapshot) {
  const currentArticle = item.article && item.article.thesisRevision === item.session.thesisRevision ? item.article : null;
  const needsSources = item.sourceChanges.length > 0;
  const title = currentArticle?.title || item.session.thesis;
  const contribution = needsSources ? 'Review the project evidence that changed.' : currentArticle ? item.publishedUrl && currentArticle.reviewed ? 'Your article is published; sharing assets are available in the article.' : 'Review your words, photographs and cover before publishing.' : item.session.status === 'confirm' ? 'Confirm that this framing represents your thinking.' : item.session.status === 'ready' ? 'Prepare your article from the answers you have saved.' : item.session.nextQuestion?.text || 'Continue the interview from your saved answers.';
  const actionLabel = needsSources ? 'Review sources' : currentArticle ? item.publishedUrl && currentArticle.reviewed ? 'Open my article' : 'Review and publish' : item.session.status === 'confirm' ? 'Confirm the framing' : item.session.status === 'ready' ? 'Prepare my article' : 'Continue my interview';
  return { title, article: currentArticle, contribution, actionLabel };
}

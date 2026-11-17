import { absolutePublicUrl, serializeJsonLd } from '@/lib/seo/public';

type Project = { id: string; title: string; description?: string | null; city?: string | null;
  designer?: { id?: string; name?: string } | null; designerOrg?: { id?: string; name?: string } | null;
  images?: Array<{ url: string }> };
export function ProjectStructuredData({ project, slug, excerpt, publishedAt, article = false }: {
  project: Project; slug?: string; excerpt?: string | null; publishedAt?: string | Date | null; article?: boolean;
}) {
  const channel = absolutePublicUrl(slug ? `/p/${encodeURIComponent(slug)}` : `/project/${encodeURIComponent(project.id)}?view=public`);
  const url = article && process.env.FOLIO_EDITORIAL_CHANNELS === 'true' ? `${channel}/feature` : channel;
  const creator = project.designerOrg?.id ? { '@type': 'Organization', '@id': `${absolutePublicUrl(`/org/${encodeURIComponent(project.designerOrg.id)}`)}#identity`, name: project.designerOrg.name }
    : project.designer?.id ? { '@type': 'Person', '@id': `${absolutePublicUrl(`/profile/${encodeURIComponent(project.designer.id)}`)}#identity`, name: project.designer.name } : undefined;
  const work = { '@type': 'CreativeWork', '@id': `${channel}#project`, name: project.title, url: channel,
    ...(project.description ? { description: project.description } : {}), ...(creator ? { creator } : {}) };
  const graph = article ? { '@context': 'https://schema.org', '@type': 'Article', '@id': `${url}#article`, url, mainEntityOfPage: url,
    headline: project.title, ...(excerpt ? { description: excerpt } : {}),
    ...(publishedAt ? { datePublished: new Date(publishedAt).toISOString() } : {}),
    ...(project.images?.length ? { image: project.images.slice(0, 3).map(image => image.url) } : {}),
    publisher: { '@type': 'Organization', name: 'Folio', url: absolutePublicUrl('/') }, about: work }
    : { '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${channel}#page`, url: channel, name: project.title, mainEntity: work };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(graph) }} />;
}

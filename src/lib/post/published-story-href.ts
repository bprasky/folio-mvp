/** Use on currently public projects. A draft or missing post has no public reader. */
export function publishedStoryHref(post: { status: string; slug: string } | null) {
  return post?.status === 'PUBLISHED' && post.slug ? `/p/${encodeURIComponent(post.slug)}` : null;
}

/** Public profile cards can link to an explicitly published photo portfolio. */
export function publishedProjectHref(project: { id: string; isPublic: boolean; publishedAt: Date | null; portfolioPublishedAt?: Date | null; post: { status: string; slug: string } | null }) {
  if (!project.isPublic) return null;
  const feature = publishedStoryHref(project.post);
  if (feature) return feature;
  return process.env.FOLIO_EDITORIAL_CHANNELS === 'true' && project.portfolioPublishedAt && project.publishedAt && project.publishedAt <= new Date()
    ? `/project/${encodeURIComponent(project.id)}?view=public` : null;
}

/** Only explicit, still-live portfolios survive private editorial transitions. */
export function editorialProjectVisibility(project: { isPublic: boolean; publishedAt?: Date | null; portfolioPublishedAt?: Date | null }, publishing: boolean, now = new Date()) {
  const visible = publishing || Boolean(project.isPublic && project.portfolioPublishedAt);
  return { isPublic: visible, publishedAt: visible ? project.publishedAt ?? project.portfolioPublishedAt ?? now : null,
    status: visible ? 'published' : 'draft' };
}

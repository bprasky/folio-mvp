export const STUDIO_VIEWS = ['overview', 'editorial', 'posts', 'campaigns'] as const;
export type StudioView = (typeof STUDIO_VIEWS)[number];

export function studioHref(view: StudioView = 'overview', project?: string, item?: string) {
  const params = new URLSearchParams({ view });
  if (project) params.set('project', project);
  if (item) params.set('item', item);
  return `/designer/studio?${params}`;
}

export function parseStudioView(value: string | null): StudioView {
  return STUDIO_VIEWS.includes(value as StudioView) ? value as StudioView : 'overview';
}

export function matchesStudioItem(
  item: { title: string; projectIds: string[]; status: string },
  filter: { project: string; query: string; status: string },
) {
  return (!filter.project || (filter.project === 'studio-wide' ? true : filter.project === 'cross-project' ? item.projectIds.length > 1 : item.projectIds.includes(filter.project)))
    && (!filter.query || item.title.toLocaleLowerCase().includes(filter.query.toLocaleLowerCase()))
    && (!filter.status || item.status === filter.status);
}

export type ChannelSearchParams = Record<string, string | string[] | undefined>;

/** Preserve repeated query parameters and referral attribution across route changes. */
export function withChannelQuery(path: string, search: ChannelSearchParams = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, entry);
  }
  return query.size ? `${path}?${query}` : path;
}

export function projectChannelHref(slug: string): string {
  return `/p/${encodeURIComponent(slug)}`;
}

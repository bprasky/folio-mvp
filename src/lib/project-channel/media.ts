/** ProjectModule.media has no schema. Normalize only formats we can actually render.
 * This is format validation, not an assertion that a remote asset still exists.
 * Callers MUST first require a published module AND a public, published parent.
 */
export const CHANNEL_MEDIA_TYPES = ['STORY', 'SHORT_VIDEO', 'LONG_VIDEO', 'GALLERY'] as const;
export type ChannelMediaAsset = {
  kind: 'image' | 'video' | 'external';
  url: string;
  poster: string | null;
  caption: string | null;
};
export type ChannelMedia = { assets: ChannelMediaAsset[]; thumbnail: string | null };

export function publicMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    // No local services, credential-bearing storage links or private object URLs in public props.
    const host = url.hostname.toLowerCase();
    if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || /\.(localhost|local|internal|test|invalid)$/.test(host)) return null;
    const path = decodeURIComponent(url.pathname).toLowerCase();
    if (/\/storage\/v1\/object\/(sign|authenticated)\//.test(path) || /\/(private|interview-recordings)\//.test(path)) return null;
    if (Array.from(url.searchParams.keys()).some(key => /token|signature|credential|authorization|^x-amz-|^x-goog-/i.test(key))) return null;
    return url.href;
  } catch { return null; }
}

export function normalizeChannelMedia(type: string, raw: unknown): ChannelMedia {
  if (!CHANNEL_MEDIA_TYPES.some(candidate => candidate === type)) return { assets: [], thumbnail: null };
  const rows = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  const assets: ChannelMediaAsset[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const value = row as Record<string, unknown>;
    if (value.deletedAt || value.deleted === true || value.isPrivate === true || value.isPublic === false) continue;
    if (value.status != null && !['published', 'approved', 'public', 'ready'].includes(String(value.status).toLowerCase())) continue;
    if (value.visibility != null && String(value.visibility).toLowerCase() !== 'public') continue;
    const url = publicMediaUrl(value.url ?? value.imageUrl);
    if (!url || seen.has(url)) continue;
    const parsed = new URL(url);
    const hint = String(value.kind ?? value.type ?? '').toLowerCase();
    const videoProvider = /^(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com)$/.test(parsed.hostname);
    const image = hint === 'image' || /\.(jpe?g|png|webp|avif|gif)$/i.test(parsed.pathname);
    const video = hint === 'video' || /\.(mp4|webm|ogv|mov)$/i.test(parsed.pathname);
    const kind = videoProvider ? 'external' : image ? 'image' : video ? 'video' : null;
    if (!kind) continue; // An arbitrary web URL or file ID is not a video player.
    const poster = [value.thumbnailUrl, value.poster, value.imageUrl].map(publicMediaUrl).find(Boolean) ?? null;
    assets.push({ kind, url, poster, caption: typeof value.caption === 'string' ? value.caption : null });
    seen.add(url);
  }
  return { assets, thumbnail: assets.find(asset => asset.poster)?.poster ?? assets.find(asset => asset.kind === 'image')?.url ?? null };
}

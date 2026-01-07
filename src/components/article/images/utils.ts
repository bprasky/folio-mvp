// src/components/article/images/utils.ts

export type ImageLike = {
  id?: string;
  url?: string | null;
  alt?: string | null;
  caption?: string | null;
  tags?: any[];
};

export function normalizeUrl(u?: string | null) {
  if (!u) return "";
  try {
    const url = new URL(
      u,
      typeof window === "undefined"
        ? "http://localhost"
        : window.location.origin
    );
    // Strip variable bits
    url.search = "";
    // Common CDN param tails sometimes baked into pathname; trim sizes like /w_1200,h_800/
    return url.toString().replace(/(\/(w|h|c|q)_[^/]+)+/g, "");
  } catch {
    // Fallback: strip query/hash
    return String(u).split("?")[0].split("#")[0];
  }
}

function uniq<T>(arr: T[], key: (x: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = key(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

export function dedupeImages(list: ImageLike[]) {
  return uniq(
    list.filter((i) => i && (i.id || i.url)),
    (i) => {
      const urlKey = normalizeUrl(i.url || "");
      return String(i.id || urlKey || i.url);
    }
  );
}

export function normImages(list: any[]): ImageLike[] {
  if (!Array.isArray(list)) return [];

  const normalized = list
    .map((it) => {
      const raw =
        it?.url ||
        it?.imageUrl ||
        it?.asset?.url ||
        it?.media?.url ||
        it?.thumbnailUrl ||
        null;

      const url = raw ? normalizeUrl(String(raw)) : null;

      return {
        id: it?.id || it?.assetId || it?.imageId || undefined,
        url,
        alt: it?.alt || it?.caption || null,
        caption: it?.caption || it?.credit || null,
        tags: it?.tags || it?.productTags || [],
      } as ImageLike;
    })
    .filter((i) => i.url);

  return dedupeImages(normalized);
}


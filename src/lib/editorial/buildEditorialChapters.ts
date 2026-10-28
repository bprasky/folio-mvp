import type { PullQuoteSelection } from '@/lib/posting/schemas';

export type EditorialChapter = {
  id: string;
  index: number;
  title?: string | null;
  body?: string | null;
  /**
   * The body as authored: one entry per paragraph.
   *
   * `body` above is these joined with blank lines, which is what the reading
   * layouts want — but the section-override API is keyed by
   * (chapterIndex, paragraphIndex), so the join erases the only handle an editor
   * has on a paragraph. Both shapes are carried; neither is derived at the point
   * of use.
   */
  bodyParagraphs: string[];
  pullQuote?: string | PullQuoteSelection | null;
  primaryImage?: any | null;
  supportingImages: any[];
  taggedProducts: any[];
};

export function buildEditorialChapters(post: any): EditorialChapter[] {
  const chaptersRaw =
    post?.expandedBlocks?.galleryChapters && Array.isArray(post.expandedBlocks.galleryChapters)
      ? post.expandedBlocks.galleryChapters
      : [];

  if (!chaptersRaw.length) {
    // Fallback: treat the whole article as a single chapter using any lead image
    const leadImage =
      post?.leadImage ||
      (post?.project?.images?.length ? post.project.images[0] : null);

    return [
      {
        id: post.id ?? "chapter-0",
        index: 0,
        title: post?.expandedBlocks?.lead?.title ?? post?.project?.title ?? null,
        body: post?.expandedBlocks?.lead?.deck ?? null,
        bodyParagraphs: post?.expandedBlocks?.lead?.deck ? [post.expandedBlocks.lead.deck] : [],
        pullQuote: null,
        primaryImage: leadImage,
        supportingImages: [],
        taggedProducts: [],
      },
    ];
  }

  // Build image lookup map from project images
  const projectImages = post?.project?.images || [];
  const imageMap = new Map(projectImages.map((img: any) => [img.id, img]));

  return chaptersRaw.map((ch: any, idx: number) => {
    // Resolve imageIds to actual image objects
    const imageIds = Array.isArray(ch.imageIds) ? ch.imageIds : [];
    const images = imageIds
      .map((id: string) => imageMap.get(id))
      .filter(Boolean);
    
    // Also check for ch.images (backward compatibility)
    const legacyImages = Array.isArray(ch.images) ? ch.images : [];
    const allImages = images.length > 0 ? images : legacyImages;
    
    const [primaryImage, ...restImages] = allImages;

    // Handle body - can be array of strings or a single string
    let bodyText = ch.body ?? ch.narrative ?? null;
    if (Array.isArray(bodyText)) {
      bodyText = bodyText.join('\n\n');
    }

    // Paragraphs, additive and derived from the same source. `bodyText` above is
    // left exactly as it was: it feeds the published article, and an editing
    // concern must not renormalize what a reader sees. Only an ARRAY body is
    // addressable — a legacy single-string body has no paragraph indices the
    // override API could name, so it edits as one block rather than being split
    // into indices that do not exist in expandedBlocks.
    const rawBody = ch.body ?? ch.narrative ?? null;
    const bodyParagraphs: string[] = Array.isArray(rawBody)
      ? rawBody.map((p: unknown): string => typeof p === 'string' ? p : '')
      : typeof rawBody === 'string' && rawBody.trim()
        ? [rawBody]
        : [];

    // Extract tagged products from images
    const taggedProducts: any[] = [];
    allImages.forEach((img: any) => {
      if (img?.tags && Array.isArray(img.tags)) {
        img.tags.forEach((tag: any) => {
          if (tag?.product && !taggedProducts.find((p: any) => p.id === tag.product.id)) {
            taggedProducts.push(tag.product);
          }
        });
      }
    });

    return {
      id: ch.id ?? `chapter-${idx}`,
      index: idx,
      title: ch.title ?? null,
      body: bodyText,
      bodyParagraphs,
      pullQuote: ch.pullQuote ?? null,
      primaryImage,
      supportingImages: restImages,
      taggedProducts,
    } as EditorialChapter;
  });
}


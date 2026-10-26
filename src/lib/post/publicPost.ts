/** Explicit publication transport. Never serialize Prisma records or interview state. */
const pick = <K extends string>(value: any, keys: K[]): Record<K, any> => Object.fromEntries(
  keys.filter(key => value?.[key] !== undefined).map(key => [key, value[key]]),
) as Record<K, any>;
const list = (value: any): any[] => Array.isArray(value) ? value : [];
const text = (value: any) => typeof value === 'string' ? value : null;
const prose = (value: any) => typeof value === 'string' ? value : list(value).filter(v => typeof v === 'string');
const quote = (value: any, approved: Set<string>): any => typeof value === 'string' ? value : value ? {
  selected: value.selected ? { text: text(value.selected.text) } : null,
  alternatives: list(value.alternatives).filter(option => approved.has(option.text)).map(option => ({ text: option.text })),
  authorship: value.authorship,
  ...(value.folio ? { folio: { selected: value.folio.selected ? { text: text(value.folio.selected.text) } : null, alternatives: [] } } : {}),
} : null;

export function publicProduct(product: any) {
  return {
    ...pick(product, ['id', 'name', 'description', 'brand', 'category', 'price', 'url', 'imageUrl', 'primaryImageUrl', 'thumbnailUrl', 'cutoutImageUrl', 'imageSource', 'vendorId']),
    vendor: product?.vendor ? pick(product.vendor, ['id', 'name', 'companyName', 'website']) : null,
  };
}

export function publicProject(project: any) {
  return {
    ...pick(project, ['id', 'title', 'description', 'city', 'regionState', 'projectType', 'category', 'timeline', 'completedYear', 'completedMonth', 'isPublic', 'publishedAt', 'status', 'views', 'saves', 'shares', 'createdAt', 'updatedAt', 'designerId']),
    designer: project?.designer ? pick(project.designer, ['id', 'name', 'studio', 'profileImage', 'bio', 'website', 'instagram', 'linkedin']) : null,
    designerOrg: project?.designerOrg ? pick(project.designerOrg, ['name']) : null,
    images: list(project?.images).filter(image => image.inclusion !== 'EXCLUDED').map(image => ({
      id: image.id, url: image.url, name: image.name, room: image.room, roomId: image.roomId, displayOrder: image.displayOrder,
      tags: list(image.tags).filter(tag => tag.product && !tag.product.isPending).map(tag => ({
        id: tag.id, x: tag.x, y: tag.y, productId: tag.productId, imageId: tag.imageId, cropUrl: tag.cropUrl, finishRaw: tag.finishRaw,
        product: publicProduct(tag.product),
      })),
    })),
  };
}

export function publicPost(post: any) {
  const project = publicProject(post.project);
  const imageIds = new Set(project.images.map(image => image.id));
  const tagIds = new Set(project.images.flatMap(image => image.tags.map(tag => tag.id)));
  const blocks = post.expandedBlocks || {};
  const approved = new Set<string>(list(blocks.embeddedQuotes).filter(choice => choice.sourceId === 'designer').map(choice => choice.text));
  const credits = (value: any) => list(value).map(entry => pick(entry, ['role', 'name', 'url']));
  return {
    ...pick(post, ['id', 'projectId', 'slug', 'status', 'variant', 'excerpt', 'keywords', 'publishedAt']),
    heroAssetId: imageIds.has(post.heroAssetId) ? post.heroAssetId : null,
    credits: credits(post.credits),
    project,
    expandedBlocks: {
      headline: text(blocks.headline),
      lead: pick(blocks.lead, ['title', 'kicker', 'deck']),
      introduction: prose(blocks.introduction),
      galleryChapters: list(blocks.galleryChapters).map(chapter => ({
        ...pick(chapter, ['id', 'title', 'roomId', 'kind']),
        body: prose(chapter.body ?? chapter.narrative),
        imageIds: list(chapter.imageIds).filter(id => imageIds.has(id)),
        // Legacy inline assets must resolve through the same eligible records.
        images: list(chapter.images).flatMap(image => project.images.filter(candidate => candidate.id === image.id || candidate.url === image.url)),
        pullQuote: quote(chapter.pullQuote, approved),
      })),
      pullQuotes: list(blocks.pullQuotes).map(value => typeof value === 'string' ? value : pick(value, ['text', 'context', 'sourceSection'])),
      embeddedQuotes: list(blocks.embeddedQuotes).map(value => pick(value, ['slotId', 'sourceId', 'text', 'attribution'])),
      credits: credits(blocks.credits),
      method: prose(blocks.method),
      qa: list(blocks.qa).map(value => pick(value, ['q', 'a', 'role'])),
      materialsLedger: { items: list(blocks.materialsLedger?.items).map(value => pick(value, ['productId', 'name', 'finish', 'vendorId', 'vendorName', 'note'])) },
    },
    supplementalQuotes: list(post.supplementalQuotes)
      .filter(value => value.pinned && (!value.productTagId || tagIds.has(value.productTagId)))
      .map(value => pick(value, ['id', 'answer', 'contributorRole', 'productTagId', 'pinned', 'displayLocation'])),
  };
}

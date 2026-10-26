export interface PhotoSaveProgress {
  projectId?: string;
  imageIds: Map<string, string>;
  productIds: Map<string, string>;
  savedTags: Set<string>;
}
export const newPhotoSaveProgress = (): PhotoSaveProgress => ({ imageIds: new Map(), productIds: new Map(), savedTags: new Set() });

/** Keep receipts across retries. A failed child write must not discard the project/form. */
export async function saveProjectPhotos(projectId: string, images: any[], progress: PhotoSaveProgress) {
  const send = async (url: string, body: unknown) => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error('Some photos or product tags could not be saved. Your saved work is safe. Retry to finish the remaining items.');
    return response.json();
  };
  for (const image of images) {
    // Pre-existing images were already persisted when the edit modal opened.
    if (!progress.imageIds.has(image.id) && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(image.id)) continue;
    let imageId = progress.imageIds.get(image.id);
    if (!imageId) {
      const result = await send(`/api/projects/${projectId}/images`, { url: image.url, name: image.name || 'Project image', room: image.room || null });
      if (!result.image?.id) throw new Error('Photo save could not be confirmed. Keep this window open and retry.');
      imageId = result.image.id as string;
      progress.imageIds.set(image.id, imageId);
    }
    for (const tag of image.tags || []) {
      const key = `${image.id}:${tag.id}`;
      if (progress.savedTags.has(key)) continue;
      let productId = progress.productIds.get(tag.productId) || tag.productId;
      if (!progress.productIds.has(tag.productId) && (tag.isPending || tag.productId.startsWith('pending-'))) {
        const result = await send('/api/products', { name: tag.productName, imageUrl: tag.productImage, price: tag.productPrice || 0, brand: tag.productBrand, isPending: true });
        if (!result.id) throw new Error('Product save could not be confirmed. Keep this window open and retry.');
        productId = result.id;
        progress.productIds.set(tag.productId, productId);
      }
      await send('/api/tag-product-to-image', { x: tag.x, y: tag.y, productId, imageId, projectId });
      progress.savedTags.add(key);
    }
  }
}

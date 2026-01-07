// src/components/article/utils/materialResolvers.ts

export function resolveMaterialImage(
  mat: any,
  projectImages?: Array<{ id?: string; url?: string | null; tags?: Array<{ product?: { id?: string; imageUrl?: string | null } }> }>
) {
  if (!mat) return null;

  // 0) Check product tags from project images (if material has productId)
  if (mat.productId && Array.isArray(projectImages)) {
    for (const img of projectImages) {
      if (img?.tags && Array.isArray(img.tags)) {
        const productTag = img.tags.find(
          (tag: any) => tag?.product?.id === mat.productId
        );
        if (productTag?.product?.imageUrl) {
          return productTag.product.imageUrl;
        }
      }
    }
  }

  // 1) If the material references an image by id (common when tags come from project assets)
  const possibleIds = [
    mat.imageId,
    mat.assetId,
    mat.taggedAssetId,
    mat.projectImageId,
  ].filter(Boolean);

  if (possibleIds.length && Array.isArray(projectImages)) {
    const found = projectImages.find(
      (im) => im?.id && possibleIds.includes(im.id)
    );
    if (found?.url) return found.url;
  }

  // 2) Try common URL fields (broad coverage across shapes)
  const candidates = [
    mat.imageUrl,
    mat.image?.url,
    mat.thumbnailUrl,
    mat.thumbnail?.url,
    mat.coverUrl,
    mat.cover?.url,
    mat.assetUrl,
    mat.asset?.url,
    mat.media?.url,
    mat.mediaUrl,

    // Nested product/vendor objects
    mat.product?.imageUrl,
    mat.product?.coverUrl,
    mat.product?.images?.[0]?.url,
    mat.vendorProduct?.imageUrl,
    mat.vendorProduct?.images?.[0]?.url,

    // Selections from gallery / tags
    mat.selection?.imageUrl,
    mat.selection?.image?.url,
  ].filter(Boolean);

  if (candidates.length) return String(candidates.find(Boolean));

  // 3) No image found
  return null;
}

export function resolveMaterialHref(mat: any) {
  const candidates = [
    mat.href,
    mat.url,
    mat.product?.url,
    mat.vendorProduct?.url,
    mat.selection?.url,
    mat.product?.slug ? `/product/${mat.product.slug}` : null,
    mat.productId ? `/products/${mat.productId}` : null,
  ].filter(Boolean);
  return (candidates[0] as string) || "#";
}

export function resolveMaterialName(mat: any) {
  return (
    mat?.name ||
    mat?.label ||
    mat?.product?.name ||
    mat?.vendorProduct?.name ||
    "Material"
  );
}

export function resolveVendorName(mat: any) {
  return (
    mat?.vendor ||
    mat?.vendorName ||
    mat?.product?.vendorName ||
    mat?.vendorProduct?.vendorName ||
    mat?.vendor?.name ||
    mat?.vendor?.companyName ||
    "Vendor"
  );
}


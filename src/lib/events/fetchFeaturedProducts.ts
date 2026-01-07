import { prisma } from "@/lib/prisma";

type Product = {
  id: string;
  title?: string;
  name?: string; // some code paths may use 'name'
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  url?: string | null;
  vendorId?: string | null;
  price?: string | null;
  brand?: string | null;
  vendorName?: string | null;
  // ...any other fields you already expose
};

// Fetch products directly using Prisma - more efficient than HTTP calls
async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids?.length) return [];
  
  try {
    const products = await prisma.product.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        url: true,
        price: true,
        brand: true,
        vendorId: true,
        vendor: {
          select: {
            id: true,
            name: true,
            companyName: true,
          }
        }
      },
    });

    return products.map(product => ({
      id: product.id,
      title: product.name, // normalize to 'title'
      name: product.name,
      imageUrl: product.imageUrl,
      thumbnailUrl: product.imageUrl, // use same imageUrl for thumbnailUrl
      url: product.url,
      vendorId: product.vendorId,
      price: product.price?.toString(),
      brand: product.brand,
      vendorName: product.vendor?.companyName || product.vendor?.name || null,
    }));
  } catch (error) {
    console.error('Error fetching products by IDs:', error);
    return [];
  }
}

/**
 * Given an event record with linkedProducts: string[], return resolved product objects
 * in the same order.
 */
export async function resolveFeaturedProducts(linkedProducts: string[] | null | undefined): Promise<Product[]> {
  const ids = Array.isArray(linkedProducts) ? linkedProducts.filter(Boolean) : [];
  if (!ids.length) return [];
  
  const products = await fetchProductsByIds(ids);

  // Keep original order from linkedProducts
  const map = new Map(products.map(p => [p.id, p]));
  
  return ids
    .map(id => map.get(id))
    .filter(Boolean) as Product[];
}

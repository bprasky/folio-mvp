import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { Product } from '@/lib/mock/product';

/**
 * Fetch a product from the database by ID and convert to UI format.
 * Wrapped with React cache() for request deduplication (generateMetadata + page component).
 */
export const getProductById = cache(async (id: string): Promise<Product | null> => {
  const productFromDB = await prisma.product.findUnique({
    where: { id },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!productFromDB) {
    return null;
  }

  const product: Product = {
    id: productFromDB.id,
    slug: productFromDB.id,
    name: productFromDB.name,
    brand: productFromDB.brand || productFromDB.vendor?.name || "",
    description: productFromDB.description || "",
    assets: productFromDB.imageUrl
      ? [{ type: "image" as const, src: productFromDB.imageUrl, alt: productFromDB.name }]
      : [],
    materials: [],
    finish: "",
    dimensions: { w: 0, d: 0, h: 0, units: "in" },
    sku: productFromDB.brand || "",
    leadTime: undefined,
    weight: undefined,
    files: { specSheets: [], _3d: [] },
    inspiration: [],
    insights: { saves: 0, tags: 0, saveToTagPct: 0, topRooms: [], topMarkets: [] },
    related: [],
  };

  return product;
});

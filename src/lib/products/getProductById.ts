import { prisma } from '@/lib/prisma';
import { Product } from '@/lib/mock/product';
import { MOCK_PRODUCT } from '@/lib/mock/product';

/**
 * Fetch a product from the database by ID and convert to UI format
 */
export async function getProductById(id: string): Promise<Product | null> {
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

  console.log('🧠 Product name from DB:', productFromDB.name);

  // Convert DB product to UI format
  // Use mock product as defaults for optional fields, but DB values override
  const product: Product = {
    // Start with mock defaults for fields that might not be in DB
    ...MOCK_PRODUCT,
    
    // Override with real DB data
    id: productFromDB.id,
    slug: productFromDB.id, // Use id as slug
    name: productFromDB.name, // ✅ Real name from DB
    brand: productFromDB.brand || productFromDB.vendor?.name || "Unknown",
    description: productFromDB.description || "",
    
    // Assets - use imageUrl from DB if available
    assets: productFromDB.imageUrl 
      ? [{ type: "image" as const, src: productFromDB.imageUrl, alt: productFromDB.name }]
      : MOCK_PRODUCT.assets,
    
    // TODO: Parse these from DB when available
    materials: [], // Parse from DB or leave empty
    finish: "", // Parse from DB or leave empty
    dimensions: MOCK_PRODUCT.dimensions, // Use mock defaults for now
    sku: productFromDB.brand || "",
    leadTime: undefined,
    weight: undefined,
    
    // Files - use mock defaults for now
    files: MOCK_PRODUCT.files,
    
    // Social/engagement - use mock defaults (TODO: fetch from analytics)
    inspiration: MOCK_PRODUCT.inspiration,
    insights: MOCK_PRODUCT.insights,
    related: MOCK_PRODUCT.related,
  };

  console.log('🎭 Product name in returned object:', product.name);

  return product;
}





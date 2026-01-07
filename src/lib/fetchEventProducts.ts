/**
 * Best-effort mapper for event.linkedProducts to UIProduct[].
 * - If Product model exists, try a prisma.product.findMany with select: { id, name, imageUrl, vendorName }.
 * - If not, map strings to { id: string, name: string } placeholders.
 * - Never throw. Always return [] on failure.
 */
import { prisma } from "@/lib/prisma";
import { UIProduct } from "@/types/ui";

export async function fetchEventProducts(linked?: string[] | null): Promise<UIProduct[]> {
  if (!linked?.length) return [];
  
  if (process.env.NODE_ENV !== 'production') {
    console.info('[fetchEventProducts] linkedProducts count:', linked.length);
  }
  
  try {
    // Try reading Product table if present (wrapped in try/catch so this remains optional)
    const products = await prisma.product.findMany({
      where: { id: { in: linked } },
      select: { 
        id: true, 
        name: true, 
        imageUrl: true, 
        url: true,
        vendor: {
          select: {
            id: true,
            name: true,
            companyName: true,
            profileImage: true,
          }
        }
      },
    });
    
    return products.map(product => ({
      id: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      vendorName: product.vendor?.companyName || product.vendor?.name || null,
      url: product.url,
    }));
  } catch {
    // Fallback: assume linked is just an array of ids/urls/names
    return linked.map((id, i) => ({
      id: String(id),
      name: `Product ${i + 1}`,
      imageUrl: undefined,
      vendorName: null,
      url: null,
    }));
  }
} 
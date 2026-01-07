import { prisma } from '@/lib/prisma';

type Confidence = 'high' | 'medium' | 'low';

export type VendorResolutionResult = 
  | { vendor: { id: string; name: string }; vendorName: string; confidence: 'high' | 'medium' }
  | { vendor: null; vendorName: string | null; confidence: 'low' };

/**
 * Resolves or creates a canonical Vendor record for a product.
 * Returns vendor with confidence level, or null vendor with low confidence.
 */
export async function resolveOrCreateShadowVendor(
  product: {
    vendorRecordId?: string | null;
    vendorRecord?: { name: string } | null;
    vendor?: { name?: string | null; companyName?: string | null } | null;
    brand?: string | null;
    name?: string;
  }
): Promise<VendorResolutionResult> {
  // If product already has vendorRecordId, use it (high confidence)
  if (product.vendorRecordId) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: product.vendorRecordId },
      select: { id: true, name: true },
    });
    if (vendor) {
      return { vendor, vendorName: vendor.name, confidence: 'high' };
    }
  }

  // Try to resolve vendor name
  let vendorName: string | null = null;
  let confidence: Confidence = 'low';

  // Priority 1: vendorRecord.name (if included) - HIGH confidence
  if (product.vendorRecord?.name) {
    vendorName = product.vendorRecord.name.trim();
    confidence = 'high';
  }
  // Priority 2: vendor (User) name or companyName - HIGH confidence
  else if (product.vendor?.name || product.vendor?.companyName) {
    vendorName = (product.vendor.companyName || product.vendor.name || '').trim();
    confidence = 'high';
  }
  // Priority 3: product.brand (if meaningful) - MEDIUM confidence
  else if (product.brand && !product.vendorId && !product.vendorRecordId) {
    const brandDenylist = ['unknown', 'n/a', 'generic', 'misc', 'brand', 'vendor', 'external', 'tbd', 'pending'];
    const normalizedBrand = product.brand.trim().toLowerCase();
    const brandLength = product.brand.trim().length;
    
    if (
      brandLength >= 3 &&
      brandLength <= 80 &&
      !brandDenylist.includes(normalizedBrand)
    ) {
      vendorName = product.brand.trim();
      confidence = 'medium';
    }
  }

  // If we can't resolve a vendor name confidently, return low confidence
  if (!vendorName || vendorName.length < 2) {
    return { vendor: null, vendorName: null, confidence: 'low' };
  }

  // Find existing Vendor by case-insensitive name match
  const existingVendor = await prisma.vendor.findFirst({
    where: {
      name: {
        equals: vendorName,
        mode: 'insensitive',
      },
    },
    select: { id: true, name: true },
  });

  if (existingVendor) {
    return { vendor: existingVendor, vendorName: existingVendor.name, confidence };
  }

  // Only create shadow vendor if confidence is high or medium
  if (confidence === 'low') {
    return { vendor: null, vendorName, confidence: 'low' };
  }

  // Create shadow vendor (unclaimed)
  const shadowVendor = await prisma.vendor.create({
    data: {
      name: vendorName,
      website: null,
      userId: null, // Unclaimed
      primaryEmail: null,
    },
    select: { id: true, name: true },
  });

  return { vendor: shadowVendor, vendorName: shadowVendor.name, confidence };
}


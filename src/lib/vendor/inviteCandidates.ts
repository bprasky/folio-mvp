import { prisma } from '@/lib/prisma';

/**
 * Normalizes a vendor name for deduplication.
 * - Lowercase, trim, collapse whitespace
 * - Optionally remove trailing "Inc." / "LLC" (light normalization)
 */
export function normalizeVendorName(vendorName: string): string {
  return vendorName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/\s*(inc\.?|llc\.?|ltd\.?|corp\.?|corporation)\s*$/i, '') // Remove trailing business suffixes
    .trim();
}

/**
 * Computes a normalized key for vendor deduplication.
 * Format: normalizedVendorName + '|' + domain (if repEmail exists)
 */
export function computeNormalizedKey(vendorName: string, repEmail?: string | null): string {
  const normalizedName = normalizeVendorName(vendorName);
  
  if (repEmail && repEmail.includes('@')) {
    const domain = repEmail.split('@')[1]?.toLowerCase().trim();
    if (domain) {
      return `${normalizedName}|${domain}`;
    }
  }
  
  return normalizedName;
}

/**
 * Extracts domain from email address
 */
function extractEmailDomain(email: string): string | null {
  const match = email.trim().toLowerCase().match(/@(.+)$/);
  return match ? match[1] : null;
}

/**
 * Extracts domain from URL
 */
function extractUrlDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Unified capture function for vendor invite data.
 * 
 * ⚠️ GUARD: Do not write repEmail on candidate; add VendorInviteContact rows instead.
 * This prevents overwrites and supports multiple contacts per vendor.
 * 
 * This function:
 * - Upserts candidate by normalizedKey (no overwrite of existing vendor name)
 * - Creates signal for provenance
 * - Creates contact row if repEmail provided (no overwrites - multiple contacts per candidate)
 * - Extracts and stores domains
 */
export async function captureVendorInviteData({
  vendorName,
  vendorWebsite,
  repEmail,
  repName,
  designerId,
  projectId,
  tagId,
  sourceUrl,
  source = 'TAGGING',
}: {
  vendorName: string;
  vendorWebsite?: string | null;
  repEmail?: string | null;
  repName?: string | null;
  designerId: string;
  projectId: string;
  tagId?: string | null;
  sourceUrl?: string | null;
  source?: 'TAGGING' | 'SCRAPE' | 'MANUAL_ADMIN' | 'LEGACY';
}): Promise<{ candidateId: string; created: boolean }> {
  // Normalize and compute key (use vendor name only, not email, for candidate dedupe)
  const normalizedKey = normalizeVendorName(vendorName);
  
  // Skip if vendor name is too short or empty after normalization
  if (!normalizedKey || normalizedKey.length < 2) {
    throw new Error('Vendor name is too short or invalid');
  }

  // Extract domains
  const websiteDomain = vendorWebsite ? extractUrlDomain(vendorWebsite) : null;
  const emailDomain = repEmail ? extractEmailDomain(repEmail) : null;

  // Upsert candidate (DO NOT overwrite repEmail/repName fields - they're deprecated)
  const candidate = await prisma.vendorInviteCandidate.upsert({
    where: { normalizedKey },
    update: {
      // Only update website if not already set
      ...(vendorWebsite && !websiteDomain ? { vendorWebsite: vendorWebsite.trim() } : {}),
      // Update primaryDomain if not set and we have a domain
      ...((websiteDomain || emailDomain) && {
        primaryDomain: websiteDomain || emailDomain || undefined,
      }),
      updatedAt: new Date(),
    },
    create: {
      vendorName: vendorName.trim(),
      vendorWebsite: vendorWebsite?.trim() || null,
      // Keep repEmail/repName for migration compatibility but don't use going forward
      repEmail: null, // Deprecated - use VendorInviteContact instead
      repName: null, // Deprecated - use VendorInviteContact instead
      normalizedKey,
      status: 'PENDING',
      firstSeenByDesignerId: designerId,
      firstSeenInProjectId: projectId,
      primaryDomain: websiteDomain || emailDomain || null,
    },
  });

  // Create signal (always create, even if candidate already existed)
  await prisma.vendorInviteSignal.create({
    data: {
      candidateId: candidate.id,
      designerId,
      projectId,
      tagId: tagId || null,
    },
  });

  // Update lastSeenAt
  await prisma.vendorInviteCandidate.update({
    where: { id: candidate.id },
    data: { lastSeenAt: new Date() },
  });

  // Phase 5D: vendorInviteContact model never existed — contact-row creation block removed.
  // If contact persistence is needed later, add VendorInviteContact model + table first.

  return {
    candidateId: candidate.id,
    created: !candidate.firstSeenByDesignerId || candidate.firstSeenByDesignerId === designerId,
  };
}

/**
 * @deprecated Use captureVendorInviteData() instead
 * Legacy function kept for backward compatibility
 */
export async function captureVendorInviteCandidate({
  vendorName,
  vendorWebsite,
  repEmail,
  repName,
  designerId,
  projectId,
  tagId,
}: {
  vendorName: string;
  vendorWebsite?: string | null;
  repEmail?: string | null;
  repName?: string | null;
  designerId: string;
  projectId: string;
  tagId?: string | null;
}): Promise<{ candidateId: string; created: boolean }> {
  const result = await captureVendorInviteData({
    vendorName,
    vendorWebsite,
    repEmail,
    repName,
    designerId,
    projectId,
    tagId,
    source: 'TAGGING',
  });
  return {
    candidateId: result.candidateId,
    created: result.created,
  };
}


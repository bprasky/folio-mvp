/**
 * Match imported contacts against known vendors in the Folio ecosystem.
 *
 * Matching strategy (in order of confidence):
 * 1. HIGH:   Email domain matches a known vendor org's website domain
 * 2. MEDIUM: Company name matches an org the designer has tagged products from
 * 3. LOW:    Company name matches a vendor in the product catalog (not tagged by designer)
 *
 * Personal email domains are filtered out.
 */

import { prisma } from '@/lib/prisma';
import type { ParsedContact } from './parse-csv';

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'me.com', 'mac.com', 'live.com', 'msn.com',
  'protonmail.com', 'proton.me', 'mail.com', 'zoho.com',
  'comcast.net', 'att.net', 'verizon.net', 'sbcglobal.net',
]);

export interface MatchedContact extends ParsedContact {
  vendorOrgId: string | null;
  vendorName: string | null;
  matchConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMATCHED';
}

/**
 * Filter contacts to professional-only (has company or non-personal email domain).
 */
export function filterProfessional(contacts: ParsedContact[]): ParsedContact[] {
  return contacts.filter(c => {
    // Has a company name — keep
    if (c.company) return true;

    // Non-personal email domain — keep
    const domain = c.email.split('@')[1]?.toLowerCase();
    if (domain && !PERSONAL_DOMAINS.has(domain)) return true;

    return false;
  });
}

/**
 * Match contacts against vendors. Returns contacts with match metadata.
 */
export async function matchContactsToVendors(
  contacts: ParsedContact[],
  designerUserId: string,
): Promise<MatchedContact[]> {
  // Build lookup maps for matching

  // 1. Get all vendor orgs with their website domains
  const vendorOrgs = await prisma.organization.findMany({
    where: {
      type: { in: ['VENDOR', 'MANUFACTURER', 'SHOWROOM'] },
    },
    select: { id: true, name: true, website: true },
  });

  // Build domain → org map
  const domainToOrg = new Map<string, { id: string; name: string }>();
  for (const org of vendorOrgs) {
    if (org.website) {
      const domain = extractDomain(org.website);
      if (domain) domainToOrg.set(domain, { id: org.id, name: org.name });
    }
  }

  // Build name → org map (case-insensitive)
  const nameToOrg = new Map<string, { id: string; name: string }>();
  for (const org of vendorOrgs) {
    nameToOrg.set(org.name.toLowerCase().trim(), { id: org.id, name: org.name });
  }

  // 2. Get vendor names from products the designer has tagged
  const designerVendorNames = new Set<string>();
  const designerProducts = await prisma.sourcebookEntry.findMany({
    where: { userId: designerUserId },
    select: {
      product: {
        select: { brand: true },
      },
    },
  });
  for (const entry of designerProducts) {
    if (entry.product.brand) {
      designerVendorNames.add(entry.product.brand.toLowerCase().trim());
    }
  }

  // 3. Get all unique product brands for LOW confidence matching
  const allBrands = await prisma.product.findMany({
    where: { brand: { not: null } },
    select: { brand: true },
    distinct: ['brand'],
  });
  const allBrandNames = new Set(
    allBrands.map(p => p.brand!.toLowerCase().trim())
  );

  // Match each contact
  const results: MatchedContact[] = [];

  for (const contact of contacts) {
    const domain = contact.email.split('@')[1]?.toLowerCase();
    const companyLower = contact.company?.toLowerCase().trim();

    // Strategy 1: Domain match against vendor org website
    if (domain) {
      const orgMatch = domainToOrg.get(domain);
      if (orgMatch) {
        results.push({
          ...contact,
          vendorOrgId: orgMatch.id,
          vendorName: orgMatch.name,
          matchConfidence: 'HIGH',
        });
        continue;
      }
    }

    // Strategy 2: Company name matches an org
    if (companyLower) {
      const orgMatch = nameToOrg.get(companyLower);
      if (orgMatch) {
        // MEDIUM if designer has tagged products from this vendor, LOW otherwise
        const confidence = designerVendorNames.has(companyLower) ? 'MEDIUM' : 'LOW';
        results.push({
          ...contact,
          vendorOrgId: orgMatch.id,
          vendorName: orgMatch.name,
          matchConfidence: confidence,
        });
        continue;
      }

      // Strategy 3: Company name matches a product brand (vendor may not be on Folio as org)
      if (allBrandNames.has(companyLower)) {
        const confidence = designerVendorNames.has(companyLower) ? 'MEDIUM' : 'LOW';
        results.push({
          ...contact,
          vendorOrgId: null,
          vendorName: contact.company!,
          matchConfidence: confidence,
        });
        continue;
      }
    }

    // No match
    results.push({
      ...contact,
      vendorOrgId: null,
      vendorName: null,
      matchConfidence: 'UNMATCHED',
    });
  }

  return results;
}

function extractDomain(url: string): string | null {
  try {
    let cleaned = url.trim();
    if (!cleaned.startsWith('http')) cleaned = `https://${cleaned}`;
    const parsed = new URL(cleaned);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

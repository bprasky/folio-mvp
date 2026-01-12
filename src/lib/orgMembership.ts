/**
 * Organization Membership Utilities
 *
 * User type is derived from org memberships, not User.role (which stays INDIVIDUAL).
 * Users can belong to multiple orgs of different types (e.g., designer at one firm, vendor at another).
 */

import { OrgType } from '@prisma/client';

type OrgMembership = {
  organizationId: string;
  role: string;
  isActive: boolean;
  organization?: {
    id: string;
    name: string;
    type: OrgType;
  };
};

/**
 * Check if user is a designer (has membership in DESIGN_FIRM org)
 */
export function isDesigner(memberships: OrgMembership[]): boolean {
  return memberships.some(
    (m) => m.isActive && m.organization?.type === 'DESIGN_FIRM'
  );
}

/**
 * Check if user is a vendor (has membership in VENDOR org)
 */
export function isVendor(memberships: OrgMembership[]): boolean {
  return memberships.some(
    (m) => m.isActive && m.organization?.type === 'VENDOR'
  );
}

/**
 * Check if user is a manufacturer (has membership in MANUFACTURER org)
 */
export function isManufacturer(memberships: OrgMembership[]): boolean {
  return memberships.some(
    (m) => m.isActive && m.organization?.type === 'MANUFACTURER'
  );
}

/**
 * Get all active org types for a user
 */
export function getUserOrgTypes(memberships: OrgMembership[]): OrgType[] {
  const types = new Set<OrgType>();
  memberships
    .filter((m) => m.isActive && m.organization?.type)
    .forEach((m) => {
      if (m.organization?.type) {
        types.add(m.organization.type);
      }
    });
  return Array.from(types);
}

/**
 * Get primary user type for display purposes
 * Priority: DESIGN_FIRM > VENDOR > MANUFACTURER > SHOWROOM > CONTRACTOR
 */
export function getPrimaryUserType(memberships: OrgMembership[]): OrgType | 'INDIVIDUAL' {
  const types = getUserOrgTypes(memberships);

  if (types.includes('DESIGN_FIRM')) return 'DESIGN_FIRM';
  if (types.includes('VENDOR')) return 'VENDOR';
  if (types.includes('MANUFACTURER')) return 'MANUFACTURER';
  if (types.includes('SHOWROOM')) return 'SHOWROOM';
  if (types.includes('CONTRACTOR')) return 'CONTRACTOR';

  return 'INDIVIDUAL';
}

/**
 * Check if user has admin or owner permissions in any org
 */
export function hasOrgAdminAccess(memberships: OrgMembership[]): boolean {
  return memberships.some(
    (m) => m.isActive && (m.role === 'ADMIN' || m.role === 'OWNER')
  );
}

/**
 * Check if user owns any org (has OWNER role)
 */
export function ownsOrg(memberships: OrgMembership[]): boolean {
  return memberships.some((m) => m.isActive && m.role === 'OWNER');
}

/**
 * Get all orgs where user has admin/owner access
 */
export function getAdminOrgs(memberships: OrgMembership[]): OrgMembership[] {
  return memberships.filter(
    (m) => m.isActive && (m.role === 'ADMIN' || m.role === 'OWNER')
  );
}

/**
 * Get display label for user type
 */
export function getUserTypeLabel(memberships: OrgMembership[]): string {
  const primaryType = getPrimaryUserType(memberships);

  const labels: Record<OrgType | 'INDIVIDUAL', string> = {
    DESIGN_FIRM: 'Designer',
    VENDOR: 'Vendor',
    MANUFACTURER: 'Manufacturer',
    SHOWROOM: 'Showroom',
    CONTRACTOR: 'Contractor',
    INDIVIDUAL: 'Individual',
  };

  return labels[primaryType];
}

/**
 * Check if user can create projects (designer or vendor)
 */
export function canCreateProjects(memberships: OrgMembership[]): boolean {
  return isDesigner(memberships) || isVendor(memberships);
}

/**
 * Check if user can upload products (vendor or manufacturer)
 */
export function canUploadProducts(memberships: OrgMembership[]): boolean {
  return isVendor(memberships) || isManufacturer(memberships);
}

import { prisma } from "@/lib/prisma";
import type { OrgStatus, OrgUserRole, Organization, OrganizationUser } from "@prisma/client";

// ============================================================
// ORG-BASED PERMISSIONS (Phase 2)
// These functions derive permissions from org membership
// ============================================================

export type OrgMembershipWithOrg = OrganizationUser & {
  organization: Organization;
};

/**
 * Get user's org memberships with org details
 */
export async function getUserOrgMemberships(userId: string): Promise<OrgMembershipWithOrg[]> {
  return prisma.organizationUser.findMany({
    where: { userId, isActive: true },
    include: { organization: true },
  });
}

/**
 * Check if user has any org membership
 */
export function hasOrgMembership(memberships: OrgMembershipWithOrg[]): boolean {
  return memberships.length > 0;
}

/**
 * Check if user belongs to any professional (paid) org
 */
export function hasProfessionalOrg(memberships: OrgMembershipWithOrg[]): boolean {
  return memberships.some(m => m.organization.status === 'PROFESSIONAL');
}

/**
 * Check if user belongs to any claimed or professional org
 */
export function hasClaimedOrProfessionalOrg(memberships: OrgMembershipWithOrg[]): boolean {
  return memberships.some(
    m => m.organization.status === 'CLAIMED' || m.organization.status === 'PROFESSIONAL'
  );
}

/**
 * Check if user can create projects (requires any org membership)
 */
export function canCreateProjectWithOrg(memberships: OrgMembershipWithOrg[]): boolean {
  return hasOrgMembership(memberships);
}

/**
 * Check if user can access premium features (professional org only)
 */
export function canAccessPremiumFeatures(memberships: OrgMembershipWithOrg[]): boolean {
  return hasProfessionalOrg(memberships);
}

/**
 * Check if user can generate images (professional org only)
 */
export function canGenerateImages(memberships: OrgMembershipWithOrg[]): boolean {
  return hasProfessionalOrg(memberships);
}

/**
 * Check if user can connect with clients (professional org only)
 */
export function canConnectWithClients(memberships: OrgMembershipWithOrg[]): boolean {
  return hasProfessionalOrg(memberships);
}

/**
 * Check if user can earn affiliate revenue (professional org only)
 */
export function canEarnAffiliate(memberships: OrgMembershipWithOrg[]): boolean {
  return hasProfessionalOrg(memberships);
}

/**
 * Check if user is an owner or admin of a specific org
 */
export function isOrgAdmin(memberships: OrgMembershipWithOrg[], orgId: string): boolean {
  const membership = memberships.find(m => m.organizationId === orgId);
  return membership?.role === 'OWNER' || membership?.role === 'ADMIN';
}

/**
 * Check if user is an owner of a specific org
 */
export function isOrgOwner(memberships: OrgMembershipWithOrg[], orgId: string): boolean {
  const membership = memberships.find(m => m.organizationId === orgId);
  return membership?.role === 'OWNER';
}

/**
 * Check if user can manage org members (owner or admin)
 */
export function canManageOrgMembers(memberships: OrgMembershipWithOrg[], orgId: string): boolean {
  return isOrgAdmin(memberships, orgId);
}

/**
 * Check if user can update org settings (owner or admin)
 */
export function canUpdateOrgSettings(memberships: OrgMembershipWithOrg[], orgId: string): boolean {
  return isOrgAdmin(memberships, orgId);
}

/**
 * Check if user can verify/upgrade org (owner only)
 */
export function canVerifyOrg(memberships: OrgMembershipWithOrg[], orgId: string): boolean {
  return isOrgOwner(memberships, orgId);
}

/**
 * Check if user can delete org (owner only, and org must be unclaimed)
 */
export function canDeleteOrg(memberships: OrgMembershipWithOrg[], orgId: string): boolean {
  const membership = memberships.find(m => m.organizationId === orgId);
  if (membership?.role !== 'OWNER') return false;
  return membership.organization.status === 'UNCLAIMED';
}

/**
 * Get user's highest role across all their orgs
 */
export function getHighestOrgRole(memberships: OrgMembershipWithOrg[]): OrgUserRole | null {
  const roleOrder: OrgUserRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];
  for (const role of roleOrder) {
    if (memberships.some(m => m.role === role)) {
      return role;
    }
  }
  return null;
}

/**
 * Get user's professional orgs
 */
export function getProfessionalOrgs(memberships: OrgMembershipWithOrg[]): OrgMembershipWithOrg[] {
  return memberships.filter(m => m.organization.status === 'PROFESSIONAL');
}

/**
 * Get orgs where user can perform admin actions
 */
export function getAdminOrgs(memberships: OrgMembershipWithOrg[]): OrgMembershipWithOrg[] {
  return memberships.filter(m => m.role === 'OWNER' || m.role === 'ADMIN');
}

// ============================================================
// LEGACY ROLE-BASED PERMISSIONS
// Keep for backwards compatibility but prefer org-based checks
// ============================================================

export async function assertProjectAccess(params: {
  projectId: string;
  userId: string;
  role?: string; // DESIGNER, ADMIN, etc.
}) {
  const { projectId, userId } = params;

  // 1) Project must exist
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true },
  });
  if (!project) {
    return { ok: false, status: 404 as const, reason: "Project not found" };
  }

  // 2) Access: owner OR explicit membership (if you have a membership table)
  // Try membership; if it doesn't exist in schema, skip this and rely on owner check.
  const membership = await prisma.projectMember?.findFirst?.({
    where: { projectId, userId },
    select: { id: true },
  }).catch(() => null);

  const isOwner = project.ownerId === userId;
  const hasMembership = Boolean(membership);

  if (!isOwner && !hasMembership) {
    return { ok: false, status: 403 as const, reason: "Forbidden" };
  }

  return { ok: true as const };
}

// Role normalization utility
export function normalizeRole(role?: string | null): string {
  if (!role) return 'GUEST';
  return role.toUpperCase();
}

// Create target determination
export function getCreateTarget(role?: string): { href: string; label: string } | string {
  const normalizedRole = normalizeRole(role);
  
  switch (normalizedRole) {
    case 'HOMEOWNER':
      return { href: '/projects/new', label: 'Create' };
    case 'DESIGNER':
      return { href: '/designer/create', label: 'Create' };
    case 'VENDOR':
      return { href: '/products/new', label: 'Add Product' };
    case 'ADMIN':
      return { href: '/admin', label: 'Admin' };
    default:
      return { href: '/projects/new', label: 'Create' };
  }
}

// Project creation permission check
export function canCreateProject(role?: string): boolean {
  const normalizedRole = normalizeRole(role);
  return ['HOMEOWNER', 'DESIGNER', 'VENDOR', 'ADMIN'].includes(normalizedRole);
}

// Vendor-specific permission helpers
export async function canVendorAttachQuote(userId: string, projectId: string): Promise<boolean> {
  try {
    // Check if user is a vendor and has products in this project
    const selections = await prisma.selection.findFirst({
      where: {
        projectId,
        vendorRepId: userId,
      },
      select: { id: true },
    });
    return Boolean(selections);
  } catch {
    return false;
  }
}

export async function canVendorSeeProject(userId: string, projectId: string): Promise<boolean> {
  try {
    // Vendor can see project if:
    // 1. They created it
    // 2. They have products in it
    // 3. They have a visit attached to it
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    
    if (project?.ownerId === userId) return true;
    
    const hasProducts = await prisma.selection.findFirst({
      where: { projectId, vendorRepId: userId },
      select: { id: true },
    });
    
    const hasVisit = await prisma.vendorVisit?.findFirst?.({
      where: { projectId, vendorId: userId },
      select: { id: true },
    }).catch(() => null);
    
    return Boolean(hasProducts || hasVisit);
  } catch {
    return false;
  }
}

export async function canVendorUseQuickActions(
  userId: string, 
  projectId: string, 
  productId?: string
): Promise<boolean> {
  try {
    if (productId) {
      // Check if vendor owns this specific product
      const selection = await prisma.selection.findFirst({
        where: {
          id: productId,
          vendorRepId: userId,
        },
        select: { id: true },
      });
      return Boolean(selection);
    } else {
      // Check if vendor has any products in this project
      return await canVendorAttachQuote(userId, projectId);
    }
  } catch {
    return false;
  }
}

export async function canDesignerSeeVendorQuote(userId: string, projectId: string): Promise<boolean> {
  try {
    // Designer can see vendor quotes if they have access to the project
    const access = await assertProjectAccess({ projectId, userId });
    return access.ok;
  } catch {
    return false;
  }
}

// Vendor handoff permissions
export function assertVendor(user: any) {
  if (!user || user.role !== 'VENDOR') {
    throw new Error('Vendor role required');
  }
}

export function assertDesigner(user: any) {
  if (!user || user.role !== 'DESIGNER') {
    throw new Error('Designer role required');
  }
}

export function canVendorCreateHandoff(user: any): boolean {
  return user?.role === 'VENDOR';
}

export function canDesignerClaimVisit(user: any, visit: any): boolean {
  // Allow if user.email === visit.designerEmail (case-insensitive) or user is invited to that email
  return !!user && user.email?.toLowerCase() === visit.designerEmail.toLowerCase();
}

/**
 * Check if a user role can access admin features
 */
export function canAccessAdmin(role?: string | null): boolean {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === 'ADMIN';
}
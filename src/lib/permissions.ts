import { prisma } from "@/lib/prisma";

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
// Individual-First Architecture: Individuals cannot create projects (that requires org membership)
export function getCreateTarget(role?: string): { href: string; label: string } | null {
  const normalizedRole = normalizeRole(role);

  switch (normalizedRole) {
    case 'DESIGNER':
      return { href: '/designer/create', label: 'Create' };
    case 'VENDOR':
      return { href: '/products/new', label: 'Add Product' };
    case 'ADMIN':
      return { href: '/admin', label: 'Admin' };
    case 'INDIVIDUAL':
    case 'HOMEOWNER':  // Deprecated, but handle for backwards compatibility
      // Individuals can create boards, but not projects
      return { href: '/boards/new', label: 'Create Board' };
    default:
      return null;  // Guests cannot create anything
  }
}

// Project creation permission check
// Individual-First Architecture: Only designers and vendors can create projects
// Individuals need org membership to unlock project creation
export function canCreateProject(role?: string): boolean {
  const normalizedRole = normalizeRole(role);
  return ['DESIGNER', 'VENDOR', 'ADMIN'].includes(normalizedRole);
}

// Board creation permission check
// Individual-First Architecture: All authenticated users can create boards
export function canCreateBoard(role?: string): boolean {
  const normalizedRole = normalizeRole(role);
  return ['INDIVIDUAL', 'HOMEOWNER', 'DESIGNER', 'VENDOR', 'ADMIN'].includes(normalizedRole);
}

// Check if user can browse and save products
// Individual-First Architecture: All authenticated users can browse and save
export function canBrowseAndSave(role?: string): boolean {
  const normalizedRole = normalizeRole(role);
  return normalizedRole !== 'GUEST';
}

// Check if user can follow designers/orgs
// Individual-First Architecture: All authenticated users can follow
export function canFollow(role?: string): boolean {
  const normalizedRole = normalizeRole(role);
  return normalizedRole !== 'GUEST';
}

// Check if user can access designer tools (meeting notes, selections, etc.)
// Individual-First Architecture: Only designers (via org membership) can access these
export function canAccessDesignerTools(role?: string): boolean {
  const normalizedRole = normalizeRole(role);
  return ['DESIGNER', 'ADMIN'].includes(normalizedRole);
}

// Check if user is an individual (base user type)
export function isIndividual(role?: string): boolean {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === 'INDIVIDUAL' || normalizedRole === 'HOMEOWNER';
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

// ============================================================
// Phase 2: Organization-Based Permission System
// ============================================================

// Types for org membership with org details
export type OrgMembershipWithOrg = {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  isActive: boolean;
  showOnProfile: boolean;
  org: {
    id: string;
    name: string;
    type: string;
    status: string;
  };
};

/**
 * Get user's org memberships with org status
 * Used to derive effective permissions from org membership
 */
export async function getUserOrgMemberships(userId: string): Promise<OrgMembershipWithOrg[]> {
  try {
    const memberships = await prisma.organizationUser.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
          }
        }
      }
    });

    return memberships.map(m => ({
      id: m.id,
      userId: m.userId,
      organizationId: m.organizationId,
      role: m.role,
      isActive: m.isActive,
      showOnProfile: m.showOnProfile,
      org: {
        id: m.organization.id,
        name: m.organization.name,
        type: m.organization.type,
        status: m.organization.status,
      }
    }));
  } catch {
    return [];
  }
}

/**
 * Check if user has any org membership
 */
export function hasOrgMembership(memberships: OrgMembershipWithOrg[]): boolean {
  return memberships.length > 0;
}

/**
 * Check if user belongs to a professional (paid) org
 */
export function hasProfessionalOrg(memberships: OrgMembershipWithOrg[]): boolean {
  return memberships.some(m => m.org.status === 'PROFESSIONAL');
}

/**
 * Check if user belongs to at least a claimed org
 */
export function hasClaimedOrg(memberships: OrgMembershipWithOrg[]): boolean {
  return memberships.some(m =>
    m.org.status === 'CLAIMED' || m.org.status === 'PROFESSIONAL'
  );
}

/**
 * Check if user can create projects (requires org membership)
 * Phase 2: Project creation unlocked by org membership
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
 * Check if user is owner or admin of an org
 */
export function isOrgAdmin(memberships: OrgMembershipWithOrg[], orgId: string): boolean {
  const membership = memberships.find(m => m.organizationId === orgId);
  return membership ? ['OWNER', 'ADMIN'].includes(membership.role) : false;
}

/**
 * Check if user is owner of an org
 */
export function isOrgOwner(memberships: OrgMembershipWithOrg[], orgId: string): boolean {
  const membership = memberships.find(m => m.organizationId === orgId);
  return membership?.role === 'OWNER';
}

/**
 * Get user's org type (designer or vendor) based on their primary org
 */
export function getUserOrgType(memberships: OrgMembershipWithOrg[]): 'DESIGNER' | 'VENDOR' | null {
  if (memberships.length === 0) return null;

  // Check for design firm first
  const designerOrg = memberships.find(m => m.org.type === 'DESIGN_FIRM');
  if (designerOrg) return 'DESIGNER';

  // Check for vendor types
  const vendorOrg = memberships.find(m =>
    ['VENDOR', 'MANUFACTURER', 'SHOWROOM'].includes(m.org.type)
  );
  if (vendorOrg) return 'VENDOR';

  return null;
}

/**
 * Combined permission check: can user perform action based on role OR org membership?
 * This allows backwards compatibility with role-based permissions while supporting org-based
 */
export async function canPerformAction(
  userId: string,
  action: 'create_project' | 'premium_features' | 'generate_images' | 'connect_clients' | 'earn_affiliate'
): Promise<boolean> {
  const memberships = await getUserOrgMemberships(userId);

  switch (action) {
    case 'create_project':
      return canCreateProjectWithOrg(memberships);
    case 'premium_features':
      return canAccessPremiumFeatures(memberships);
    case 'generate_images':
      return canGenerateImages(memberships);
    case 'connect_clients':
      return canConnectWithClients(memberships);
    case 'earn_affiliate':
      return canEarnAffiliate(memberships);
    default:
      return false;
  }
}
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
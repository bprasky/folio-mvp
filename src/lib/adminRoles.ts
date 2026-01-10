/**
 * Admin Role Hierarchy System
 *
 * Hierarchy (highest to lowest):
 * - SUPER_ADMIN: Full access including managing admin roles, database, billing, security
 * - ADMIN: curator + support + moderate users, manage site settings
 * - SUPPORT: read-only access to user data for troubleshooting
 * - CURATOR: content management only (feature projects, assign badges, editorial picks)
 *
 * Only SUPER_ADMIN can assign or change admin roles for other users.
 */

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'CURATOR';

// Admin role hierarchy levels (higher number = more permissions)
export const ADMIN_ROLE_LEVELS: Record<AdminRole, number> = {
  CURATOR: 1,
  SUPPORT: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

// All admin roles in order of hierarchy
export const ADMIN_ROLES: AdminRole[] = ['CURATOR', 'SUPPORT', 'ADMIN', 'SUPER_ADMIN'];

/**
 * Check if a user has any admin role
 */
export function hasAdminRole(adminRole?: string | null): boolean {
  if (!adminRole) return false;
  return ADMIN_ROLES.includes(adminRole as AdminRole);
}

/**
 * Get the numeric level of an admin role
 */
export function getAdminRoleLevel(adminRole?: string | null): number {
  if (!adminRole || !hasAdminRole(adminRole)) return 0;
  return ADMIN_ROLE_LEVELS[adminRole as AdminRole];
}

/**
 * Check if a user has at least the specified admin role level
 * SUPER_ADMIN > ADMIN > SUPPORT > CURATOR
 */
export function hasMinimumAdminRole(
  userAdminRole: string | null | undefined,
  requiredRole: AdminRole
): boolean {
  if (!userAdminRole) return false;
  const userLevel = getAdminRoleLevel(userAdminRole);
  const requiredLevel = ADMIN_ROLE_LEVELS[requiredRole];
  return userLevel >= requiredLevel;
}

/**
 * Check if a user can manage another user's admin role
 * Only SUPER_ADMIN can assign or modify admin roles
 */
export function canManageAdminRoles(adminRole?: string | null): boolean {
  return adminRole === 'SUPER_ADMIN';
}

/**
 * Check if a user can access the admin panel (any admin role)
 */
export function canAccessAdminPanel(adminRole?: string | null): boolean {
  return hasAdminRole(adminRole);
}

// Permission checks for specific features
export const AdminPermissions = {
  // Content management (CURATOR and above)
  canFeatureProjects: (role?: string | null) => hasMinimumAdminRole(role, 'CURATOR'),
  canAssignBadges: (role?: string | null) => hasMinimumAdminRole(role, 'CURATOR'),
  canManageEditorialPicks: (role?: string | null) => hasMinimumAdminRole(role, 'CURATOR'),
  canManageEditorialContent: (role?: string | null) => hasMinimumAdminRole(role, 'CURATOR'),

  // Support features (SUPPORT and above)
  canViewUserData: (role?: string | null) => hasMinimumAdminRole(role, 'SUPPORT'),
  canSearchUsers: (role?: string | null) => hasMinimumAdminRole(role, 'SUPPORT'),
  canViewUserActivity: (role?: string | null) => hasMinimumAdminRole(role, 'SUPPORT'),
  canImpersonateUsers: (role?: string | null) => hasMinimumAdminRole(role, 'ADMIN'), // Admin+ only

  // Admin features (ADMIN and above)
  canModerateUsers: (role?: string | null) => hasMinimumAdminRole(role, 'ADMIN'),
  canApproveAccounts: (role?: string | null) => hasMinimumAdminRole(role, 'ADMIN'),
  canManageSiteSettings: (role?: string | null) => hasMinimumAdminRole(role, 'ADMIN'),
  canManageEvents: (role?: string | null) => hasMinimumAdminRole(role, 'ADMIN'),
  canManageFestivals: (role?: string | null) => hasMinimumAdminRole(role, 'ADMIN'),

  // Super admin features (SUPER_ADMIN only)
  canManageAdminRoles: (role?: string | null) => role === 'SUPER_ADMIN',
  canAccessDatabase: (role?: string | null) => role === 'SUPER_ADMIN',
  canManageBilling: (role?: string | null) => role === 'SUPER_ADMIN',
  canManageSecuritySettings: (role?: string | null) => role === 'SUPER_ADMIN',
  canDeleteUsers: (role?: string | null) => role === 'SUPER_ADMIN',
};

/**
 * Get a human-readable label for an admin role
 */
export function getAdminRoleLabel(role?: string | null): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'ADMIN':
      return 'Admin';
    case 'SUPPORT':
      return 'Support';
    case 'CURATOR':
      return 'Curator';
    default:
      return 'None';
  }
}

/**
 * Get the roles that a given admin role can assign to others
 * Only SUPER_ADMIN can assign roles, and they can assign any role except SUPER_ADMIN
 * (to prevent accidental lockout)
 */
export function getAssignableRoles(adminRole?: string | null): AdminRole[] {
  if (adminRole !== 'SUPER_ADMIN') return [];
  // SUPER_ADMIN can assign all roles including SUPER_ADMIN
  return [...ADMIN_ROLES];
}

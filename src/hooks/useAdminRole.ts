import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import {
  AdminRole,
  hasAdminRole,
  hasMinimumAdminRole,
  canManageAdminRoles,
  canAccessAdminPanel,
  AdminPermissions,
  getAdminRoleLabel,
  getAdminRoleLevel,
} from '@/lib/adminRoles';

interface UseAdminRoleReturn {
  /** The user's admin role (null if not an admin) */
  adminRole: AdminRole | null;
  /** Whether the session is still loading */
  loading: boolean;
  /** Whether the user has any admin role */
  isAdmin: boolean;
  /** Check if user has at least the specified admin role level */
  hasMinRole: (requiredRole: AdminRole) => boolean;
  /** Whether the user can manage other users' admin roles (SUPER_ADMIN only) */
  canManageRoles: boolean;
  /** Whether the user can access the admin panel */
  canAccessPanel: boolean;
  /** Human-readable label for the admin role */
  roleLabel: string;
  /** Permission checks for specific features */
  permissions: {
    // Content management (CURATOR+)
    canFeatureProjects: boolean;
    canAssignBadges: boolean;
    canManageEditorialPicks: boolean;
    canManageEditorialContent: boolean;
    // Support features (SUPPORT+)
    canViewUserData: boolean;
    canSearchUsers: boolean;
    canViewUserActivity: boolean;
    canImpersonateUsers: boolean;
    // Admin features (ADMIN+)
    canModerateUsers: boolean;
    canApproveAccounts: boolean;
    canManageSiteSettings: boolean;
    canManageEvents: boolean;
    canManageFestivals: boolean;
    // Super admin features (SUPER_ADMIN only)
    canManageAdminRoles: boolean;
    canAccessDatabase: boolean;
    canManageBilling: boolean;
    canManageSecuritySettings: boolean;
    canDeleteUsers: boolean;
  };
}

/**
 * Hook to access the current user's admin role and permissions
 *
 * @example
 * ```tsx
 * const { isAdmin, permissions, hasMinRole } = useAdminRole();
 *
 * if (!isAdmin) return <AccessDenied />;
 *
 * // Check specific permission
 * if (permissions.canManageAdminRoles) {
 *   // Show admin role management UI
 * }
 *
 * // Check minimum role level
 * if (hasMinRole('ADMIN')) {
 *   // Show admin-only features
 * }
 * ```
 */
export function useAdminRole(): UseAdminRoleReturn {
  const { data: session, status } = useSession();
  const loading = status === 'loading';

  // Get adminRole from session (will be added to session in NextAuth config)
  const adminRole = (session?.user as any)?.adminRole as AdminRole | null ?? null;

  // Memoize all derived values
  return useMemo(() => {
    const isAdmin = hasAdminRole(adminRole);
    const canManageRoles = canManageAdminRoles(adminRole);
    const canAccessPanel = canAccessAdminPanel(adminRole);
    const roleLabel = getAdminRoleLabel(adminRole);

    const hasMinRole = (requiredRole: AdminRole) =>
      hasMinimumAdminRole(adminRole, requiredRole);

    const permissions = {
      // Content management (CURATOR+)
      canFeatureProjects: AdminPermissions.canFeatureProjects(adminRole),
      canAssignBadges: AdminPermissions.canAssignBadges(adminRole),
      canManageEditorialPicks: AdminPermissions.canManageEditorialPicks(adminRole),
      canManageEditorialContent: AdminPermissions.canManageEditorialContent(adminRole),
      // Support features (SUPPORT+)
      canViewUserData: AdminPermissions.canViewUserData(adminRole),
      canSearchUsers: AdminPermissions.canSearchUsers(adminRole),
      canViewUserActivity: AdminPermissions.canViewUserActivity(adminRole),
      canImpersonateUsers: AdminPermissions.canImpersonateUsers(adminRole),
      // Admin features (ADMIN+)
      canModerateUsers: AdminPermissions.canModerateUsers(adminRole),
      canApproveAccounts: AdminPermissions.canApproveAccounts(adminRole),
      canManageSiteSettings: AdminPermissions.canManageSiteSettings(adminRole),
      canManageEvents: AdminPermissions.canManageEvents(adminRole),
      canManageFestivals: AdminPermissions.canManageFestivals(adminRole),
      // Super admin features (SUPER_ADMIN only)
      canManageAdminRoles: AdminPermissions.canManageAdminRoles(adminRole),
      canAccessDatabase: AdminPermissions.canAccessDatabase(adminRole),
      canManageBilling: AdminPermissions.canManageBilling(adminRole),
      canManageSecuritySettings: AdminPermissions.canManageSecuritySettings(adminRole),
      canDeleteUsers: AdminPermissions.canDeleteUsers(adminRole),
    };

    return {
      adminRole,
      loading,
      isAdmin,
      hasMinRole,
      canManageRoles,
      canAccessPanel,
      roleLabel,
      permissions,
    };
  }, [adminRole, loading]);
}

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { hasAdminRole, hasMinimumAdminRole, AdminRole } from './adminRoles';

/**
 * Require any admin role to access a resource
 * @throws Error with status 401 if not authenticated
 * @throws Error with status 403 if not an admin
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const adminRole = (session.user as any).adminRole;
  if (!hasAdminRole(adminRole)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }

  return session.user;
}

/**
 * Require a specific minimum admin role level
 * @param requiredRole The minimum admin role required (e.g., 'ADMIN', 'SUPPORT', 'CURATOR')
 * @throws Error with status 401 if not authenticated
 * @throws Error with status 403 if user doesn't have required role level
 */
export async function requireAdminRole(requiredRole: AdminRole) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const adminRole = (session.user as any).adminRole;
  if (!hasMinimumAdminRole(adminRole, requiredRole)) {
    throw Object.assign(new Error('Forbidden: Insufficient admin privileges'), { status: 403 });
  }

  return session.user;
}

/**
 * Require SUPER_ADMIN role
 * @throws Error with status 401 if not authenticated
 * @throws Error with status 403 if not a super admin
 */
export async function requireSuperAdmin() {
  return requireAdminRole('SUPER_ADMIN');
}

/**
 * Get the current user's admin role (or null if not an admin)
 */
export async function getServerAdminRole(): Promise<AdminRole | null> {
  const session = await getServerSession(authOptions);
  const adminRole = (session?.user as any)?.adminRole;
  return hasAdminRole(adminRole) ? (adminRole as AdminRole) : null;
}



















/**
 * Server-side utility to fetch user's org memberships
 */

import { prisma } from '@/lib/prisma';

export type UserMembership = {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  isActive: boolean;
  joinedAt: Date;
  organization: {
    id: string;
    name: string;
    type: string;
    description: string | null;
    website: string | null;
    logo: string | null;
  };
};

/**
 * Get all org memberships for a user
 */
export async function getUserMemberships(
  userId: string
): Promise<UserMembership[]> {
  const memberships = await prisma.organizationUser.findMany({
    where: {
      userId,
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
          website: true,
          logo: true,
        },
      },
    },
  });

  return memberships as UserMembership[];
}

/**
 * Get active org memberships for a user
 */
export async function getActiveMemberships(
  userId: string
): Promise<UserMembership[]> {
  const memberships = await getUserMemberships(userId);
  return memberships.filter((m) => m.isActive);
}

/**
 * Check if user is a member of a specific org
 */
export async function isMemberOfOrg(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const membership = await prisma.organizationUser.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  return membership?.isActive ?? false;
}

/**
 * Get user's role in a specific org
 */
export async function getUserOrgRole(
  userId: string,
  organizationId: string
): Promise<string | null> {
  const membership = await prisma.organizationUser.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  return membership?.isActive ? membership.role : null;
}

/**
 * Check if user has admin/owner access in a specific org
 */
export async function hasOrgAccess(
  userId: string,
  organizationId: string,
  requiredRoles: string[] = ['ADMIN', 'OWNER']
): Promise<boolean> {
  const role = await getUserOrgRole(userId, organizationId);
  return role ? requiredRoles.includes(role) : false;
}

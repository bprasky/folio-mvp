import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { canCreate, getUpgradePrompt, type ContentType, type VendorTier } from './createPermissions';

export interface CreateGuardResult {
  allowed: boolean;
  user?: {
    id: string;
    role: string;
    vendorTier?: VendorTier;
  };
  error?: NextResponse;
}

/**
 * Server-side guard to check if the current user can create a specific content type.
 * Returns the user info if allowed, or an error response if not.
 *
 * @param contentType - The type of content to create
 * @returns CreateGuardResult with allowed status and user info or error response
 */
export async function assertCanCreate(contentType: ContentType): Promise<CreateGuardResult> {
  const session = await getServerSession(authOptions);

  // Check if user is authenticated
  if (!session?.user?.id) {
    return {
      allowed: false,
      error: NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to create content' },
        { status: 401 }
      ),
    };
  }

  const role = session.user.role || 'GUEST';
  const vendorTier = (session.user as any)?.vendorTier as VendorTier | undefined;

  // Check if user has permission to create this content type
  if (!canCreate(role, contentType, vendorTier)) {
    // Check if this is a tier-gated feature for vendors
    const upgradePrompt = getUpgradePrompt(contentType);

    if (upgradePrompt && role.toUpperCase() === 'VENDOR') {
      return {
        allowed: false,
        error: NextResponse.json(
          {
            error: 'Upgrade Required',
            message: upgradePrompt,
            upgradeUrl: '/vendor/pricing',
          },
          { status: 403 }
        ),
      };
    }

    return {
      allowed: false,
      error: NextResponse.json(
        {
          error: 'Forbidden',
          message: `You do not have permission to create ${contentType}`,
        },
        { status: 403 }
      ),
    };
  }

  return {
    allowed: true,
    user: {
      id: session.user.id,
      role,
      vendorTier,
    },
  };
}

/**
 * Shorthand for assertCanCreate that throws if not allowed.
 * For use in server components and route handlers.
 *
 * @param contentType - The type of content to create
 * @returns User info if allowed
 * @throws Returns error response if not allowed
 */
export async function requireCreatePermission(contentType: ContentType) {
  const result = await assertCanCreate(contentType);

  if (!result.allowed || !result.user) {
    throw result.error;
  }

  return result.user;
}

/**
 * Client-safe check for create permissions.
 * Does not expose user info, just returns whether creation is allowed.
 *
 * @param contentType - The type of content to create
 * @returns Promise<boolean> indicating if creation is allowed
 */
export async function checkCanCreate(contentType: ContentType): Promise<boolean> {
  const result = await assertCanCreate(contentType);
  return result.allowed;
}

/**
 * Role-based permission check without session (for client-side use).
 * Use canCreate from createPermissions.ts for synchronous checks.
 */
export { canCreate, getCreatePermissions, getUpgradePrompt } from './createPermissions';

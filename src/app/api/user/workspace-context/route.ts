import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/user/workspace-context
 * Toggle the user's workspace context between individual and organization
 *
 * Request body:
 * { operatingAsOrgId: string | null }
 *
 * - null: Operating as individual
 * - orgId: Operating as that organization
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { operatingAsOrgId } = body;

    // Validate the operatingAsOrgId
    if (operatingAsOrgId !== null && typeof operatingAsOrgId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid operatingAsOrgId - must be string or null' },
        { status: 400 }
      );
    }

    // If setting to an org, validate user belongs to that org
    if (operatingAsOrgId) {
      // Use raw SQL to avoid isActive column issue
      const membership = await prisma.$queryRaw<any[]>`
        SELECT id FROM organization_users
        WHERE "userId" = ${session.user.id}
        AND "organizationId" = ${operatingAsOrgId}
        LIMIT 1
      `;

      if (!membership || membership.length === 0) {
        return NextResponse.json(
          { error: 'You do not belong to this organization' },
          { status: 403 }
        );
      }
    }

    // Update the user's workspace context using raw SQL (column may not exist)
    try {
      await prisma.$executeRaw`
        UPDATE users SET "operatingAsOrgId" = ${operatingAsOrgId}, "updatedAt" = NOW()
        WHERE id = ${session.user.id}
      `;
    } catch (updateErr: any) {
      // Column doesn't exist yet - that's okay, just log it
      console.log('[POST workspace-context] operatingAsOrgId column not available:', updateErr.message);
    }

    // Get org details if switching to an org
    let operatingAsOrg = null;
    if (operatingAsOrgId) {
      const orgs = await prisma.$queryRaw<any[]>`
        SELECT id, name, type FROM organizations WHERE id = ${operatingAsOrgId}
      `;
      if (orgs && orgs.length > 0) {
        operatingAsOrg = { ...orgs[0], logo: null };
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: session.user.id,
        operatingAsOrgId,
        operatingAsOrg,
      },
    });
  } catch (error) {
    console.error('Error updating workspace context:', error);
    return NextResponse.json(
      { error: 'Failed to update workspace context' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/workspace-context
 * Get the user's current workspace context
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get basic user info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        profileImage: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user's organizations via raw SQL to avoid missing column issues
    const memberships = await prisma.$queryRaw<any[]>`
      SELECT
        ou.role as "userRole",
        o.id,
        o.name,
        o.type
      FROM organization_users ou
      JOIN organizations o ON ou."organizationId" = o.id
      WHERE ou."userId" = ${session.user.id}
    `;

    const organizations = memberships.map((m: any) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      logo: null,
      userRole: m.userRole,
    }));

    // Try to get operatingAsOrgId (may not exist in prod)
    let operatingAsOrgId = null;
    let operatingAsOrg = null;
    try {
      const workspace = await prisma.$queryRaw<any[]>`
        SELECT "operatingAsOrgId" FROM users WHERE id = ${session.user.id}
      `;
      if (workspace?.[0]?.operatingAsOrgId) {
        operatingAsOrgId = workspace[0].operatingAsOrgId;
        // Find the org details
        operatingAsOrg = organizations.find((o: any) => o.id === operatingAsOrgId) || null;
      }
    } catch (e) {
      // Column doesn't exist yet
    }

    return NextResponse.json({
      operatingAsOrgId,
      operatingAsOrg,
      organizations,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    console.error('Error fetching workspace context:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workspace context' },
      { status: 500 }
    );
  }
}

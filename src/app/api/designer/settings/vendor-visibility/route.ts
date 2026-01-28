export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const UpdateVendorVisibilitySchema = z.object({
  enabled: z.boolean(),
});

/**
 * GET /api/designer/settings/vendor-visibility
 * Get current vendor visibility setting for the authenticated designer
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        vendorVisibility: true,
        vendorVisibilityEnabledAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      enabled: user.vendorVisibility,
      enabledAt: user.vendorVisibilityEnabledAt,
    });
  } catch (error: any) {
    console.error('[designer/settings/vendor-visibility] GET failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor visibility setting' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/designer/settings/vendor-visibility
 * Update vendor visibility setting for the authenticated designer
 *
 * When enabling (false -> true):
 * - Set vendorVisibility = true
 * - Set vendorVisibilityEnabledAt = now()
 *
 * When disabling (true -> false):
 * - Set vendorVisibility = false
 * - Keep vendorVisibilityEnabledAt for audit trail
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const input = UpdateVendorVisibilitySchema.parse(body);

    // Get current state to determine if we need to set enabledAt
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        vendorVisibility: true,
        vendorVisibilityEnabledAt: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build update data
    const updateData: {
      vendorVisibility: boolean;
      vendorVisibilityEnabledAt?: Date;
    } = {
      vendorVisibility: input.enabled,
    };

    // Only set enabledAt when transitioning from false to true
    if (input.enabled && !currentUser.vendorVisibility) {
      updateData.vendorVisibilityEnabledAt = new Date();
    }
    // When disabling, keep the enabledAt timestamp for audit trail

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        vendorVisibility: true,
        vendorVisibilityEnabledAt: true,
      },
    });

    console.log('[designer/settings/vendor-visibility] Updated:', {
      userId: session.user.id,
      enabled: input.enabled,
      previousState: currentUser.vendorVisibility,
    });

    return NextResponse.json({
      enabled: updatedUser.vendorVisibility,
      enabledAt: updatedUser.vendorVisibilityEnabledAt,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[designer/settings/vendor-visibility] PATCH failed:', error);
    return NextResponse.json(
      { error: 'Failed to update vendor visibility setting' },
      { status: 500 }
    );
  }
}

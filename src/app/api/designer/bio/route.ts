export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/designer/bio
 * Full bio state for the About tab (private, authenticated).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get or create bio record
    let bio = await prisma.designerBio.findUnique({
      where: { userId },
    });

    if (!bio) {
      bio = await prisma.designerBio.create({
        data: { userId, status: 'empty' },
      });
    }

    // Get user info for context
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, role: true, website: true, bio: true },
    });

    return NextResponse.json({
      bio,
      user: {
        name: user?.name,
        role: user?.role,
        website: user?.website,
        existingBio: user?.bio,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/designer/bio] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

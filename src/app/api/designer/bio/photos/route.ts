export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const RequestSchema = z.object({
  primaryPhotoUrl: z.string().url().optional(),
  secondaryPhotoUrl: z.string().url().optional(),
  teamPhotoUrl: z.string().url().optional(),
});

/**
 * POST /api/designer/bio/photos
 * Update profile photo URLs.
 * Expects URLs already uploaded to Supabase Storage (profile-media/ prefix).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.format() }, { status: 400 });
    }

    const userId = session.user.id;
    const updateData: Record<string, string> = {};

    if (parsed.data.primaryPhotoUrl) updateData.primaryPhotoUrl = parsed.data.primaryPhotoUrl;
    if (parsed.data.secondaryPhotoUrl) updateData.secondaryPhotoUrl = parsed.data.secondaryPhotoUrl;
    if (parsed.data.teamPhotoUrl) updateData.teamPhotoUrl = parsed.data.teamPhotoUrl;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No photos provided' }, { status: 400 });
    }

    await prisma.designerBio.upsert({
      where: { userId },
      create: { userId, ...updateData },
      update: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[POST /api/designer/bio/photos] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

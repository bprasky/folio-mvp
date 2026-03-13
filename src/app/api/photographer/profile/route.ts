export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  website: z.string().url().or(z.literal('')).optional(),
  instagram: z.string().max(100).optional(),
  photographyStyles: z.array(z.string().max(50)).max(10).optional(),
  travelRadius: z.string().max(200).optional(),
  bookingEmail: z.string().email().or(z.literal('')).optional(),
  bookingUrl: z.string().url().or(z.literal('')).optional(),
  profileImage: z.string().optional(),
});

/**
 * GET /api/photographer/profile
 * Returns current photographer's profile data
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
        id: true,
        name: true,
        bio: true,
        profileImage: true,
        location: true,
        website: true,
        instagram: true,
        photographyStyles: true,
        travelRadius: true,
        bookingEmail: true,
        bookingUrl: true,
        role: true,
        onboardingCompletedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ profile: user });
  } catch (error) {
    console.error('[photographer/profile GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/photographer/profile
 * Update photographer profile fields
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = UpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', issues: parsed.error.issues },
        { status: 422 }
      );
    }

    const data: any = {};
    const input = parsed.data;

    if (input.name !== undefined) data.name = input.name;
    if (input.bio !== undefined) data.bio = input.bio || null;
    if (input.location !== undefined) data.location = input.location || null;
    if (input.website !== undefined) data.website = input.website || null;
    if (input.instagram !== undefined) data.instagram = input.instagram || null;
    if (input.photographyStyles !== undefined) data.photographyStyles = input.photographyStyles;
    if (input.travelRadius !== undefined) data.travelRadius = input.travelRadius || null;
    if (input.bookingEmail !== undefined) data.bookingEmail = input.bookingEmail || null;
    if (input.bookingUrl !== undefined) data.bookingUrl = input.bookingUrl || null;
    if (input.profileImage !== undefined) data.profileImage = input.profileImage || null;

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: {
        id: true,
        name: true,
        bio: true,
        profileImage: true,
        location: true,
        website: true,
        instagram: true,
        photographyStyles: true,
        travelRadius: true,
        bookingEmail: true,
        bookingUrl: true,
      },
    });

    return NextResponse.json({ ok: true, profile: updated });
  } catch (error) {
    console.error('[photographer/profile PUT] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

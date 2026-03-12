export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

async function getUserId(req: Request) {
  const s = await getServerSession();
  if (s?.user?.id) return s.user.id;
  const t = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET }).catch(() => null);
  return (t?.sub as string) ?? null;
}

export async function GET(req: Request) {
  const id = await getUserId(req);
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        title: true,
        bio: true,
        location: true,
        website: true,
        instagram: true,
        linkedin: true,
        profileImage: true,
        role: true,
        organizationUsers: {
          where: { isActive: true },
          select: {
            id: true,
            role: true,
            showOnProfile: true,
            joinedAt: true,
            organization: {
              select: {
                id: true,
                name: true,
                type: true,
                status: true,
                logo: true,
              }
            }
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Transform org memberships for easier consumption
    const orgMemberships = user.organizationUsers.map(ou => ({
      id: ou.id,
      role: ou.role,
      showOnProfile: ou.showOnProfile,
      joinedAt: ou.joinedAt,
      org: ou.organization
    }));

    return NextResponse.json({
      ...user,
      organizationUsers: undefined,
      orgMemberships
    });
  } catch (error) {
    console.error('[GET /api/auth/me] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const id = await getUserId(req);
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const body = await req.json();
    const { name, title, bio, location, website, instagram, linkedin } = body;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name,
        title,
        bio,
        location,
        website,
        instagram,
        linkedin,
      },
      select: {
        id: true,
        name: true,
        email: true,
        title: true,
        bio: true,
        location: true,
        website: true,
        instagram: true,
        linkedin: true,
        profileImage: true,
        role: true,
      }
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('[PUT /api/auth/me] Error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
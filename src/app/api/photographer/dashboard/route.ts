export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/photographer/dashboard
 * Returns photographer dashboard data: credited projects, profile views, hire clicks
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch profile data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        profileImage: true,
        views: true,
        role: true,
        onboardingCompletedAt: true,
        photographyStyles: true,
        travelRadius: true,
        bookingEmail: true,
        bookingUrl: true,
        bio: true,
        location: true,
        website: true,
        instagram: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch credited projects using raw SQL for JSONB array search
    const creditedProjects = await prisma.$queryRaw<
      Array<{
        id: string;
        slug: string;
        publishedAt: Date | null;
        projectTitle: string;
        designerName: string | null;
        heroImageUrl: string | null;
      }>
    >`
      SELECT
        pp.id,
        pp.slug,
        pp."publishedAt",
        p.title as "projectTitle",
        u.name as "designerName",
        (
          SELECT pi.url FROM project_images pi
          WHERE pi."projectId" = p.id
          ORDER BY pi."createdAt" ASC
          LIMIT 1
        ) as "heroImageUrl"
      FROM project_posts pp
      JOIN projects p ON p.id = pp."projectId"
      LEFT JOIN users u ON u.id = p."designerId"
      WHERE pp.status = 'PUBLISHED'
      AND pp.credits @> ${JSON.stringify([{ role: "Photographer", userId }])}::jsonb
      ORDER BY pp."publishedAt" DESC
    `;

    // Profile completeness check
    const completenessFields = [
      user.name,
      user.bio,
      user.location,
      user.profileImage,
      user.photographyStyles.length > 0 ? 'yes' : null,
      user.bookingUrl || user.bookingEmail,
      user.website,
      user.instagram,
    ];
    const completedFields = completenessFields.filter(Boolean).length;
    const profileCompleteness = Math.round((completedFields / completenessFields.length) * 100);

    return NextResponse.json({
      profile: user,
      creditedProjects,
      profileCompleteness,
      stats: {
        profileViews: user.views || 0,
        creditedProjectCount: creditedProjects.length,
      },
    });
  } catch (error) {
    console.error('[photographer/dashboard GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } | Promise<{ userId: string }> }
) {
  const resolvedParams = params instanceof Promise ? await params : params;

  const user = await prisma.user.findUnique({
    where: { id: resolvedParams.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      profileImage: true,
      bio: true,
      title: true,
      location: true,
      website: true,
      instagram: true,
      linkedin: true,
      specialties: true,
      followers: true,
      following: true,
      createdAt: true,
      // Architect-specific fields
      architectLicenseNumber: true,
      architectLicensedStates: true,
      architectProjectScale: true,
      architectSpecializations: true,
      // Builder-specific fields
      builderProjectTypes: true,
      builderSquareFootageRange: true,
      builderSpecialtyTrades: true,
      builderYearsInBusiness: true,
      // Interview-generated content
      profileInterview: {
        select: {
          generatedBio: true,
          shortBio: true,
          pullQuotes: true,
          philosophyStatement: true,
          processDescription: true,
          status: true,
        },
      },
      // Stats - count public projects
      _count: {
        select: {
          designerProjects: { where: { isPublic: true } },
        },
      },
      // Organization for team
      organizationUsers: {
        where: { isActive: true },
        include: {
          organization: {
            include: {
              teamMembers: {
                orderBy: { displayOrder: 'asc' },
                include: {
                  linkedUser: {
                    select: {
                      id: true,
                      name: true,
                      profileImage: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Count featured/editorial appearances
  const featuredCount = await prisma.projectPost.count({
    where: {
      project: { designerId: resolvedParams.userId },
      status: 'PUBLISHED',
    },
  });

  // Get recognition count
  const recognitionCount = await prisma.recognition.count({
    where: {
      userId: resolvedParams.userId,
      publishedAt: { not: null },
    },
  });

  // Get media count
  const mediaCount = await prisma.media.count({
    where: {
      userId: resolvedParams.userId,
      publishedAt: { not: null },
    },
  });

  // Get collaboration count
  const collaborationCount = await prisma.collaboration.count({
    where: {
      userId: resolvedParams.userId,
      publishedAt: { not: null },
    },
  });

  // Extract team from first active organization
  const primaryOrg = user.organizationUsers[0]?.organization;
  const team = primaryOrg?.teamMembers || [];

  return NextResponse.json({
    ...user,
    organizationUsers: undefined,
    projectCount: user._count.designerProjects,
    featuredCount,
    recognitionCount,
    mediaCount,
    collaborationCount,
    team,
    organization: primaryOrg
      ? {
          id: primaryOrg.id,
          name: primaryOrg.name,
          type: primaryOrg.type,
          logo: primaryOrg.logo,
        }
      : null,
  });
}

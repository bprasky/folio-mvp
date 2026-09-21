// @idor-allow: public-read reason="Public About tab (bio, Q&As, details) for a designer profile, viewable anonymously"
// @idor-allow: IDOR003 reason="Public lookup by user id for public About tab"
// @idor-allow: IDOR004 reason="Read-only public profile about; no mutations in this route"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/profiles/[userId]/about
 * Public About tab data: bio + visible Q&As + photos + details.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // Get the published bio
    const bio = await prisma.designerBio.findUnique({
      where: { userId },
      select: {
        folioBio: true,
        primaryPhotoUrl: true,
        secondaryPhotoUrl: true,
        teamPhotoUrl: true,
        status: true,
        bioGeneratedAt: true,
      },
    });

    // Only return bio if published
    const publishedBio = bio?.status === 'published' ? bio : null;

    // Get visible Q&As (answered, not hidden)
    const qas = await prisma.profileQA.findMany({
      where: { userId, status: 'answered' },
      select: {
        id: true,
        question: true,
        answer: true,
        category: true,
        pinned: true,
        displayOrder: true,
        answeredAt: true,
      },
      orderBy: [
        { pinned: 'desc' },
        { displayOrder: 'asc' },
        { answeredAt: 'desc' },
      ],
    });

    // Get user details for the sidebar
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        bio: true,
        location: true,
        companyName: true,
        specialties: true,
        role: true,
        profileImage: true,
        // Architect-specific
        architectLicensedStates: true,
        architectSpecializations: true,
        // Builder-specific
        builderProjectTypes: true,
        builderYearsInBusiness: true,
        builderSpecialtyTrades: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      bio: publishedBio
        ? {
            folioBio: publishedBio.folioBio,
            primaryPhotoUrl: publishedBio.primaryPhotoUrl,
            secondaryPhotoUrl: publishedBio.secondaryPhotoUrl,
            teamPhotoUrl: publishedBio.teamPhotoUrl,
          }
        : user.bio ? { folioBio: user.bio, primaryPhotoUrl: null, secondaryPhotoUrl: null, teamPhotoUrl: null } : null,
      qas,
      details: {
        name: user.name,
        location: user.location,
        firmName: user.companyName,
        specialties: user.specialties,
        role: user.role,
        profileImage: user.profileImage,
        architectLicensedStates: user.architectLicensedStates,
        architectSpecializations: user.architectSpecializations,
        builderProjectTypes: user.builderProjectTypes,
        builderYearsInBusiness: user.builderYearsInBusiness,
        builderSpecialtyTrades: user.builderSpecialtyTrades,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/profiles/[userId]/about] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

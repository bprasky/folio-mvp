// @idor-allow: public-read reason="Public profile directory"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    
    // Individual-First Architecture: Accept both 'individual' and deprecated 'homeowner'
    if (!role || !['designer', 'vendor', 'individual', 'homeowner'].includes(role)) {
      return NextResponse.json(
        { error: 'Valid role parameter is required (designer, vendor, individual)' },
        { status: 400 }
      );
    }

    // Map role parameter to enum values
    // Note: 'homeowner' is deprecated, use 'individual' instead
    const roleMap: { [key: string]: 'DESIGNER' | 'VENDOR' | 'INDIVIDUAL' } = {
      'designer': 'DESIGNER',
      'vendor': 'VENDOR',
      'individual': 'INDIVIDUAL',
      'homeowner': 'INDIVIDUAL'  // Deprecated, maps to INDIVIDUAL
    };
    
    // Load profiles from database
    const profiles = await prisma.user.findMany({
      where: {
        role: roleMap[role]
      },
      select: {
        id: true,
        name: true,
        bio: true,
        profileImage: true,
        location: true,
        specialties: true,
        website: true,
        instagram: true,
        linkedin: true,
        companyName: true,
        budgetRange: true,
        desiredRooms: true,
        serviceLevel: true,
        projectStatus: true,
        followers: true,
        following: true,
        views: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            designerProjects: role === 'DESIGNER',
            products: role === 'VENDOR'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform profiles to match expected format
    const transformedProfiles = profiles.map(profile => {
      const base = {
        id: profile.id,
        name: profile.name,
        bio: profile.bio,
        profileImage: profile.profileImage,
        location: profile.location,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
      };

      if (role === 'DESIGNER') {
        return {
          ...base,
          specialties: profile.specialties,
          website: profile.website,
          instagram: profile.instagram,
          linkedin: profile.linkedin,
          metrics: {
            savedProducts: 0, // Could be calculated from folders
            events: 0,
            followers: profile.followers,
            projects: profile._count?.designerProjects || 0
          }
        };
      } else if (role === 'VENDOR') {
        return {
          ...base,
          companyName: profile.companyName,
          description: profile.bio,
          logo: profile.profileImage,
          metrics: {
            products: profile._count?.products || 0,
            events: 0,
            followers: profile.followers
          }
        };
      } else if (role === 'individual' || role === 'homeowner') {
        // Individual-First Architecture: INDIVIDUAL is the base user type
        return {
          ...base,
          budgetRange: profile.budgetRange,
          desiredRooms: profile.desiredRooms,
          serviceLevel: profile.serviceLevel,
          projectStatus: profile.projectStatus,
          memberSince: profile.createdAt?.toISOString().split('T')[0]
        };
      }

      return base;
    });
    
    return NextResponse.json(transformedProfiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profiles' },
      { status: 500 }
    );
  }
}

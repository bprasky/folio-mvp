import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    
    if (!role || !['designer', 'vendor', 'homeowner'].includes(role)) {
      return NextResponse.json(
        { error: 'Valid role parameter is required (designer, vendor, homeowner)' },
        { status: 400 }
      );
    }
    
    // Map role parameter to enum values
    const roleMap: { [key: string]: 'DESIGNER' | 'VENDOR' | 'HOMEOWNER' } = {
      'designer': 'DESIGNER',
      'vendor': 'VENDOR', 
      'homeowner': 'HOMEOWNER'
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
      } else if (role === 'HOMEOWNER') {
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

export async function POST(request: NextRequest) {
  try {
    const { role, ...profileData } = await request.json();
    
    if (!role || !['designer', 'vendor', 'homeowner'].includes(role)) {
      return NextResponse.json(
        { error: 'Valid role is required (designer, vendor, homeowner)' },
        { status: 400 }
      );
    }
    
    // Map role parameter to enum values
    const roleMap: { [key: string]: 'DESIGNER' | 'VENDOR' | 'HOMEOWNER' } = {
      'designer': 'DESIGNER',
      'vendor': 'VENDOR', 
      'homeowner': 'HOMEOWNER'
    };
    
    // Prepare base profile data
    let newProfileData: any = {
      role: roleMap[role],
      name: profileData.name || `New ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      bio: profileData.bio || `${role.charAt(0).toUpperCase() + role.slice(1)} profile`,
      profileImage: profileData.profileImage || null,
      location: profileData.location || null,
    };
    
    // Add role-specific data
    if (role === 'designer') {
      newProfileData = {
        ...newProfileData,
        bio: profileData.bio || 'Interior designer specializing in modern spaces',
        profileImage: profileData.profileImage || `https://randomuser.me/api/portraits/women/${Math.floor(Math.random() * 50)}.jpg`,
        specialties: profileData.specialties || ['Modern Design'],
        website: profileData.website || null,
        instagram: profileData.instagram || null,
        linkedin: profileData.linkedin || null,
        followers: Math.floor(Math.random() * 1000) + 100
      };
    } else if (role === 'vendor') {
      newProfileData = {
        ...newProfileData,
        companyName: profileData.companyName || profileData.name || 'New Company',
        bio: profileData.description || profileData.bio || 'Premium home decor and furniture',
        profileImage: profileData.logo || profileData.profileImage || `https://source.unsplash.com/random/200x200?company,logo`,
        followers: Math.floor(Math.random() * 500) + 50
      };
    } else if (role === 'homeowner') {
      newProfileData = {
        ...newProfileData,
        location: profileData.location || 'City, State',
        budgetRange: profileData.budgetRange || '$10k-$50k',
        desiredRooms: profileData.desiredRooms || ['Living Room'],
        serviceLevel: profileData.serviceLevel || 'Designer guidance',
        projectStatus: profileData.projectStatus || 'planning'
      };
    }
    
    // Create profile in database
    const newProfile = await prisma.user.create({
      data: newProfileData,
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
        createdAt: true,
        updatedAt: true
      }
    });
    
    return NextResponse.json(newProfile, { status: 201 });
  } catch (error) {
    console.error('Error creating profile:', error);
    return NextResponse.json(
      { error: 'Failed to create profile' },
      { status: 500 }
    );
  }
} 
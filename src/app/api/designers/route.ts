import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Load designers from database
    const designers = await prisma.user.findMany({
      where: {
        role: 'DESIGNER'
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
        followers: true,
        views: true,
        createdAt: true,
        _count: {
          select: {
            designerProjects: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Transform data to match expected format
    const formattedDesigners = designers.map(designer => ({
      id: designer.id,
      name: designer.name,
      bio: designer.bio,
      profileImage: designer.profileImage,
      location: designer.location,
      specialties: designer.specialties,
      website: designer.website,
      instagram: designer.instagram,
      linkedin: designer.linkedin,
      metrics: {
        followers: designer.followers,
        views: designer.views,
        projects: designer._count.designerProjects
      }
    }));

    return NextResponse.json(formattedDesigners);
  } catch (error) {
    console.error('Error fetching designers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch designers' },
      { status: 500 }
    );
  }
} 
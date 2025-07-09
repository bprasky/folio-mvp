import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    console.log('Fetching onboarding data for designer:', id);

    // Fetch designer with profile and projects
    const designer = await prisma.user.findUnique({
      where: { id },
      include: {
        designerProfile: true,
        designerProjects: {
          include: {
            images: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    console.log('Found designer:', designer ? 'yes' : 'no');
    if (designer) {
      console.log('Designer projects count:', designer.designerProjects.length);
      console.log('Designer profile:', designer.designerProfile ? 'exists' : 'null');
    }

    if (!designer) {
      return NextResponse.json(
        { error: 'Designer not found' },
        { status: 404 }
      );
    }

    if (designer.profileType !== 'designer') {
      return NextResponse.json(
        { error: 'User is not a designer' },
        { status: 400 }
      );
    }

    // Transform the data for the frontend
    const designerData = {
      id: designer.id,
      name: designer.name,
      email: designer.email,
      profileImage: designer.profileImage,
      website: designer.website,
      designerProfile: designer.designerProfile ? {
        about: designer.designerProfile.about,
        logo: designer.designerProfile.logo,
        team: designer.designerProfile.team ? JSON.parse(designer.designerProfile.team) : [],
        contactInfo: designer.designerProfile.contactInfo ? JSON.parse(designer.designerProfile.contactInfo) : {},
        specialties: designer.designerProfile.specialties
      } : null,
      projects: designer.designerProjects.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description,
        images: project.images.map(image => ({
          id: image.id,
          url: image.url
        }))
      }))
    };

    console.log('Returning designer data with projects:', designerData.projects.length);

    return NextResponse.json(designerData);

  } catch (error) {
    console.error('Error fetching designer onboarding data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch designer data' },
      { status: 500 }
    );
  }
} 
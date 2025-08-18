import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Vendor creates project and initiates handoff
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      description, 
      vendorOrgId, 
      designerOrgId, 
      designerEmail,
      vendorUserId,
      vendorRepId,
      vendorRepName,
      vendorRepEmail,
      vendorOrgName,
      vendorOrgDescription,
      initialRooms = []
    } = body;

    if (!name || !vendorOrgId || !vendorUserId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, vendorOrgId, vendorUserId' },
        { status: 400 }
      );
    }

    // Create the project in the database
    const project = await prisma.project.create({
      data: {
        name,
        description,
        vendorOrgId,
        designerOrgId,
        ownerId: vendorUserId,
        isHandoffReady: !!designerOrgId || !!designerEmail,
        handoffInvitedAt: (designerOrgId || designerEmail) ? new Date() : null,
        status: 'ACTIVE',
        category: 'RESIDENTIAL',
        isPublic: false,
        isAIEnabled: true,
        views: 0,
        saves: 0,
        shares: 0,
      },
      include: {
        vendorOrg: true,
        designerOrg: true,
        owner: true,
        rooms: {
          include: {
            selections: true,
          },
        },
      },
    });

    // Create initial rooms if provided
    if (initialRooms.length > 0) {
      const roomData = initialRooms.map((roomName: string) => ({
        name: roomName,
        projectId: project.id,
      }));

      await prisma.room.createMany({
        data: roomData,
      });

      // Fetch the project with rooms
      const projectWithRooms = await prisma.project.findUnique({
        where: { id: project.id },
        include: {
          vendorOrg: true,
          designerOrg: true,
          owner: true,
          rooms: {
            include: {
              selections: true,
            },
          },
        },
      });

      console.log('Created project with rooms:', projectWithRooms);
      return NextResponse.json(projectWithRooms);
    }

    console.log('Created project:', project);
    return NextResponse.json(project);
  } catch (error) {
    console.error('Error creating project handoff:', error);
    return NextResponse.json(
      { error: 'Failed to create project handoff' },
      { status: 500 }
    );
  }
}

// Designer claims project ownership
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, designerUserId, designerOrgId } = body;

    if (!projectId || !designerUserId) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, designerUserId' },
        { status: 400 }
      );
    }

    // For testing, return a mock updated project
    const mockUpdatedProject = {
      id: projectId,
      designerId: designerUserId,
      ownerId: designerUserId,
      designerOrgId: designerOrgId || undefined,
      handoffClaimedAt: new Date(),
      isHandoffReady: false,
      vendorOrg: {
        id: 'test-vendor-org',
        name: 'Vendor Co',
        description: 'Premium furniture vendor',
      },
      designerOrg: designerOrgId ? {
        id: designerOrgId,
        name: 'Design Studio Alpha',
        description: 'Creative design studio',
      } : null,
      owner: {
        id: designerUserId,
        name: 'Designer User',
        email: 'designer@example.com',
      },
      designer: {
        id: designerUserId,
        name: 'Designer User',
        email: 'designer@example.com',
      },
      rooms: [
        {
          id: 'room-1',
          name: 'Kitchen',
          selections: [],
        },
      ],
      selections: [],
    };

    return NextResponse.json(mockUpdatedProject);
  } catch (error) {
    console.error('Error claiming project:', error);
    return NextResponse.json(
      { error: 'Failed to claim project' },
      { status: 500 }
    );
  }
}

// Get projects ready for handoff
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const designerEmail = searchParams.get('designerEmail');
    const vendorOrgId = searchParams.get('vendorOrgId');

    // For testing, return mock projects
    const mockProjects = [
      {
        id: 'test-project-1',
        name: 'Modern Kitchen Renovation',
        description: 'Contemporary kitchen design with premium fixtures',
        vendorOrgId: vendorOrgId || 'test-vendor-org',
        designerOrgId: 'test-designer-org',
        ownerId: 'test-vendor-user',
        isHandoffReady: true,
        handoffInvitedAt: new Date(),
        vendorOrg: {
          id: 'test-vendor-org',
          name: 'Vendor Co',
          description: 'Premium furniture vendor',
        },
        designerOrg: {
          id: 'test-designer-org',
          name: 'Design Studio Alpha',
          description: 'Creative design studio',
        },
        owner: {
          id: 'test-vendor-user',
          name: 'John Vendor',
          email: 'john@vendorco.com',
        },
        rooms: [
          {
            id: 'room-1',
            name: 'Kitchen',
            selections: [],
          },
        ],
        selections: [],
      },
    ];

    return NextResponse.json(mockProjects);
  } catch (error) {
    console.error('Error fetching handoff projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch handoff projects' },
      { status: 500 }
    );
  }
} 
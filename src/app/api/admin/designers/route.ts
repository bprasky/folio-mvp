import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const designers = await prisma.user.findMany({
      where: { role: 'DESIGNER' },
      select: {
        id: true,
        name: true,
        bio: true,
        profileImage: true,
        followers: true,
        views: true,
        createdAt: true,
        updatedAt: true,
        designerProjects: {
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,        // was name
            stage: true,
            projectType: true,
            clientType: true,
            budgetBand: true,
            city: true,
            regionState: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ designers }, { status: 200 });
  } catch (e) {
    // Do NOT block pages; return empty list with 200 so UI can render.
    console.error('[/api/admin/designers] fallback due to error:', e);
    return NextResponse.json({ designers: [] }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, bio, profileImage } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Designer name is required' },
        { status: 400 }
      );
    }

    const newDesigner = await prisma.user.create({
      data: {
        email: `designer-${Date.now()}@folio.com`, // Generate unique email
        name: name.trim(),
        bio: bio || '',
        profileImage: profileImage || '',
        role: 'DESIGNER',
        passwordHash: 'temp-password-hash', // Required field
        followers: 0,
        views: 0,
      },
    });

    return NextResponse.json(newDesigner, { status: 201 });
  } catch (error) {
    console.error('Error creating designer:', error);
    return NextResponse.json(
      { error: 'Failed to create designer' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const designerData = await request.json();
    
    const { id, ...updateData } = designerData;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Designer ID is required for updates' },
        { status: 400 }
      );
    }

    const designers = await prisma.user.findMany({
      where: {
        role: 'DESIGNER',
      },
      select: {
        id: true,
        name: true,
        bio: true,
        profileImage: true,
        followers: true,
        views: true,
        createdAt: true,
        updatedAt: true,
        designerProjects: {
          select: {
            id: true,
            title: true,        // was name
            stage: true,
            projectType: true,
            clientType: true,
            budgetBand: true,
            city: true,
            regionState: true,
            updatedAt: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
    const designerIndex = designers.findIndex((d: any) => d.id === id);
    
    if (designerIndex === -1) {
      return NextResponse.json(
        { error: 'Designer not found' },
        { status: 404 }
      );
    }

    // Update the designer with new data
    const updatedDesigner = {
      ...designers[designerIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    await prisma.user.update({
      where: {
        id: id,
      },
      data: {
        name: updatedDesigner.name,
        bio: updatedDesigner.bio,
        profileImage: updatedDesigner.profileImage,
        updatedAt: updatedDesigner.updatedAt,
      },
    });
    
    return NextResponse.json(updatedDesigner, { status: 200 });
  } catch (error) {
    console.error('Error updating designer:', error);
    return NextResponse.json(
      { error: 'Failed to update designer' },
      { status: 500 }
    );
  }
} 
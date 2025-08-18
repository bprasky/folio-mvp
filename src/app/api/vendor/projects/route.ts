import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, type, location, description, styleTags, vendorId: originalVendorId } = body;
    let vendorId = originalVendorId;

    console.log('DEBUG: Received vendor project creation request:', {
      title,
      type,
      location,
      description,
      styleTags,
      vendorId
    });

    // Validate required fields
    if (!title || !type || !location || !description || !styleTags || !vendorId) {
      console.log('DEBUG: Missing required fields:', { title, type, location, description, styleTags, vendorId });
      return NextResponse.json(
        { error: 'Missing required fields: title, type, location, description, styleTags, vendorId' },
        { status: 400 }
      );
    }

    // Verify the vendor user exists before creating the project
    let vendorUser = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { id: true, name: true, email: true, role: true }
    });

    if (!vendorUser) {
      console.log('DEBUG: Vendor user not found with ID:', vendorId);
      
      // Try to find a vendor user with the same email (fallback)
      const vendorByEmail = await prisma.user.findFirst({
        where: { 
          email: 'Vendor@folio.com',
          role: 'VENDOR'
        },
        select: { id: true, name: true, email: true, role: true }
      });
      
      if (vendorByEmail) {
        console.log('DEBUG: Found vendor by email, using that user:', vendorByEmail);
        vendorUser = vendorByEmail;
        // Update the vendorId to use the correct user ID
        vendorId = vendorByEmail.id;
      } else {
        return NextResponse.json(
          { error: 'Vendor user not found and no fallback available', vendorId },
          { status: 404 }
        );
      }
    }

    console.log('DEBUG: Found vendor user:', vendorUser);

    // Create the project - simplified for now
    const project = await prisma.project.create({
      data: {
        name: title,
        category: type,
        description,
        ownerId: vendorId,
        status: 'draft'
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    console.log('Vendor project created successfully:', project);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor project:', error);
    return NextResponse.json(
      { error: 'Failed to create project', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Fetch projects owned by the vendor user
    const projects = await prisma.project.findMany({
      where: {
        ownerId: userId
      },
      include: {
        rooms: {
          include: {
            selections: true
          }
        },
        _count: {
          select: {
            rooms: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching vendor projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Test basic Prisma client functionality
    const userCount = await prisma.user.count();
    const orgCount = await prisma.organization.count();
    
    return NextResponse.json({
      message: 'Database connection successful',
      userCount,
      orgCount,
      prismaModels: Object.keys(prisma),
    });
  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json(
      { error: 'Database connection failed', details: error },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create-test-data') {
      // Create test organization
      const vendorOrg = await prisma.organization.create({
        data: {
          name: 'Test Vendor Company',
          type: 'VENDOR',
          description: 'A test vendor organization',
          users: {
            create: {
              userId: 'test-user-id',
              role: 'OWNER',
              isActive: true,
            },
          },
        },
      });

      // Create test project
      const project = await prisma.project.create({
        data: {
          name: 'Modern Kitchen Renovation',
          description: 'A test project for kitchen renovation',
          vendorOrgId: vendorOrg.id,
          ownerId: 'test-user-id',
          isHandoffReady: true,
          handoffInvitedAt: new Date(),
          rooms: {
            create: [
              { name: 'Kitchen' },
              { name: 'Dining Room' },
            ],
          },
          selections: {
            create: [
              {
                productName: 'Quartz Countertop',
                vendorName: 'Test Vendor',
                colorFinish: 'White',
                notes: 'Beautiful white quartz countertop',
                roomId: undefined, // Will be set after room creation
              },
              {
                productName: 'Stainless Steel Appliances',
                vendorName: 'Test Vendor',
                colorFinish: 'Stainless Steel',
                notes: 'High-end stainless steel appliances',
                roomId: undefined,
              },
            ],
          },
        },
        include: {
          vendorOrg: true,
          rooms: true,
          selections: true,
        },
      });

      return NextResponse.json({
        message: 'Test data created successfully',
        vendorOrg,
        project,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error creating test data:', error);
    return NextResponse.json(
      { error: 'Failed to create test data', details: error },
      { status: 500 }
    );
  }
} 
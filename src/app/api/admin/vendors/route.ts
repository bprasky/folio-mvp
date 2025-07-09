import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`User ${(session.user as any).id} fetching vendors`);

    // Fetch vendors from database
    const vendors = await prisma.user.findMany({
      where: {
        profileType: 'vendor'
      },
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
        profileType: true,
        followers: true,
        following: true,
        views: true,
        createdAt: true,
        updatedAt: true,
        products: {
          select: {
            id: true,
            name: true,
            category: true,
            price: true,
            imageUrl: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${vendors.length} vendors`);

    return NextResponse.json({
      success: true,
      vendors: vendors
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch vendors' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, email, companyName, profileType = 'vendor' } = body;

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      );
    }

    console.log(`Admin ${(session.user as any).id} creating vendor: ${name}`);

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Create new vendor user
    const newVendor = await prisma.user.create({
      data: {
        name,
        email,
        companyName,
        profileType: 'vendor',
        followers: 0,
        following: 0,
        views: 0,
      },
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
        profileType: true,
        followers: true,
        following: true,
        views: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    console.log(`Vendor ${newVendor.id} created successfully`);

    return NextResponse.json({
      success: true,
      vendor: newVendor,
      message: 'Vendor created successfully'
    });

  } catch (error) {
    console.error('Error creating vendor:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create vendor' },
      { status: 500 }
    );
  }
} 
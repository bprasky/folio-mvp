import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        profileType: true,
        profileImage: true,
        bio: true,
        location: true,
        companyName: true,
        email: true,
        createdAt: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, bio, location, companyName, profileType } = body;

    if (!name || !profileType) {
      return NextResponse.json(
        { error: 'Name and profile type are required' },
        { status: 400 }
      );
    }

    // Create user with role-specific fields
    const userData: any = {
      name,
      profileType,
      bio: bio || null,
      location: location || null,
      email: email || null,
    };

    // Add role-specific fields
    if (profileType === 'vendor' && companyName) {
      userData.companyName = companyName;
    }

    const user = await prisma.user.create({
      data: userData,
      select: {
        id: true,
        name: true,
        profileType: true,
        profileImage: true,
        bio: true,
        location: true,
        companyName: true,
        email: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Failed to create user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
} 
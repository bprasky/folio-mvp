import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Get session from cookie
    const sessionId = request.cookies.get('folio-session')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Query the database for the user
    const user = await prisma.user.findUnique({
      where: { id: sessionId },
      include: {
        organizationUsers: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get the primary organization (first one or the one marked as primary)
    const primaryOrg = user.organizationUsers.find(org => org.role === 'OWNER') || user.organizationUsers[0];

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyName: primaryOrg?.organization.name,
      organizationId: primaryOrg?.organizationId,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
} 
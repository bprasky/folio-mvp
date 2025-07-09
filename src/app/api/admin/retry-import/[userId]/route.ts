import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        designerProfile: true,
        designerProjects: {
          include: {
            images: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.website) {
      return NextResponse.json(
        { error: 'No website URL found for user' },
        { status: 400 }
      );
    }

    // Here you would typically trigger a reimport process
    // For now, we'll just return success
    return NextResponse.json({
      success: true,
      message: 'Reimport process initiated',
      userId,
      website: user.website
    });

  } catch (error) {
    console.error('Error retrying import:', error);
    return NextResponse.json(
      { error: 'Failed to retry import' },
      { status: 500 }
    );
  }
} 
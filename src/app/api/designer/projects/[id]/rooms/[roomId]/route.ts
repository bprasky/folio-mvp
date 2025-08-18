import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string } }
) {
  try {
    const room = await prisma.room.findUnique({
      where: { 
        id: params.roomId,
        projectId: params.id
      },
      include: {
        selections: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    return NextResponse.json(
      { error: 'Failed to fetch room', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 
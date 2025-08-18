import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    // Update project to mark it as ready for handoff
    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        isHandoffReady: true,
        handoffInvitedAt: new Date()
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
      }
    });

    console.log('Vendor project handoff initiated successfully:', project);
    return NextResponse.json(project, { status: 200 });
  } catch (error) {
    console.error('Error initiating vendor project handoff:', error);
    return NextResponse.json(
      { error: 'Failed to initiate handoff' },
      { status: 500 }
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Delete user and all related data
    await prisma.$transaction(async (tx) => {
      // Delete project images
      await tx.projectImage.deleteMany({
        where: {
          project: {
            designerId: id
          }
        }
      });

      // Delete projects
      await tx.project.deleteMany({
        where: { designerId: id }
      });

      // Delete designer profile
      await tx.designerProfile.deleteMany({
        where: { userId: id }
      });

      // Delete user
      await tx.user.delete({
        where: { id }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
} 
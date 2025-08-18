import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/options';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, newProjectName, eventId } = body;

    const userId = session.user.id;
    const productId = params.productId;

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    let targetProjectId = projectId;

    // Create new project if needed
    if (newProjectName && !projectId) {
      const newProject = await prisma.project.create({
        data: {
          name: newProjectName,
          description: `Project created from event`,
          ownerId: userId,
          designerId: userId,
        },
      });
      targetProjectId = newProject.id;
    }

    // Verify project exists and user has access
    if (targetProjectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: targetProjectId,
          OR: [
            { ownerId: userId },
            { designerId: userId },
          ],
        },
      });

      if (!project) {
        return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
      }
    }

    // Add product to folder (using existing folder structure)
    // For now, we'll use the first folder or create one
    let folder = await prisma.folder.findFirst({
      where: { designerId: userId },
    });

    if (!folder) {
      folder = await prisma.folder.create({
        data: {
          name: 'My Products',
          designerId: userId,
        },
      });
    }

    // Check if product is already in folder
    const existingFolderProduct = await prisma.folderProduct.findFirst({
      where: {
        folderId: folder.id,
        productId: productId,
      },
    });

    if (existingFolderProduct) {
      return NextResponse.json({ 
        ok: true, 
        saves: 1,
        message: 'Product already saved' 
      });
    }

    // Add product to folder
    await prisma.folderProduct.create({
      data: {
        folderId: folder.id,
        productId: productId,
      },
    });

    // Track analytics
    try {
      await prisma.engagementEvent.create({
        data: {
          userId: userId,
          eventId: eventId,
          productId: productId,
          verb: 'SAVE_PRODUCT',
          meta: {
            projectId: targetProjectId,
            eventId: eventId,
          },
        },
      });
    } catch (error) {
      console.error('Error creating engagement event:', error);
    }

    return NextResponse.json({ 
      ok: true, 
      saves: 1,
      message: 'Product saved successfully' 
    });
  } catch (error) {
    console.error('Error saving product to project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
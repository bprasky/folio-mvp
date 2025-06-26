import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const designerId = url.searchParams.get('designerId');
    const includeDrafts = url.searchParams.get('includeDrafts') === 'true';
    
    const whereClause: any = {};
    
    // Filter projects by designer if specified
    if (designerId) {
      whereClause.designerId = designerId;
    }
    
    // Filter out drafts unless specifically requested
    if (!includeDrafts) {
      whereClause.status = { not: 'draft' };
    }
    
    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        designer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        images: {
          include: {
            tags: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const projectData = await request.json();
    
    const {
      name,
      description,
      category,
      client,
      designerId,
      images,
      status,
      isDraft
    } = projectData;
    
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    if (!category?.trim()) {
      return NextResponse.json(
        { error: 'Project category is required' },
        { status: 400 }
      );
    }

    // Validate images if provided
    if (images && images.length > 0) {
      for (const image of images) {
        if (!image.url || !image.url.trim()) {
          return NextResponse.json(
            { error: 'All images must have valid URLs' },
            { status: 400 }
          );
        }
        
        // Basic URL validation
        try {
          new URL(image.url);
        } catch {
          return NextResponse.json(
            { error: `Invalid image URL: ${image.url}` },
            { status: 400 }
          );
        }
      }
    }

    // If this is a draft, check if we already have a recent draft for this user
    if (isDraft || status === 'draft') {
      const recentDraft = await prisma.project.findFirst({
        where: {
          designerId: designerId || 'designer-1',
          status: 'draft',
          name: name.trim(),
          updatedAt: {
            gte: new Date(Date.now() - 10000), // Within 10 seconds
          },
        },
      });
      
      if (recentDraft) {
        // Update existing draft instead of creating a new one
        const updatedProject = await prisma.project.update({
          where: { id: recentDraft.id },
          data: {
            description: description || '',
            client: client || '',
            category: category.trim(),
            updatedAt: new Date(),
          },
          include: {
            images: {
              include: {
                tags: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        });

        // Update images if provided
        if (images && images.length > 0) {
          for (const image of images) {
            await prisma.projectImage.upsert({
              where: { id: image.id },
              update: {
                url: image.url,
                name: image.name,
                room: image.room,
              },
              create: {
                id: image.id,
                url: image.url,
                name: image.name,
                room: image.room,
                projectId: recentDraft.id,
              },
            });

            // Update tags if provided
            if (image.tags && image.tags.length > 0) {
              for (const tag of image.tags) {
                // Create pending product if needed
                let productId = tag.productId;
                if (tag.isPending && tag.productId.startsWith('pending-')) {
                  await prisma.product.upsert({
                    where: { id: tag.productId },
                    update: {
                      name: tag.productName,
                      imageUrl: tag.productImage,
                      price: tag.productPrice,
                      brand: tag.productBrand,
                      isPending: true,
                    },
                    create: {
                      id: tag.productId,
                      name: tag.productName,
                      imageUrl: tag.productImage,
                      price: tag.productPrice,
                      brand: tag.productBrand,
                      isPending: true,
                    },
                  });
                }

                await prisma.productTag.upsert({
                  where: { id: tag.id },
                  update: {
                    x: tag.x,
                    y: tag.y,
                  },
                  create: {
                    id: tag.id,
                    x: tag.x,
                    y: tag.y,
                    productId: productId,
                    imageId: image.id,
                  },
                });
              }
            }
          }
        }
        
        return NextResponse.json(updatedProject, { status: 200 });
      }
    }

    // Create new project
    const newProject = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description || '',
        category: category.trim(),
        client: client || '',
        designerId: designerId || 'designer-1',
        status: status || (isDraft ? 'draft' : 'published'),
        views: status === 'draft' ? 0 : Math.floor(Math.random() * 1000) + 100,
        saves: status === 'draft' ? 0 : Math.floor(Math.random() * 200) + 20,
        shares: status === 'draft' ? 0 : Math.floor(Math.random() * 50) + 5,
      },
      include: {
        images: {
          include: {
            tags: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    // Create images if provided
    if (images && images.length > 0) {
      for (const image of images) {
        await prisma.projectImage.create({
          data: {
            id: image.id,
            url: image.url,
            name: image.name,
            room: image.room,
            projectId: newProject.id,
          },
        });

        // Create tags if provided
        if (image.tags && image.tags.length > 0) {
          for (const tag of image.tags) {
            // Create pending product if needed
            let productId = tag.productId;
            if (tag.isPending && tag.productId.startsWith('pending-')) {
              await prisma.product.upsert({
                where: { id: tag.productId },
                update: {
                  name: tag.productName,
                  imageUrl: tag.productImage,
                  price: tag.productPrice,
                  brand: tag.productBrand,
                  isPending: true,
                },
                create: {
                  id: tag.productId,
                  name: tag.productName,
                  imageUrl: tag.productImage,
                  price: tag.productPrice,
                  brand: tag.productBrand,
                  isPending: true,
                },
              });
            }

            await prisma.productTag.create({
              data: {
                id: tag.id,
                x: tag.x,
                y: tag.y,
                productId: productId,
                imageId: image.id,
              },
            });
          }
        }
      }
    }
    
    console.log('Project created successfully:', newProject);
    
    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const projectData = await request.json();
    
    const { id, ...updateData } = projectData;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required for updates' },
        { status: 400 }
      );
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      include: {
        images: {
          include: {
            tags: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });
    
    console.log('Project updated successfully:', updatedProject);
    
    return NextResponse.json(updatedProject, { status: 200 });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Failed to update project: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required for deletion' },
        { status: 400 }
      );
    }

    await prisma.project.delete({
      where: { id },
    });
    
    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
} 
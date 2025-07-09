import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const subEvent = await prisma.subEvent.findUnique({
      where: { id: params.id },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            location: true,
            address: true,
            city: true,
            state: true,
            country: true,
            thumbnail: true,
            banner: true,
          }
        },
        rsvps: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImage: true,
                profileType: true,
                location: true,
                specialties: true,
                followers: true,
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        media: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImage: true,
                profileType: true,
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        products: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                price: true,
                brand: true,
                category: true,
              }
            }
          }
        },
        // spotlightProducts: {
        //   include: {
        //     product: {
        //       select: {
        //         id: true,
        //         name: true,
        //         imageUrl: true,
        //         price: true,
        //         brand: true,
        //         category: true,
        //         description: true,
        //       }
        //     }
        //   }
        // }
      }
    });

    if (!subEvent) {
      return NextResponse.json({ error: 'SubEvent not found' }, { status: 404 });
    }

    // Calculate metrics
    const totalRSVPs = await prisma.subEventRSVP.count({
      where: { subEventId: params.id }
    });

    const publicRSVPs = await prisma.subEventRSVP.count({
      where: { 
        subEventId: params.id
      }
    });

    const totalMedia = await prisma.subEventMedia.count({
      where: { subEventId: params.id }
    });

    const totalProducts = await prisma.subEventProduct.count({
      where: { subEventId: params.id }
    });

    // Get top products by engagement (mock data for now)
    const topProducts = ((subEvent as any).products || []).slice(0, 5).map((sp: any) => ({
      ...sp.product,
      scanCount: Math.floor(Math.random() * 50) + 10,
      saveCount: Math.floor(Math.random() * 30) + 5,
      uploadCount: Math.floor(Math.random() * 20) + 2,
    }));

    return NextResponse.json({
      ...subEvent,
      metrics: {
        totalRSVPs,
        publicRSVPs,
        totalMedia,
        totalProducts,
        topProducts,
      }
    });

  } catch (error) {
    console.error('Error fetching subevent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { userId } = body;

    // Check if user already RSVP'd
    const existingRSVP = await prisma.subEventRSVP.findFirst({
      where: {
        subEventId: params.id,
        userId: userId
      }
    });

    if (existingRSVP) {
      // Update existing RSVP
      const updatedRSVP = await prisma.subEventRSVP.update({
        where: { id: existingRSVP.id },
        data: {},
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profileImage: true,
              profileType: true,
            }
          }
        }
      });
      return NextResponse.json(updatedRSVP);
    }

    // Create new RSVP
    const newRSVP = await prisma.subEventRSVP.create({
      data: {
        subEventId: params.id,
        userId: userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            profileType: true,
          }
        }
      }
    });

    return NextResponse.json(newRSVP);

  } catch (error) {
    console.error('Error creating RSVP:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Delete the sub-event (cascade will handle related records)
    await prisma.subEvent.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Sub-event deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting sub-event:', error);
    return NextResponse.json(
      { error: 'Failed to delete sub-event' },
      { status: 500 }
    );
  }
} 
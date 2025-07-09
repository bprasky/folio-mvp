import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = {};
    
    if (eventId) {
      where.eventId = eventId;
    }
    
    if (type) {
      where.type = type;
    }

    const subEvents = await prisma.subEvent.findMany({
      where,
      include: {
        event: {
          select: {
            title: true,
            location: true,
            city: true,
            state: true,
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
              }
            }
          }
        },
        media: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImage: true,
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 5
        },
        products: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                brand: true,
                price: true,
              }
            }
          }
        },
        _count: {
          select: {
            rsvps: true,
            media: true,
            products: true,
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      },
      take: limit
    });

    return NextResponse.json(subEvents);
  } catch (error) {
    console.error('Error fetching sub-events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sub-events' },
      { status: 500 }
    );
  }
} 
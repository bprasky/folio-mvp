import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Fetch all selections with related data for vendor analytics
    const selections = await prisma.selection.findMany({
      include: {
        room: {
          include: {
            project: {
              include: {
                designer: {
                  select: {
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(selections);
  } catch (error) {
    console.error('Error fetching vendor analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor analytics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 
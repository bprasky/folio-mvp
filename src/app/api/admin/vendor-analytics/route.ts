export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requireAdmin';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
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
  } catch (error: any) {
    console.error('Error fetching vendor analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch vendor analytics' },
      { status: error.status ?? 500 }
    );
  }
} 
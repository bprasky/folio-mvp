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
    if (error.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.status === 403) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Error fetching vendor analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor analytics' },
      { status: 500 }
    );
  }
}

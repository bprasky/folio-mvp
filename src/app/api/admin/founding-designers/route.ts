/**
 * Founding Designer Admin API
 *
 * GET /api/admin/founding-designers - List all founding designers
 * POST /api/admin/founding-designers - Enroll a new founding designer
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import {
  listFoundingDesigners,
  enrollFoundingDesigner,
  getFoundingDesignerCapacity,
  checkFoundingDesignerCompliance,
  FOUNDING_DESIGNER_CONFIG,
} from '@/lib/pricing';

// Admin role check
async function isAdmin(session: any): Promise<boolean> {
  return session?.user?.role === 'ADMIN';
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!await isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [founders, capacity, nonCompliant] = await Promise.all([
      listFoundingDesigners(),
      getFoundingDesignerCapacity(),
      checkFoundingDesignerCompliance(),
    ]);

    return NextResponse.json({
      founders,
      capacity,
      nonCompliant,
      config: FOUNDING_DESIGNER_CONFIG,
    });
  } catch (error) {
    console.error('Error fetching founding designers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch founding designers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!await isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    const result = await enrollFoundingDesigner(userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User enrolled as founding designer',
    });
  } catch (error) {
    console.error('Error enrolling founding designer:', error);
    return NextResponse.json(
      { error: 'Failed to enroll founding designer' },
      { status: 500 }
    );
  }
}

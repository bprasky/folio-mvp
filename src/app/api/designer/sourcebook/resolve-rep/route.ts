export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { resolveVendorRep } from '@/lib/messaging/rep-resolution';

/**
 * POST /api/designer/sourcebook/resolve-rep
 * Resolve the vendor rep for a product before sending a request.
 * Body: { productId }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productId } = await request.json();
    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    const result = await resolveVendorRep(session.user.id, productId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] /api/designer/sourcebook/resolve-rep error:', error);
    return NextResponse.json({ error: 'Failed to resolve rep' }, { status: 500 });
  }
}

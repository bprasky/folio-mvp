export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { approveInContextBoost, answerInContextFollowUp } from '@/lib/boost/inContextBoost';

/**
 * GET /api/products/[productId]/in-context-boosts
 * Returns boost opportunities for a product (vendor dashboard).
 * Auth-gated: vendor owner, admin, or the designer.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const productId = resolvedParams.productId;

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // Filter by status

    const boosts = await prisma.inContextBoost.findMany({
      where: {
        productId,
        ...(status ? { status } : {}),
      },
      include: {
        productTag: {
          select: {
            id: true,
            x: true,
            y: true,
            image: {
              select: {
                id: true,
                url: true,
                room: true,
                project: {
                  select: {
                    id: true,
                    title: true,
                    post: {
                      select: { slug: true, status: true, expandedBlocks: true },
                    },
                  },
                },
              },
            },
          },
        },
        designer: {
          select: { id: true, name: true, profileImage: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ boosts });
  } catch (error) {
    console.error('[in-context-boosts] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch boosts' }, { status: 500 });
  }
}

/**
 * POST /api/products/[productId]/in-context-boosts
 * Vendor actions: approve, decline, or designer answers follow-up.
 *
 * Body: { action: 'approve'|'decline'|'answer', boostId, followUpQuestion?, answer?, declineReason? }
 */
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
    const { action, boostId, followUpQuestion, answer, declineReason } = body;

    if (!boostId || !action) {
      return NextResponse.json({ error: 'Missing boostId or action' }, { status: 400 });
    }

    // Verify boost exists
    const boost = await prisma.inContextBoost.findUnique({
      where: { id: boostId },
      select: { id: true, productId: true, designerId: true, vendorUserId: true, vendorId: true, status: true },
    });

    if (!boost) {
      return NextResponse.json({ error: 'Boost not found' }, { status: 404 });
    }

    const userRole = (session.user as any).role;
    const isAdmin = userRole === 'ADMIN';
    const isVendorOwner = boost.vendorUserId === session.user.id;
    const isDesigner = boost.designerId === session.user.id;

    switch (action) {
      case 'approve': {
        if (!isVendorOwner && !isAdmin) {
          return NextResponse.json({ error: 'Only vendor or admin can approve' }, { status: 403 });
        }
        const result = await approveInContextBoost({
          boostId,
          reviewerId: session.user.id,
          followUpQuestion,
        });
        return NextResponse.json({ success: true, boost: result });
      }

      case 'decline': {
        if (!isVendorOwner && !isAdmin) {
          return NextResponse.json({ error: 'Only vendor or admin can decline' }, { status: 403 });
        }
        const result = await prisma.inContextBoost.update({
          where: { id: boostId },
          data: {
            status: 'DECLINED',
            reviewedAt: new Date(),
            declineReason: declineReason || null,
          },
        });
        return NextResponse.json({ success: true, boost: result });
      }

      case 'answer': {
        if (!isDesigner && !isAdmin) {
          return NextResponse.json({ error: 'Only the designer can answer follow-ups' }, { status: 403 });
        }
        if (!answer) {
          return NextResponse.json({ error: 'Answer is required' }, { status: 400 });
        }
        const result = await answerInContextFollowUp({
          boostId,
          designerId: boost.designerId,
          answer,
        });
        return NextResponse.json({ success: true, boost: result });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[in-context-boosts] POST error:', error);
    return NextResponse.json({ error: 'Failed to process boost action' }, { status: 500 });
  }
}

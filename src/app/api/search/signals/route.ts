import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { captureSearchSignal } from '@/lib/search/searchSignals';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/search/signals
 * 
 * Capture search interaction signals for trend analysis
 * 
 * Body:
 *   action: 'click' | 'save' | 'share'
 *   momentId: string
 *   query?: string (optional search query)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    
    const { action, momentId, query } = body;
    
    if (!momentId) {
      return NextResponse.json(
        { error: 'momentId is required' },
        { status: 400 }
      );
    }
    
    // Track individual moment interactions
    if (action === 'click' || action === 'save' || action === 'share') {
      await prisma.contextSignal.create({
        data: {
          userId: session?.user?.id || null,
          productId: null,
          projectId: null,
          action: `moment_${action}`,
          tags: query ? [query.toLowerCase()] : [],
          meta: {
            momentId,
            source: 'search',
            query: query || null,
          },
        },
      });
      
      // Update engagement metrics on ProjectImage
      const updateField = action === 'click' ? 'momentViews' : 
                         action === 'save' ? 'momentSaves' : 
                         'momentShares';
      
      await prisma.projectImage.update({
        where: { id: momentId },
        data: {
          [updateField]: { increment: 1 },
        },
      }).catch(err => {
        // Image might not exist, that's okay
        console.warn(`Failed to update engagement for ${momentId}:`, err);
      });
      
      // Update engagement score in moment_index
      const image = await prisma.projectImage.findUnique({
        where: { id: momentId },
        select: {
          momentViews: true,
          momentSaves: true,
          momentShares: true,
        },
      });
      
      if (image) {
        const engagementScore = 
          image.momentViews * 0.1 + 
          image.momentSaves * 2.0 + 
          image.momentShares * 3.0;
        
        await prisma.momentIndex.updateMany({
          where: { projectImageId: momentId },
          data: { engagementScore },
        });
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/search/signals] Error:', error);
    return NextResponse.json(
      { error: 'Failed to capture signal' },
      { status: 500 }
    );
  }
}


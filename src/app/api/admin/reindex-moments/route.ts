import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runFullReindex } from '@/lib/search/indexMoment';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/reindex-moments
 * 
 * Triggers full reindex of all ProjectImages to populate MomentIndex classification arrays
 * Requires admin authentication
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is admin
    if (!session?.user || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }
    
    // Run reindex in background (don't block response)
    runFullReindex(50).catch(err => {
      console.error('[Reindex] Error during reindex:', err);
    });
    
    return NextResponse.json({ 
      success: true,
      message: 'Reindexing started in background. Check server logs for progress.',
    });
  } catch (error) {
    console.error('[Reindex] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start reindex' },
      { status: 500 }
    );
  }
}


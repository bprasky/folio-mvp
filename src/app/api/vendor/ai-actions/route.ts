export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

/**
 * AI Actions API - Non-destructive stub for creating tasks from AI insights
 * TODO: Wire to real task system later
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    
    // Log the action for now (non-destructive)
    console.log('[AI ACTION TASK]', {
      timestamp: new Date().toISOString(),
      action: body.kind,
      label: body.label,
      payload: body.payload,
      insightId: body.insightId,
      insightTitle: body.insightTitle
    });

    // Return success with demo task ID
    return NextResponse.json(
      {
        ok: true,
        taskId: `demo_${Date.now()}`,
        message: 'Task created successfully (demo mode)'
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (error) {
    console.error('[AI ACTION] Error processing request:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to process action' },
      { status: 500 }
    );
  }
}



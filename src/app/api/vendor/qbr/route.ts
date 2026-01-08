export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { computeAIBundle } from '@/lib/vendor-data/ai/engine';
import { getInitialDemoState } from '@/lib/vendor-data/demoStore';

/**
 * QBR API - Returns AI Quarterly Business Review data
 * For now returns JSON; later can stream a real PDF
 * Note: In demo mode, this reads from demo state. For production, this would read from DB.
 */
export async function GET() {
  try {
    // For now, use demo state. In production, this would fetch from DB based on vendorId
    const state = getInitialDemoState();
    const bundle = computeAIBundle(state);
    
    // Return QBR payload
    return NextResponse.json(bundle.qbr, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('[QBR API] Error generating QBR:', error);
    return NextResponse.json(
      { error: 'Failed to generate QBR' },
      { status: 500 }
    );
  }
}


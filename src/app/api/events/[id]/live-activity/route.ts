import { NextRequest, NextResponse } from 'next/server';

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');

    // Placeholder: return empty activity for now
    // In a real implementation, you'd query your engagement/activity table
    const activity = [];

    return NextResponse.json({ activity });
  } catch (error) {
    console.error('Error fetching live activity:', error);
    return NextResponse.json({ activity: [] }, { status: 500 });
  }
} 
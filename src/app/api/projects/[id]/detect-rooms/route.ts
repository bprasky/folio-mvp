import { NextResponse } from 'next/server';

// Retired: old tabs must not launch photo room detection or change saved rooms.
export async function POST() {
  return NextResponse.json(
    { error: 'AI room detection has been removed. Assign photos to rooms in the Rooms step.' },
    { status: 410 },
  );
}

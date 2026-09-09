// @idor-allow: IDOR002 reason="Retired endpoint: constant 410 only; no resource reads or mutations."
// @idor-allow: IDOR005 reason="Retired endpoint: constant 410 only; no resource reads or mutations."
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

// Compatibility URL retained with an explicit, side-effect-free retirement response.
export async function GET() {
  return NextResponse.json({ error: "This profile API is retired. Open /profile to view your saved profile.", code: 'ENDPOINT_RETIRED' }, { status: 410 });
}

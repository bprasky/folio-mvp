// @idor-allow: IDOR002 reason="Retired endpoint: constant 410 only; no resource reads or mutations."
// @idor-allow: IDOR005 reason="Retired endpoint: constant 410 only; no resource reads or mutations."
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

// Compatibility URL retained with an explicit, side-effect-free retirement response.
export async function POST() {
  return NextResponse.json({ error: "Legacy profile switching is retired. No profile or role was changed.", code: 'ENDPOINT_RETIRED' }, { status: 410 });
}

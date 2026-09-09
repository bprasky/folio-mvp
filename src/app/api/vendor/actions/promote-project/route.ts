// @idor-allow: IDOR002 reason="Retired endpoint: constant 410 only; no resource reads or mutations."
// @idor-allow: IDOR005 reason="Retired endpoint: constant 410 only; no resource reads or mutations."
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

// Compatibility URL retained with an explicit, side-effect-free retirement response.
export async function POST() {
  return NextResponse.json({ error: "This legacy vendor action is retired. No promotion, support request, specification change or invitation was submitted.", code: 'ENDPOINT_RETIRED' }, { status: 410 });
}

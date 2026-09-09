// @idor-allow: IDOR002 reason="Retired endpoint: constant 410 only; no resource reads or mutations."
// @idor-allow: IDOR005 reason="Retired endpoint: constant 410 only; no resource reads or mutations."
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
export async function POST() {
  return NextResponse.json({ error: 'This legacy invitation API is retired. Invite guests through the event workflow; no invitation was sent.', code: 'ENDPOINT_RETIRED' }, { status: 410 });
}
// @idor-allow: IDOR002 reason="Retired endpoint: constant 410 only; no resource reads or mutations."
// @idor-allow: IDOR005 reason="Retired endpoint: constant 410 only; no resource reads or mutations."
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
export async function POST() {
  return NextResponse.json({ code: 'ENDPOINT_RETIRED', error: 'Legacy product preview invitations are retired. Use the product completion request to request vendor outreach.' }, { status: 410 });
}

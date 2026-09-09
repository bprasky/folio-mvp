// @idor-allow: IDOR002 reason="Retired endpoint: constant 410 only; no resource reads or mutations."
// @idor-allow: IDOR005 reason="Retired endpoint: constant 410 only; no resource reads or mutations."
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
export async function POST() {
  return NextResponse.json({ code: 'ENDPOINT_RETIRED', error: 'Product preview claims are retired. Sign in, complete organization setup, and use the vendor product review queue.' }, { status: 410 });
}

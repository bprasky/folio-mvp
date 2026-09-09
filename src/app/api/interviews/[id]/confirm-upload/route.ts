// @idor-allow: IDOR002 reason="Retired endpoint: constant 410 only; no resource reads or mutations."
// @idor-allow: IDOR005 reason="Retired endpoint: constant 410 only; no resource reads or mutations."
import { NextResponse } from 'next/server';
export async function POST() {
  return NextResponse.json({ error: 'This upload protocol is retired. Use the authenticated interview upload endpoint.' }, { status: 410 });
}


// @idor-allow: IDOR005 reason="Retired endpoint: constant 410 only; no resource reads or mutations."
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'The sample quarterly review export is retired. No account data was exported.', code: 'ENDPOINT_RETIRED' }, { status: 410 });
}
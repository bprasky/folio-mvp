import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { assertProjectWrite } from '@/lib/authz/access';
import { rateLimit } from '@/lib/rateLimit';
import { importListingDetails } from '@/lib/property-sale/import-listing';
import { UnsafeProductUrl } from '@/lib/server/safe-product-url';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;
const headers = { 'Cache-Control': 'private, no-store' };
const Input = z.object({ url: z.string().trim().min(1).max(2000) }).strict();
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to import listing details.' }, { status: 401, headers });
  try { await assertProjectWrite(session.user.id, params.id); }
  catch { return NextResponse.json({ error: 'Project access is required.' }, { status: 403, headers }); }
  let input: z.infer<typeof Input>;
  try { input = Input.parse(await request.json()); }
  catch { return NextResponse.json({ error: 'Add a complete listing link.' }, { status: 422, headers }); }
  const limit = await rateLimit({ userId: session.user.id, scope: 'property-listing-import', limit: 10, windowMs: 60000 });
  if (!limit.ok) return NextResponse.json({ error: 'Please wait a minute before importing another listing.' }, { status: 429, headers });
  try { return NextResponse.json(await importListingDetails(input.url), { headers }); }
  catch (error) {
    const safeMessage = error instanceof Error && /^(This listing site|The listing)/.test(error.message) ? error.message : 'The listing could not be read. Keep its link and enter the details manually.';
    return NextResponse.json({ error: error instanceof UnsafeProductUrl ? 'Use a public listing website link.' : safeMessage }, { status: 422, headers });
  }
}

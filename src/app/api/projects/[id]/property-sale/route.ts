import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { getPropertySale, savePropertySale, PropertySaleConflict } from '@/lib/property-sale/store';
import { PropertySaleDetailsSchema } from '@/lib/property-sale/schema';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const SaveSchema = z.object({ version: z.number().int().nonnegative(), requestId: z.string().uuid(), details: PropertySaleDetailsSchema }).strict();
function failure(error: unknown) {
  if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Check the property details.' }, { status: 422, headers });
  if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return NextResponse.json({ error: 'Property details changed while saving. Reload the saved details.' }, { status: 409, headers });
  if (error instanceof PropertySaleConflict) return NextResponse.json({ error: error.message }, { status: 409, headers });
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('Forbidden')) return NextResponse.json({ error: 'Your firm’s permission is required to publish or change public property details.' }, { status: 403, headers });
  if (message === 'NotFound') return NextResponse.json({ error: 'Project not found.' }, { status: 404, headers });
  return NextResponse.json({ error: 'Property details could not be saved or loaded. Please retry.' }, { status: 500, headers });
}
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to view property details.' }, { status: 401, headers });
  try { return NextResponse.json({ sale: await getPropertySale(params.id, session.user.id) }, { headers }); }
  catch (error) { return failure(error); }
}
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to save property details.' }, { status: 401, headers });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers }); }
  try { return NextResponse.json({ sale: await savePropertySale(params.id, session.user.id, SaveSchema.parse(body)) }, { headers }); }
  catch (error) { return failure(error); }
}

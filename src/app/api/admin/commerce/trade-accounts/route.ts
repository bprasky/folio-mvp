import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import {
  createTradeAccount,
  listAllTradeAccounts,
} from '@/lib/commerce/vendor-accounts';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createAccountSchema = z.object({
  vendorId: z.string().min(1, 'Vendor ID is required'),
  accountType: z.enum(['TRADE_LOGIN', 'QUOTE', 'REP_MEDIATED', 'API']),
  discountPercent: z
    .number()
    .min(0, 'Discount must be at least 0%')
    .max(100, 'Discount cannot exceed 100%'),
  paymentTerms: z.string().optional(),
  loginUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  credentials: z.record(z.string()).optional(),
  contactEmail: z
    .string()
    .email('Must be a valid email')
    .optional()
    .or(z.literal('')),
  contactPhone: z.string().optional(),
  defaultRepId: z.string().optional(),
});

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  if (session.user.role !== 'ADMIN') {
    throw new Error('Forbidden');
  }

  return session.user.id;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const cursor = searchParams.get('cursor') || undefined;

  try {
    const result = await listAllTradeAccounts({
      limit: Math.min(limit, 100),
      cursor,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching trade accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trade accounts' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }

  try {
    const body = await req.json();
    const validated = createAccountSchema.parse(body);

    // Clean up empty strings to undefined
    const cleanedData = {
      ...validated,
      loginUrl: validated.loginUrl || undefined,
      contactEmail: validated.contactEmail || undefined,
    };

    const account = await createTradeAccount(cleanedData);
    return NextResponse.json(account);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Trade account creation error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to create trade account';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

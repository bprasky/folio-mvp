export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getVendorContext } from '@/lib/auth/vendorContext';
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!await getVendorContext()) return NextResponse.json({ error: 'Vendor access required' }, { status: 403 });
  // Product.vendorId is a User ID; boost.vendorId requires historical Vendor.
  // No verified adapter exists. Resume only after the documented schema approval.
  return NextResponse.json({ error: 'Interview requests are temporarily unavailable.' }, { status: 503 });
}


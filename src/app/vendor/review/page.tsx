import { redirect } from 'next/navigation';
import { getVendorContext } from '@/lib/auth/vendorContext';
import ReviewQueueClient from './ReviewQueueClient';

export const dynamic = 'force-dynamic';

export default async function VendorReviewPage() {
  const ctx = await getVendorContext();
  if (!ctx) redirect('/vendor/dashboard');

  return <ReviewQueueClient vendorName={ctx.vendor?.name ?? 'your brand'} />;
}

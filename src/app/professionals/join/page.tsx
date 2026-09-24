import { redirect } from 'next/navigation';
import { professionalSetupHref } from '@/lib/onboarding/professional-entry';
export const dynamic = 'force-dynamic';
export default function ProfessionalsJoinRedirect({ searchParams }: { searchParams: { type?: string; callbackUrl?: string; orgId?: string; add?: string } }) {
  const destination = new URL(professionalSetupHref(searchParams.type === 'photographer' ? 'designer' : searchParams.type, searchParams.callbackUrl), 'https://folio.invalid');
  if (searchParams.orgId) destination.searchParams.set('orgId', searchParams.orgId);
  if (searchParams.add === '1') destination.searchParams.set('add', '1');
  redirect(destination.pathname + destination.search);
}

import { redirect } from 'next/navigation';
import { safeProfessionalCallback } from '@/lib/onboarding/professional-entry';

export default function ForProfessionalsRedirect({ searchParams }: { searchParams: { type?: string; callbackUrl?: string } }) {
  const query = new URLSearchParams();
  if (searchParams.type) query.set('type', searchParams.type);
  if (searchParams.callbackUrl) query.set('callbackUrl', safeProfessionalCallback(searchParams.callbackUrl));
  redirect('/professionals' + (query.size ? '?' + query : ''));
}

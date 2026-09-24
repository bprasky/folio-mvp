import { redirect } from 'next/navigation';
import { professionalSetupHref } from '@/lib/onboarding/professional-entry';
export const dynamic = 'force-dynamic';
export default function ProfessionalsJoinRedirect({ searchParams }: { searchParams: { type?: string; callbackUrl?: string } }) {
  redirect(professionalSetupHref(searchParams.type === 'photographer' ? 'designer' : searchParams.type, searchParams.callbackUrl));
}

import { redirect } from 'next/navigation';
import { professionalSetupHref } from '@/lib/onboarding/professional-entry';
export const dynamic = 'force-dynamic';
export default function OrganizationRedirect({ params, searchParams }: { params: { role: string }; searchParams: { callbackUrl?: string } }) {
  redirect(professionalSetupHref(params.role, searchParams.callbackUrl));
}

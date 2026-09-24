import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { professionalEntryHref } from '@/lib/onboarding/professional-entry';
export const dynamic = 'force-dynamic';
// The canonical enrollment page resolves existing memberships and missing timestamps.
export default async function FirmPage() {
  const session = await getServerSession(authOptions);
  redirect(professionalEntryHref(!!session?.user?.id, session?.user?.role?.toLowerCase(), '/projects/new'));
}

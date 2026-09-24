import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { professionalEntryHref } from '@/lib/onboarding/professional-entry';
export const dynamic = 'force-dynamic';
export default async function ProfessionalsPage({ searchParams }: { searchParams: { type?: string; callbackUrl?: string } }) {
  const session = await getServerSession(authOptions);
  redirect(professionalEntryHref(!!session?.user?.id, searchParams.type, searchParams.callbackUrl));
}

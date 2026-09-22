import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { StudioReleasePlan } from '@/components/publishing-studio/StudioReleasePlan';

export const metadata = { title: 'Plan a project release | Publishing Studio | Folio' };

export default async function StudioReleasePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/auth/signin');
  return <Suspense fallback={<p role="status" className="p-8 folio-body">Opening your release plan…</p>}><StudioReleasePlan /></Suspense>;
}

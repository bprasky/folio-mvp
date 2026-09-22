import { expertiseEnabled } from '@/lib/publishing-studio/expertise/flag';
import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { ExpertiseWorkspace } from '@/components/publishing-studio/expertise/ExpertiseWorkspace';
export const metadata = { title: 'My expertise | Publishing Studio | Folio' };
export default async function ExpertisePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/auth/signin');
  if (!expertiseEnabled()) notFound();
  return <Suspense fallback={<p className="p-8 folio-body">Opening your expertise article…</p>}><ExpertiseWorkspace /></Suspense>;
}

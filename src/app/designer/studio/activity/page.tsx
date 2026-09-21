import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { StudioActivityHost } from '@/components/publishing-studio/StudioActivityHost';

export const metadata = { title: 'Your story | Publishing Studio | Folio' };

export default async function StudioActivityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/auth/signin');
  return <Suspense fallback={<p className="p-8 folio-body">Opening your activity…</p>}><StudioActivityHost /></Suspense>;
}

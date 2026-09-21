import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { PublishingStudio } from '@/components/publishing-studio/PublishingStudio';
import { ReadinessStudio } from '@/components/publishing-studio/ReadinessStudio';

export const metadata = { title: 'Publishing Studio | Folio' };

export default async function PublishingStudioPage({ searchParams }: { searchParams?: { view?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/auth/signin');
  return <Suspense fallback={<p className="p-8 folio-body">Opening Publishing Studio…</p>}>{process.env.STUDIO_EDITORIAL_READINESS === 'true' && searchParams?.view !== 'saved' ? <ReadinessStudio /> : <PublishingStudio />}</Suspense>;
}

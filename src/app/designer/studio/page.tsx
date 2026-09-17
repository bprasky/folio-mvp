import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { PublishingStudio } from '@/components/publishing-studio/PublishingStudio';

export const metadata = { title: 'Publishing Studio | Folio' };

export default async function PublishingStudioPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/auth/signin');
  return <Suspense fallback={<p className="p-8 folio-body">Opening Publishing Studio…</p>}><PublishingStudio /></Suspense>;
}

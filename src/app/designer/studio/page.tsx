import { expertiseEnabled } from '@/lib/publishing-studio/expertise/flag';
import { Suspense } from 'react';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { PublishingStudio } from '@/components/publishing-studio/PublishingStudio';
import { ReadinessStudio } from '@/components/publishing-studio/ReadinessStudio';

export const metadata = { title: 'Publishing Studio | Folio' };

export default async function PublishingStudioPage({ searchParams }: { searchParams?: { view?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/auth/signin');
  return <><div className="mx-auto max-w-7xl px-6 pt-5 text-right"><Link href="/designer/studio/media" className="folio-meta underline">Interview recordings and media</Link></div><Suspense fallback={<p className="p-8 folio-body">Opening Publishing Studio…</p>}>{process.env.STUDIO_EDITORIAL_READINESS === 'true' && searchParams?.view !== 'saved' ? <ReadinessStudio expertiseEnabled={expertiseEnabled()} /> : <PublishingStudio expertiseEnabled={expertiseEnabled()} />}</Suspense></>;
}

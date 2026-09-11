import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { spotlightEnabled } from '@/lib/spotlight/gate';
import { runSpotlight } from '@/lib/spotlight/service';
import { PrivateSpotlightWorkspace } from '@/components/spotlight/PrivateSpotlightWorkspace';

export const dynamic = 'force-dynamic';
export default async function SpotlightPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !spotlightEnabled(params.id, session.user.id)) notFound();
  await runSpotlight(params.id, session.user.id, { action: 'resume' });
  return <PrivateSpotlightWorkspace projectId={params.id} actorId={session.user.id} />;
}

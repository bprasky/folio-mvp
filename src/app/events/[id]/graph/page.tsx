import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { redirect } from 'next/navigation';
import EventGraphView from '@/components/events/EventGraphView';

export default async function EventGraphPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen bg-folio-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <EventGraphView eventId={params.id} />
      </div>
    </div>
  );
}





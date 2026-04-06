'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import CreateEventForm from './CreateEventForm';

export default function CreateEventPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user?.id) {
      router.push('/auth/signin');
      return;
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center">
        <div className="text-center">
          <div className="text-folio-text-secondary">Loading...</div>
        </div>
      </div>
    );
  }

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center">
        <div className="text-center">
          <div className="text-folio-text-secondary">Please sign in to create events</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-canvas py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="folio-h1 text-folio-text-primary mb-2">Create Event</h1>
          <p className="folio-body text-folio-text-secondary">Create a new event or festival</p>
        </div>

        <CreateEventForm userId={session.user.id} />
      </div>
    </div>
  );
}

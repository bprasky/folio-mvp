'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function AdminDashboard() {
  const { data: session } = useSession();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--bg-base)] py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* ...other dashboard content... */}
        {session?.user?.role === 'admin' && (
          <Button
            variant="accent"
            onClick={() => router.push('/admin/festivals/create')}
          >
            Create Festival
          </Button>
        )}
        {/* ...other dashboard content... */}
      </div>
    </div>
  );
}

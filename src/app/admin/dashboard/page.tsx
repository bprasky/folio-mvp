'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const { data: session } = useSession();
  const router = useRouter();

  return (
    <div>
      {/* ...other dashboard content... */}
      {session?.user?.role === 'admin' && (
        <button
          onClick={() => router.push('/admin/festivals/create')}
          className="bg-purple-600 text-white px-4 py-2 rounded"
        >
          Create Festival
        </button>
      )}
      {/* ...other dashboard content... */}
    </div>
  );
} 
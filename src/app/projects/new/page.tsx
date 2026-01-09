'use client';

import { useSession } from 'next-auth/react';
import { canCreate } from '@/lib/authz/createPermissions';
import UnifiedCreateProjectUI from '@/components/UnifiedCreateProjectUI';

export default function CreateProjectPage() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // Check if user has permission to create projects
  const userRole = session?.user?.role || '';
  if (!canCreate(userRole, 'project')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You do not have permission to create projects.</p>
        </div>
      </div>
    );
  }

  return <UnifiedCreateProjectUI />;
}


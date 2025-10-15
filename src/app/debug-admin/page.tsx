import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export default async function DebugAdminPage() {
  const session = await getServerSession(authOptions);
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Admin Authentication Debug</h1>
        
        {!session ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-red-800 font-semibold">❌ No Session Found</h2>
            <p className="text-red-700 mt-2">You are not logged in. Please sign in first.</p>
            <a href="/auth/signin" className="text-blue-600 hover:underline mt-2 inline-block">
              Go to Sign In →
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h2 className="text-green-800 font-semibold">✅ Session Found</h2>
              <div className="mt-2 space-y-1 text-sm">
                <p><strong>User ID:</strong> {session.user?.id || 'undefined'}</p>
                <p><strong>Email:</strong> {session.user?.email || 'undefined'}</p>
                <p><strong>Name:</strong> {session.user?.name || 'undefined'}</p>
                <p><strong>Role:</strong> {session.user?.role || 'undefined'}</p>
              </div>
            </div>

            {session.user?.role === 'ADMIN' ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h2 className="text-green-800 font-semibold">✅ Admin Access Confirmed</h2>
                <p className="text-green-700 mt-2">
                  You are logged in as an ADMIN. Edit buttons should be visible on events and festival pages.
                </p>
                <div className="mt-4 space-x-2">
                  <a href="/events" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    Test Events Page →
                  </a>
                  <a href="/festivals/nycx-design-2026" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    Test Festival Page →
                  </a>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h2 className="text-yellow-800 font-semibold">⚠️ Not Admin</h2>
                <p className="text-yellow-700 mt-2">
                  You are logged in as <strong>{session.user?.role || 'undefined'}</strong>. 
                  Edit buttons will NOT be visible.
                </p>
                <p className="text-yellow-700 mt-2">
                  To see edit buttons, you need to sign in as <strong>admin@folio.com</strong> with password <strong>password123</strong>
                </p>
                <a href="/auth/signin" className="text-blue-600 hover:underline mt-2 inline-block">
                  Sign in as Admin →
                </a>
              </div>
            )}
          </div>
        )}
        
        <div className="mt-8 pt-4 border-t">
          <h3 className="font-semibold mb-2">Quick Links:</h3>
          <div className="space-x-2">
            <a href="/events" className="text-blue-600 hover:underline">Events Page</a>
            <span>•</span>
            <a href="/festivals/nycx-design-2026" className="text-blue-600 hover:underline">NYCxDesign Festival</a>
            <span>•</span>
            <a href="/admin/events" className="text-blue-600 hover:underline">Admin Events</a>
          </div>
        </div>
      </div>
    </div>
  );
}

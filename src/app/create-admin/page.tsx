'use client';

import { useState } from 'react';

export default function CreateAdminPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const createAdmin = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/create-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ success: false, error: 'Failed to create admin user', details: error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Create Admin User</h1>
        
        <button
          onClick={createAdmin}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create New Admin User'}
        </button>

        {result && (
          <div className="mt-4 p-4 rounded-lg">
            {result.success ? (
              <div className="bg-green-100 border border-green-400 text-green-700 rounded-lg p-4">
                <h3 className="font-bold mb-2">✅ Admin User Created Successfully!</h3>
                <div className="space-y-1 text-sm">
                  <p><strong>Email:</strong> {result.credentials.email}</p>
                  <p><strong>Password:</strong> {result.credentials.password}</p>
                  <p><strong>Role:</strong> {result.credentials.role}</p>
                </div>
                <div className="mt-4 p-3 bg-blue-100 rounded">
                  <p className="text-blue-800 text-sm">
                    <strong>Login at:</strong> <a href="/auth/signin" className="underline">/auth/signin</a>
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-red-100 border border-red-400 text-red-700 rounded-lg p-4">
                <h3 className="font-bold mb-2">❌ Error Creating Admin User</h3>
                <p className="text-sm">{result.error}</p>
                {result.details && (
                  <p className="text-sm mt-2">{result.details}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 
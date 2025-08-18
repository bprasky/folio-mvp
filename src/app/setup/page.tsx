'use client';

import { useState } from 'react';

export default function SetupPage() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'initializing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [dbStatus, setDbStatus] = useState<any>(null);

  const checkDatabase = async () => {
    setStatus('checking');
    setMessage('Checking database connection...');
    
    try {
      const response = await fetch('/api/init-db');
      const data = await response.json();
      setDbStatus(data);
      
      if (data.tablesExist) {
        setStatus('success');
        setMessage(`Database is ready! Found ${data.userCount} users.`);
      } else {
        setStatus('error');
        setMessage('Database tables do not exist. Please initialize the database.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Failed to check database status.');
    }
  };

  const initializeDatabase = async () => {
    setStatus('initializing');
    setMessage('Initializing database... This may take a moment.');
    
    try {
      const response = await fetch('/api/init-db', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        setStatus('success');
        setMessage('Database initialized successfully! Sample data created.');
        setDbStatus(data);
      } else {
        setStatus('error');
        setMessage(`Failed to initialize database: ${data.error}`);
      }
    } catch (error) {
      setStatus('error');
      setMessage('Failed to initialize database.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Database Setup</h1>
          
          <div className="space-y-6">
            {/* Database Status */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Database Status</h2>
              <div className="flex items-center space-x-4">
                <button
                  onClick={checkDatabase}
                  disabled={status === 'checking'}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {status === 'checking' ? 'Checking...' : 'Check Status'}
                </button>
                
                <button
                  onClick={initializeDatabase}
                  disabled={status === 'initializing'}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {status === 'initializing' ? 'Initializing...' : 'Initialize Database'}
                </button>
              </div>
            </div>

            {/* Status Message */}
            {message && (
              <div className={`p-4 rounded-md ${
                status === 'success' ? 'bg-green-50 text-green-800' :
                status === 'error' ? 'bg-red-50 text-red-800' :
                'bg-blue-50 text-blue-800'
              }`}>
                {message}
              </div>
            )}

            {/* Database Info */}
            {dbStatus && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-md font-semibold text-gray-900 mb-2">Database Information</h3>
                <pre className="text-sm text-gray-700 overflow-auto">
                  {JSON.stringify(dbStatus, null, 2)}
                </pre>
              </div>
            )}

            {/* Next Steps */}
            {status === 'success' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-800 mb-2">✅ Database Ready!</h3>
                <p className="text-green-700 mb-4">
                  Your database has been initialized successfully. You can now:
                </p>
                <div className="space-y-2">
                  <a 
                    href="/admin" 
                    className="block text-green-600 hover:text-green-800 underline"
                  >
                    → Go to Admin Dashboard
                  </a>
                  <a 
                    href="/admin/festivals/create" 
                    className="block text-green-600 hover:text-green-800 underline"
                  >
                    → Create Your First Festival
                  </a>
                  <a 
                    href="/events" 
                    className="block text-green-600 hover:text-green-800 underline"
                  >
                    → View Events Page
                  </a>
                </div>
              </div>
            )}

            {/* Troubleshooting */}
            {status === 'error' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">🔧 Troubleshooting</h3>
                <div className="text-yellow-700 space-y-2">
                  <p>If you're having issues:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Make sure your Supabase database is running</li>
                    <li>Check your DATABASE_URL in the .env file</li>
                    <li>Verify your Supabase credentials are correct</li>
                    <li>Try the "Initialize Database" button above</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 
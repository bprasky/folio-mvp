'use client';

import RolePanel from '../../components/RolePanel';

export default function RoleDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Main Content - with top padding for global header */}
      <main className="max-w-7xl mx-auto px-6 py-12 pt-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Your Personalized Experience
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Your dashboard adapts to your role. Switch between Homeowner, Designer, and Vendor 
            to see different features and capabilities.
          </p>
        </div>

        {/* Role-based Panel */}
        <RolePanel />
      </main>
    </div>
  );
} 
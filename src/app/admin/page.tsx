'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DashboardStats {
  totalFestivals: number;
  totalEvents: number;
  totalUsers: number;
  totalProducts: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalFestivals: 0,
    totalEvents: 0,
    totalUsers: 0,
    totalProducts: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch dashboard stats
    Promise.all([
      fetch('/api/admin/festivals').then(res => res.json()),
      fetch('/api/admin/events').then(res => res.json()),
      // Add other API calls for stats
    ]).then(([festivals, events]) => {
      setStats({
        totalFestivals: festivals.length || 0,
        totalEvents: events.length || 0,
        totalUsers: 0, // TODO: Add users API
        totalProducts: 0 // TODO: Add products API
      });
      setLoading(false);
    }).catch(err => {
      console.error('Error fetching dashboard stats:', err);
      setLoading(false);
    });
  }, []);

  const QuickActionCard = ({ title, description, href, icon, color }: {
    title: string;
    description: string;
    href: string;
    icon: string;
    color: string;
  }) => (
    <Link href={href} className={`block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600 text-sm">{description}</p>
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </Link>
  );

  const StatCard = ({ title, value, icon, color }: {
    title: string;
    value: number;
    icon: string;
    color: string;
  }) => (
    <div className={`p-6 bg-white rounded-lg shadow-md ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <div className="text-gray-500">Loading dashboard...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage your events platform and community</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Festivals"
            value={stats.totalFestivals}
            icon="🎪"
            color="border-l-4 border-blue-500"
          />
          <StatCard
            title="Total Events"
            value={stats.totalEvents}
            icon="📅"
            color="border-l-4 border-green-500"
          />
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            icon="👥"
            color="border-l-4 border-purple-500"
          />
          <StatCard
            title="Total Products"
            value={stats.totalProducts}
            icon="🛍️"
            color="border-l-4 border-orange-500"
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <QuickActionCard
              title="Create Festival"
              description="Set up a new design festival with multiple events"
              href="/admin/festivals/create"
              icon="🎪"
              color="hover:bg-blue-50"
            />
            <QuickActionCard
              title="Create Event"
              description="Add a standalone event or festival sub-event"
              href="/events/create"
              icon="📅"
              color="hover:bg-green-50"
            />
            <QuickActionCard
              title="Manage Events"
              description="View and edit all events and festivals"
              href="/admin/events"
              icon="⚙️"
              color="hover:bg-purple-50"
            />
            <QuickActionCard
              title="Review Submissions"
              description="Approve or reject pending event submissions"
              href="/admin/events/approvals"
              icon="✅"
              color="hover:bg-orange-50"
            />
            <QuickActionCard
              title="Manage Users"
              description="View and manage user accounts and roles"
              href="/admin/users"
              icon="👥"
              color="hover:bg-red-50"
            />
            <QuickActionCard
              title="Export Data"
              description="Export events, users, and analytics data"
              href="/admin/export"
              icon="📊"
              color="hover:bg-indigo-50"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="text-center text-gray-500 py-8">
            <p>No recent activity to display</p>
            <p className="text-sm mt-2">Activity tracking coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
} 
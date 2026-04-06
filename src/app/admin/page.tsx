'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RidgeCard, StatsCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

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

  const QuickActionCard = ({ title, description, href, icon }: {
    title: string;
    description: string;
    href: string;
    icon: string;
  }) => (
    <Link href={href}>
      <RidgeCard className="h-full hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="folio-h3 mb-2">{title}</h3>
            <p className="folio-body">{description}</p>
          </div>
          <div className="text-3xl">{icon}</div>
        </div>
      </RidgeCard>
    </Link>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-canvas py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <div className="text-folio-text-secondary">Loading dashboard...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-canvas py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="folio-h1 mb-2">Admin Dashboard</h1>
          <p className="folio-body">Manage your events platform and community</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            label="Total Festivals"
            value={stats.totalFestivals}
          />
          <StatsCard
            label="Total Events"
            value={stats.totalEvents}
          />
          <StatsCard
            label="Total Users"
            value={stats.totalUsers}
          />
          <StatsCard
            label="Total Products"
            value={stats.totalProducts}
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="folio-h2 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <QuickActionCard
              title="Create Festival"
              description="Set up a new design festival with multiple events"
              href="/admin/festivals/create"
              icon="*"
            />
            <QuickActionCard
              title="Create Event"
              description="Add a standalone event or festival sub-event"
              href="/events/create"
              icon="+"
            />
            <QuickActionCard
              title="Manage Events"
              description="View and edit all events and festivals"
              href="/admin/events"
              icon="#"
            />
            <QuickActionCard
              title="Review Submissions"
              description="Approve or reject pending event submissions"
              href="/admin/events/approvals"
              icon="!"
            />
            <QuickActionCard
              title="Manage Users"
              description="View and manage user accounts and roles"
              href="/admin/users"
              icon="@"
            />
            <QuickActionCard
              title="Organizations"
              description="Manage orgs, verification status, and sales notes"
              href="/admin/organizations"
              icon="&"
            />
            <QuickActionCard
              title="Article Topics"
              description="Manage voice-gathering pipeline for articles"
              href="/admin/article-topics"
              icon='"'
            />
            <QuickActionCard
              title="Export Data"
              description="Export events, users, and analytics data"
              href="/admin/export"
              icon="^"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <RidgeCard padding="lg">
          <h2 className="folio-h2 mb-4">Recent Activity</h2>
          <div className="text-center text-folio-text-secondary py-8">
            <p className="folio-body">No recent activity to display</p>
            <p className="folio-meta mt-2">Activity tracking coming soon...</p>
          </div>
        </RidgeCard>
      </div>
    </div>
  );
}

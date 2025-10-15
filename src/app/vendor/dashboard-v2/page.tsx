'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { features } from '@/lib/features';
import VendorVisitCreator from '@/components/vendor/VendorVisitCreator';
import VendorQuickActionsMenu from '@/components/vendor/VendorQuickActionsMenu';
import VendorAnalyticsHeatmap from '@/components/vendor/VendorAnalyticsHeatmap';
import VendorAnalyticsTrending from '@/components/vendor/VendorAnalyticsTrending';
import VendorAnalyticsInfluence from '@/components/vendor/VendorAnalyticsInfluence';
import VendorAnalyticsPipeline from '@/components/vendor/VendorAnalyticsPipeline';
import { 
  FaPlus, 
  FaEye, 
  FaEdit, 
  FaClock, 
  FaCheckCircle, 
  FaExclamationTriangle,
  FaChartLine,
  FaUsers,
  FaCalendarAlt,
  FaArrowRight,
  FaBell,
  FaSearch
} from 'react-icons/fa';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface DashboardStats {
  activeProjects: number;
  projectsSentToDesigners: number;
  projectsClaimedByDesigners: number;
  openFollowUps: number;
  recentWins: number;
}

export default function VendorDashboardV2() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    projectsSentToDesigners: 0,
    projectsClaimedByDesigners: 0,
    openFollowUps: 0,
    recentWins: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch current user
      const userResponse = await fetch('/api/auth/me');
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData);

        // Fetch vendor's projects for basic stats
        const projectsResponse = await fetch(`/api/vendor/projects?userId=${userData.id}`);
        if (projectsResponse.ok) {
          const projectsData = await projectsResponse.json();
          
          // Calculate stats
          const activeProjects = projectsData.length;
          const projectsSentToDesigners = projectsData.filter((p: any) => p.isHandoffReady).length;
          const projectsClaimedByDesigners = projectsData.filter((p: any) => p.handoffClaimedAt).length;
          const openFollowUps = projectsData.filter((p: any) => p.followUpDue).length;
          
          setStats({
            activeProjects,
            projectsSentToDesigners,
            projectsClaimedByDesigners,
            openFollowUps,
            recentWins: Math.floor(projectsClaimedByDesigners * 0.3) // Mock calculation
          });
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your command center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {user?.name}
              </h1>
              <p className="text-gray-600 mt-1">
                Here's your current pipeline at a glance
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {features.vendorVisits && (
                <VendorVisitCreator vendorId={user?.id || ''} />
              )}
              <button
                onClick={() => router.push('/vendor/create-project')}
                className="flex items-center bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FaPlus className="mr-2" />
                New Project
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        {features.vendorQuickActions && (
          <div className="mb-8">
            <VendorQuickActionsMenu />
          </div>
        )}

        {/* Analytics Snapshot */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FaChartLine className="text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Projects</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeProjects}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <FaUsers className="text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Sent to Designers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.projectsSentToDesigners}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FaCheckCircle className="text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Claimed by Designers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.projectsClaimedByDesigners}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <FaBell className="text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Open Follow-ups</p>
                <p className="text-2xl font-bold text-gray-900">{stats.openFollowUps}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <FaCalendarAlt className="text-emerald-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Recent Wins</p>
                <p className="text-2xl font-bold text-gray-900">{stats.recentWins}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Widgets */}
        {features.vendorDashboardV2 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <VendorAnalyticsHeatmap />
            <VendorAnalyticsTrending />
          </div>
        )}

        {features.vendorDashboardV2 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <VendorAnalyticsInfluence />
            <VendorAnalyticsPipeline />
          </div>
        )}
      </div>
    </div>
  );
}


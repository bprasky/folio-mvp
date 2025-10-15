'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import QuickActions from '@/components/QuickActions';
import VendorOutbox from "@/components/VendorOutbox";

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  lastActivity?: string;
  designerOrgName?: string;
  designerEmail?: string;
  vendorOrgName?: string;
  isHandoffReady: boolean;
  handoffInvitedAt?: string;
  handoffClaimedAt?: string;
  rooms: Room[];
  aiSummary?: string;
  nextAction?: string;
  followUpDue?: string;
}

interface Room {
  id: string;
  name: string;
  selections: Selection[];
}

interface Selection {
  id: string;
  productName?: string;
  vendorName?: string;
  unitPrice?: number;
  quantity?: number;
  notes?: string;
}

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

interface VendorDashboardClientProps {
  user: User;
  projects: Project[];
  stats: DashboardStats;
}

export default function VendorDashboardClient({ user, projects, stats }: VendorDashboardClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Null-safe helper functions
  const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
  const lower = (v: unknown) => str(v).toLowerCase();

  const generateAISummary = (project: Project): string => {
    if (project.aiSummary) return project.aiSummary;
    
    const roomCount = project.rooms.length;
    const totalSelections = project.rooms.reduce((acc, room) => acc + room.selections.length, 0);
    
    if (totalSelections === 0) {
      return `${roomCount} room${roomCount > 1 ? 's' : ''} defined. Ready for product selections.`;
    }
    
    const mainRooms = project.rooms.slice(0, 2).map(r => r.name).join(', ');
    const status = project.isHandoffReady ? 'Ready for designer handoff' : 'In progress';
    
    return `${mainRooms} with ${totalSelections} selections. ${status}.`;
  };

  const getNextAction = (project: Project): string => {
    if (project.nextAction) return project.nextAction;
    
    if (!project.isHandoffReady) {
      return 'Complete product selections';
    }
    
    if (project.isHandoffReady && !project.handoffClaimedAt) {
      return 'Send follow-up to designer';
    }
    
    return 'Monitor designer progress';
  };

  const getStatusBadge = (project: Project) => {
    if (project.handoffClaimedAt) {
      return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Claimed</span>;
    }
    if (project.isHandoffReady) {
      return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Ready</span>;
    }
    return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Draft</span>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Ensure projects is always an array
  const list = Array.isArray(projects) ? projects : [];

  const needle = lower(searchTerm).trim();

  const filteredProjects = list.filter((project: any) => {
    const name = lower(project?.name || project?.title || '');
    const designerName = lower(project?.designerName || '');
    const haystack = `${name} ${designerName}`;

    const matchesSearch = !needle || haystack.includes(needle);

    // Use existing handoff status logic for filtering
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'draft' && !project.isHandoffReady) ||
                         (filterStatus === 'ready' && project.isHandoffReady && !project.handoffClaimedAt) ||
                         (filterStatus === 'claimed' && project.handoffClaimedAt);

    return matchesSearch && matchesFilter;
  }).sort((a: any, b: any) => {
    const an = lower(a?.name || a?.title || '');
    const bn = lower(b?.name || b?.title || '');
    return an.localeCompare(bn);
  });

  const followUpProjects = projects.filter(p => p.followUpDue && new Date(p.followUpDue) <= new Date());

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Projects Table */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Active Projects</h2>
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Status</option>
                      <option value="draft">Draft</option>
                      <option value="ready">Ready</option>
                      <option value="claimed">Claimed</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Designer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        AI Summary
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredProjects.map((project) => (
                      <tr key={project.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {project?.name || project?.title || "Untitled project"}
                            </div>
                            <div className="text-sm text-gray-500">
                              {project.description}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {project.designerName || 'Not assigned'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(project.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(project)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs">
                            {generateAISummary(project)}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            Next: {getNextAction(project)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="space-y-2">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => router.push(`/vendor/project/${project.id}`)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <FaEye className="inline mr-1" />
                                View
                              </button>
                              {project.isHandoffReady && !project.handoffClaimedAt && (
                                <button
                                  onClick={() => router.push(`/vendor/project/${project.id}?action=followup`)}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  <FaEdit className="inline mr-1" />
                                  Follow-up
                                </button>
                              )}
                            </div>
                            <QuickActions projectId={project.id} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {filteredProjects.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-6xl mb-4">📋</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
                    <p className="text-gray-500 mb-4">
                      {searchTerm || filterStatus !== 'all' 
                        ? 'Try adjusting your search or filters'
                        : 'Get started by creating your first project'
                      }
                    </p>
                    {!searchTerm && filterStatus === 'all' && (
                      <button
                        onClick={() => router.push('/vendor/create-project')}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                      >
                        Create Your First Project
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Follow-up Queue */}
            {followUpProjects.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FaExclamationTriangle className="text-yellow-500 mr-2" />
                  To-Do This Week
                </h3>
                <div className="space-y-4">
                  {followUpProjects.slice(0, 3).map((project) => (
                    <div key={project.id} className="border-l-4 border-yellow-400 pl-4">
                      <div className="text-sm font-medium text-gray-900">
                        {project?.name || "Untitled project"}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {getNextAction(project)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Due: {project.followUpDue && formatDate(project.followUpDue)}
                      </div>
                      <button
                        onClick={() => router.push(`/vendor/project/${project.id}?action=followup`)}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        Send Follow-up Now
                        <FaArrowRight className="ml-1" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/vendor/create-project')}
                  className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <FaPlus className="text-blue-600 mr-3" />
                    <span className="text-sm font-medium text-gray-900">Create New Project</span>
                  </div>
                  <FaArrowRight className="text-gray-400" />
                </button>
                
                <button
                  onClick={() => router.push('/vendor/analytics')}
                  className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <FaChartLine className="text-green-600 mr-3" />
                    <span className="text-sm font-medium text-gray-900">View Analytics</span>
                  </div>
                  <FaArrowRight className="text-gray-400" />
                </button>
                
                <button
                  onClick={() => router.push('/vendor/organization')}
                  className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <FaUsers className="text-purple-600 mr-3" />
                    <span className="text-sm font-medium text-gray-900">Manage Team</span>
                  </div>
                  <FaArrowRight className="text-gray-400" />
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {projects.slice(0, 3).map((project) => (
                  <div key={project.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">
                        {project?.name || "Untitled project"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {project.lastActivity ? formatDate(project.lastActivity) : formatDate(project.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sent Handoffs Outbox */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <VendorOutbox limit={5} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import ActionItemsAnalytics from '@/components/vendor/ActionItemsAnalytics';
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
import { RidgeCard, StatsCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
      return <span className="px-2 py-1 bg-[var(--accent)]/10 text-[var(--accent-hover)] text-xs rounded-full">Ready</span>;
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
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Header */}
      <div className="bg-[var(--bg-elevated)] shadow-[var(--neu-raised)] border-b border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="folio-h1">
                Welcome back, {user?.name}
              </h1>
              <p className="folio-body text-[var(--text-secondary)] mt-1">
                Here's your current pipeline at a glance
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="accent"
                size="lg"
                onClick={() => router.push('/vendor/create-project')}
              >
                <FaPlus className="mr-2" />
                New Project
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Analytics Snapshot */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <RidgeCard padding="md">
            <div className="flex items-center">
              <div className="p-2 bg-[var(--accent)]/10 rounded-lg">
                <FaChartLine className="text-[var(--accent)]" />
              </div>
              <div className="ml-4">
                <p className="folio-meta">Active Projects</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.activeProjects}</p>
              </div>
            </div>
          </RidgeCard>

          <RidgeCard padding="md">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <FaUsers className="text-green-600" />
              </div>
              <div className="ml-4">
                <p className="folio-meta">Sent to Designers</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.projectsSentToDesigners}</p>
              </div>
            </div>
          </RidgeCard>

          <RidgeCard padding="md">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FaCheckCircle className="text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="folio-meta">Claimed by Designers</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.projectsClaimedByDesigners}</p>
              </div>
            </div>
          </RidgeCard>

          <RidgeCard padding="md">
            <div className="flex items-center">
              <div className="p-2 bg-amber-100 rounded-lg">
                <FaBell className="text-amber-600" />
              </div>
              <div className="ml-4">
                <p className="folio-meta">Open Follow-ups</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.openFollowUps}</p>
              </div>
            </div>
          </RidgeCard>

          <RidgeCard padding="md">
            <div className="flex items-center">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <FaCalendarAlt className="text-emerald-600" />
              </div>
              <div className="ml-4">
                <p className="folio-meta">Recent Wins</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.recentWins}</p>
              </div>
            </div>
          </RidgeCard>
        </div>

        {/* Specification Activity Analytics */}
        <div className="mb-8">
          <ActionItemsAnalytics />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Projects Table */}
          <div className="lg:col-span-2">
            <RidgeCard padding="none">
              <div className="p-6 border-b border-[var(--border-subtle)]">
                <div className="flex items-center justify-between">
                  <h2 className="folio-h3">Active Projects</h2>
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text-tertiary)]" />
                      <Input
                        type="text"
                        placeholder="Search projects..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="ridge-input px-3 py-2"
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
                <table className="min-w-full divide-y divide-[var(--border-subtle)]">
                  <thead className="bg-[var(--bg-elevated)]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                        Designer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                        AI Summary
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--bg-base)] divide-y divide-[var(--border-subtle)]">
                    {filteredProjects.map((project) => (
                      <tr key={project.id} className="hover:bg-[var(--bg-elevated)]">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-[var(--text-primary)]">
                              {project?.name || project?.title || "Untitled project"}
                            </div>
                            <div className="folio-meta">
                              {project.description}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-[var(--text-primary)]">
                            {project.designerName || 'Not assigned'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap folio-meta">
                          {formatDate(project.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(project)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-[var(--text-primary)] max-w-xs">
                            {generateAISummary(project)}
                          </div>
                          <div className="folio-meta mt-1">
                            Next: {getNextAction(project)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="space-y-2">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => router.push(`/vendor/project/${project.id}`)}
                                className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
                              >
                                <FaEye className="inline mr-1" />
                                View
                              </button>
                              {project.isHandoffReady && !project.handoffClaimedAt && (
                                <button
                                  onClick={() => router.push(`/vendor/project/${project.id}?action=followup`)}
                                  className="text-green-600 hover:text-green-700"
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
                    <div className="text-[var(--text-tertiary)] text-6xl mb-4">📋</div>
                    <h3 className="folio-h3 mb-2">No projects found</h3>
                    <p className="folio-body text-[var(--text-secondary)] mb-4">
                      {searchTerm || filterStatus !== 'all'
                        ? 'Try adjusting your search or filters'
                        : 'Get started by creating your first project'
                      }
                    </p>
                    {!searchTerm && filterStatus === 'all' && (
                      <Button
                        variant="accent"
                        onClick={() => router.push('/vendor/create-project')}
                      >
                        Create Your First Project
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </RidgeCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Follow-up Queue */}
            {followUpProjects.length > 0 && (
              <RidgeCard padding="lg">
                <h3 className="folio-h3 mb-4 flex items-center">
                  <FaExclamationTriangle className="text-amber-500 mr-2" />
                  To-Do This Week
                </h3>
                <div className="space-y-4">
                  {followUpProjects.slice(0, 3).map((project) => (
                    <div key={project.id} className="border-l-4 border-[var(--accent)] pl-4">
                      <div className="text-sm font-medium text-[var(--text-primary)]">
                        {project?.name || "Untitled project"}
                      </div>
                      <div className="folio-meta mt-1">
                        {getNextAction(project)}
                      </div>
                      <div className="text-xs text-[var(--text-tertiary)] mt-1">
                        Due: {project.followUpDue && formatDate(project.followUpDue)}
                      </div>
                      <button
                        onClick={() => router.push(`/vendor/project/${project.id}?action=followup`)}
                        className="mt-2 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center"
                      >
                        Send Follow-up Now
                        <FaArrowRight className="ml-1" />
                      </button>
                    </div>
                  ))}
                </div>
              </RidgeCard>
            )}

            {/* Quick Actions */}
            <RidgeCard padding="lg">
              <h3 className="folio-h3 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/vendor/create-project')}
                  className="w-full flex items-center justify-between p-3 border border-[var(--border-subtle)] rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <div className="flex items-center">
                    <FaPlus className="text-[var(--accent)] mr-3" />
                    <span className="text-sm font-medium text-[var(--text-primary)]">Create New Project</span>
                  </div>
                  <FaArrowRight className="text-[var(--text-tertiary)]" />
                </button>

                <button
                  onClick={() => router.push('/vendor/analytics')}
                  className="w-full flex items-center justify-between p-3 border border-[var(--border-subtle)] rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <div className="flex items-center">
                    <FaChartLine className="text-green-600 mr-3" />
                    <span className="text-sm font-medium text-[var(--text-primary)]">View Analytics</span>
                  </div>
                  <FaArrowRight className="text-[var(--text-tertiary)]" />
                </button>

                <button
                  onClick={() => router.push('/vendor/organization')}
                  className="w-full flex items-center justify-between p-3 border border-[var(--border-subtle)] rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <div className="flex items-center">
                    <FaUsers className="text-purple-600 mr-3" />
                    <span className="text-sm font-medium text-[var(--text-primary)]">Manage Team</span>
                  </div>
                  <FaArrowRight className="text-[var(--text-tertiary)]" />
                </button>
              </div>
            </RidgeCard>

            {/* Recent Activity */}
            <RidgeCard padding="lg">
              <h3 className="folio-h3 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {projects.slice(0, 3).map((project) => (
                  <div key={project.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-[var(--accent)] rounded-full mt-2"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate">
                        {project?.name || "Untitled project"}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {project.lastActivity ? formatDate(project.lastActivity) : formatDate(project.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </RidgeCard>

            {/* Sent Handoffs Outbox */}
            <RidgeCard padding="lg">
              <VendorOutbox limit={5} />
            </RidgeCard>
          </div>
        </div>
      </div>
    </div>
  );
}

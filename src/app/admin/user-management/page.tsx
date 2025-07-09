'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Filter,
  Search,
  Download,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  BarChart3,
  FileText,
  Globe,
  Mail,
  Calendar,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  profileType: string;
  createdAt: string;
  onboardingCompleted: boolean;
  eventAttribution?: string;
  websiteUrl?: string;
  scrapedData?: any;
  lastLogin?: string;
  status: 'active' | 'inactive' | 'pending';
}

interface ImportStatus {
  userId: string;
  email: string;
  websiteUrl: string;
  status: 'success' | 'partial' | 'failed' | 'pending';
  errorMessage?: string;
  scrapedData?: any;
  importDate: string;
  retryCount: number;
}

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  pendingOnboarding: number;
  importSuccessRate: number;
  recentSignups: number;
  eventAttributions: { [key: string]: number };
}

export default function UserManagementDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [importStatuses, setImportStatuses] = useState<ImportStatus[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    profileType: 'all',
    importStatus: 'all',
    search: ''
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load users
      const usersResponse = await fetch('/api/admin/users');
      const usersData = await usersResponse.json();
      setUsers(usersData.users || []);

      // Load import statuses
      const importResponse = await fetch('/api/admin/import-status');
      const importData = await importResponse.json();
      setImportStatuses(importData.imports || []);

      // Calculate stats
      const stats = calculateStats(usersData.users || [], importData.imports || []);
      setStats(stats);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (users: User[], imports: ImportStatus[]): DashboardStats => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'active').length;
    const pendingOnboarding = users.filter(u => !u.onboardingCompleted).length;
    
    const successfulImports = imports.filter(i => i.status === 'success').length;
    const totalImports = imports.length;
    const importSuccessRate = totalImports > 0 ? (successfulImports / totalImports) * 100 : 0;
    
    const recentSignups = users.filter(u => {
      const signupDate = new Date(u.createdAt);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return signupDate > weekAgo;
    }).length;

    const eventAttributions: { [key: string]: number } = {};
    users.forEach(user => {
      if (user.eventAttribution) {
        eventAttributions[user.eventAttribution] = (eventAttributions[user.eventAttribution] || 0) + 1;
      }
    });

    return {
      totalUsers,
      activeUsers,
      pendingOnboarding,
      importSuccessRate,
      recentSignups,
      eventAttributions
    };
  };

  const getFilteredUsers = () => {
    return users.filter(user => {
      const matchesStatus = filters.status === 'all' || user.status === filters.status;
      const matchesType = filters.profileType === 'all' || user.profileType === filters.profileType;
      const matchesSearch = !filters.search || 
        user.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        user.email.toLowerCase().includes(filters.search.toLowerCase());
      
      return matchesStatus && matchesType && matchesSearch;
    });
  };

  const getFilteredImports = () => {
    return importStatuses.filter(importItem => {
      const matchesStatus = filters.importStatus === 'all' || importItem.status === filters.importStatus;
      const matchesSearch = !filters.search || 
        importItem.email.toLowerCase().includes(filters.search.toLowerCase()) ||
        importItem.websiteUrl.toLowerCase().includes(filters.search.toLowerCase());
      
      return matchesStatus && matchesSearch;
    });
  };

  const retryImport = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/retry-import/${userId}`, {
        method: 'POST'
      });
      if (response.ok) {
        loadDashboardData();
      }
    } catch (error) {
      console.error('Failed to retry import:', error);
    }
  };

  const exportData = async (type: 'users' | 'imports') => {
    const data = type === 'users' ? getFilteredUsers() : getFilteredImports();
    const csv = convertToCSV(data);
    downloadCSV(csv, `${type}-export-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => JSON.stringify(row[header])).join(','))
    ].join('\n');
    return csvContent;
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-100';
      case 'partial': return 'text-yellow-600 bg-yellow-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management Dashboard</h1>
            <p className="text-gray-600 mt-2">Monitor users, import status, and system health</p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={loadDashboardData}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <Users className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <UserCheck className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Users</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.activeUsers}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <Clock className="w-8 h-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending Onboarding</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pendingOnboarding}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <BarChart3 className="w-8 h-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Import Success Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.importSuccessRate.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Profile Type</label>
              <select
                value={filters.profileType}
                onChange={(e) => setFilters(prev => ({ ...prev, profileType: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="all">All Types</option>
                <option value="designer">Designer</option>
                <option value="vendor">Vendor</option>
                <option value="homeowner">Homeowner</option>
                <option value="student">Student</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Import Status</label>
              <select
                value={filters.importStatus}
                onChange={(e) => setFilters(prev => ({ ...prev, importStatus: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="all">All Imports</option>
                <option value="success">Success</option>
                <option value="partial">Partial</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  placeholder="Search users..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Import Status Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Import Status ({getFilteredImports().length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Website
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Error Message
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Import Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Retries
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getFilteredImports().map((importItem) => (
                  <tr key={importItem.userId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <Mail className="w-5 h-5 text-gray-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{importItem.email}</div>
                          <div className="text-sm text-gray-500">ID: {importItem.userId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Globe className="w-4 h-4 text-gray-400 mr-2" />
                        <a 
                          href={importItem.websiteUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline truncate max-w-xs"
                        >
                          {importItem.websiteUrl}
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(importItem.status)}`}>
                        {importItem.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {importItem.errorMessage || 'No errors'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(importItem.importDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {importItem.retryCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        {importItem.status === 'failed' && (
                          <button
                            onClick={() => retryImport(importItem.userId)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        <button className="text-gray-600 hover:text-gray-900">
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => exportData('imports')}
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4" />
              <span>Export Import Data</span>
            </button>
            <button
              onClick={() => exportData('users')}
              className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              <Download className="w-4 h-4" />
              <span>Export User Data</span>
            </button>
          </div>
          
          <div className="text-sm text-gray-500">
            Last updated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
} 
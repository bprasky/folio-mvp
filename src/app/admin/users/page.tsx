'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassModal,
  GlassModalHeader,
  GlassModalBody,
  GlassModalFooter,
  GlassTextarea,
  GlassBadge,
} from '@/components/ui/glass';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  profileImage: string | null;
  role: string;
  accountStatus: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    ownedProjects: number;
  };
  applicationNote: string | null;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const statusColors: Record<string, 'warning' | 'success' | 'error' | 'default'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

const roleColors: Record<string, 'info' | 'success' | 'default' | 'warning'> = {
  ADMIN: 'warning',
  DESIGNER: 'info',
  VENDOR: 'success',
  HOMEOWNER: 'default',
  GUEST: 'default',
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal states
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [applicationNote, setApplicationNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Check auth - only admins allowed
  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') {
        router.replace('/');
      }
    } else if (status === 'unauthenticated') {
      router.replace('/auth/signin');
    }
  }, [session, status, router]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
      });
      if (searchQuery) params.set('search', searchQuery);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('status', statusFilter);

      const response = await fetch(`/api/admin/users?${params}`);
      if (response.ok) {
        const data: UsersResponse = await response.json();
        setUsers(data.users);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, roleFilter, statusFilter]);

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      fetchUsers();
    }
  }, [session, fetchUsers]);

  const handleApprove = async (userId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'PATCH',
      });
      if (response.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Error approving user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason }),
      });
      if (response.ok) {
        setRejectModalOpen(false);
        setRejectionReason('');
        setSelectedUser(null);
        fetchUsers();
      }
    } catch (error) {
      console.error('Error rejecting user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateNote = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: applicationNote }),
      });
      if (response.ok) {
        setNoteModalOpen(false);
        setApplicationNote('');
        setSelectedUser(null);
        fetchUsers();
      }
    } catch (error) {
      console.error('Error updating note:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleImpersonate = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/impersonate/${userId}`, {
        method: 'POST',
      });
      if (response.ok) {
        // Redirect will happen in the API response or we trigger a refresh
        router.push('/');
        router.refresh();
      }
    } catch (error) {
      console.error('Error starting impersonation:', error);
    }
  };

  const openRejectModal = (user: User) => {
    setSelectedUser(user);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const openNoteModal = (user: User) => {
    setSelectedUser(user);
    setApplicationNote(user.applicationNote || '');
    setNoteModalOpen(true);
  };

  if (status === 'loading' || (status === 'authenticated' && session?.user?.role !== 'ADMIN')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
          <p className="text-gray-600">
            Manage user accounts, approve applications, and monitor activity
          </p>
        </div>

        {/* Filters */}
        <GlassCard variant="solid" padding="md" className="mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <GlassInput
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex gap-4">
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">All Roles</option>
                <option value="DESIGNER">Designer</option>
                <option value="VENDOR">Vendor</option>
                <option value="ADMIN">Admin</option>
                <option value="HOMEOWNER">Homeowner</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
        </GlassCard>

        {/* Stats bar */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {users.length} of {total} users
        </div>

        {/* Users table */}
        <GlassCard variant="solid" padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Signed Up
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Last Active
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Projects
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                            {user.profileImage ? (
                              <Image
                                src={user.profileImage}
                                alt={user.name}
                                width={40}
                                height={40}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm font-medium">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <GlassBadge variant={roleColors[user.role] || 'default'}>
                          {user.role}
                        </GlassBadge>
                      </td>
                      <td className="px-6 py-4">
                        <GlassBadge variant={statusColors[user.accountStatus] || 'default'}>
                          {user.accountStatus}
                        </GlassBadge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatRelativeTime(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatRelativeTime(user.updatedAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {user._count.ownedProjects}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                              <svg
                                className="w-5 h-5 text-gray-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                                />
                              </svg>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => window.open(`/designer/${user.id}`, '_blank')}
                            >
                              View Profile
                            </DropdownMenuItem>
                            {user.role !== 'ADMIN' && (
                              <DropdownMenuItem onClick={() => handleImpersonate(user.id)}>
                                Impersonate
                              </DropdownMenuItem>
                            )}
                            {user.accountStatus === 'PENDING' && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleApprove(user.id)}
                                  disabled={actionLoading}
                                  className="text-green-600"
                                >
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openRejectModal(user)}
                                  className="text-red-600"
                                >
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem onClick={() => openNoteModal(user)}>
                              {user.applicationNote ? 'Edit Note' : 'Add Note'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <GlassButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  Previous
                </GlassButton>
                <GlassButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                </GlassButton>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Reject Modal */}
        <GlassModal open={rejectModalOpen} onOpenChange={setRejectModalOpen} size="md">
          <GlassModalHeader>
            <h2 className="text-xl font-semibold text-gray-900">Reject Application</h2>
          </GlassModalHeader>
          <GlassModalBody>
            <div className="space-y-4">
              <p className="text-gray-600">
                You are about to reject <strong>{selectedUser?.name}</strong>'s application.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason (optional, will be shared with applicant)
                </label>
                <GlassTextarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter a reason for rejection..."
                  rows={4}
                />
              </div>
            </div>
          </GlassModalBody>
          <GlassModalFooter>
            <div className="flex justify-end gap-3">
              <GlassButton
                variant="secondary"
                onClick={() => setRejectModalOpen(false)}
              >
                Cancel
              </GlassButton>
              <GlassButton
                variant="danger"
                onClick={handleReject}
                disabled={actionLoading}
              >
                {actionLoading ? 'Rejecting...' : 'Reject Application'}
              </GlassButton>
            </div>
          </GlassModalFooter>
        </GlassModal>

        {/* Note Modal */}
        <GlassModal open={noteModalOpen} onOpenChange={setNoteModalOpen} size="md">
          <GlassModalHeader>
            <h2 className="text-xl font-semibold text-gray-900">Application Note</h2>
          </GlassModalHeader>
          <GlassModalBody>
            <div className="space-y-4">
              <p className="text-gray-600">
                Internal note for <strong>{selectedUser?.name}</strong>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note (internal only)
                </label>
                <GlassTextarea
                  value={applicationNote}
                  onChange={(e) => setApplicationNote(e.target.value)}
                  placeholder="Add internal notes about this applicant..."
                  rows={4}
                />
              </div>
            </div>
          </GlassModalBody>
          <GlassModalFooter>
            <div className="flex justify-end gap-3">
              <GlassButton
                variant="secondary"
                onClick={() => setNoteModalOpen(false)}
              >
                Cancel
              </GlassButton>
              <GlassButton
                variant="primary"
                onClick={handleUpdateNote}
                disabled={actionLoading}
              >
                {actionLoading ? 'Saving...' : 'Save Note'}
              </GlassButton>
            </div>
          </GlassModalFooter>
        </GlassModal>
      </div>
    </div>
  );
}

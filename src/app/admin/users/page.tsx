'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from '@/components/FolioImage';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

// Individual-First Architecture: INDIVIDUAL is the base user type
const roleColors: Record<string, string> = {
  ADMIN: 'bg-amber-100 text-amber-800',
  DESIGNER: 'bg-blue-100 text-blue-800',
  VENDOR: 'bg-green-100 text-green-800',
  INDIVIDUAL: 'bg-surface-ground text-folio-text-primary',
  HOMEOWNER: 'bg-surface-ground text-folio-text-primary',  // Deprecated, kept for backwards compatibility
  GUEST: 'bg-surface-ground text-folio-text-primary',
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
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas">
        <div className="text-folio-text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-canvas py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="folio-h1 mb-2">User Management</h1>
          <p className="folio-body">
            Manage user accounts, approve applications, and monitor activity
          </p>
        </div>

        {/* Filters */}
        <RidgeCard padding="md" className="mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
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
                className="ridge-input px-4 py-2"
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
                className="ridge-input px-4 py-2"
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
        </RidgeCard>

        {/* Stats bar */}
        <div className="mb-4 folio-meta">
          Showing {users.length} of {total} users
        </div>

        {/* Users table */}
        <RidgeCard padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-ground border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-folio-text-secondary uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-folio-text-secondary uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-folio-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-folio-text-secondary uppercase tracking-wider">
                    Signed Up
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-folio-text-secondary uppercase tracking-wider">
                    Last Active
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-folio-text-secondary uppercase tracking-wider">
                    Projects
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-folio-text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-folio-text-secondary">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-folio-text-secondary">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-surface-ground/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-surface-ground overflow-hidden flex-shrink-0">
                            {user.profileImage ? (
                              <Image
                                src={user.profileImage}
                                alt={user.name}
                                width={40}
                                height={40}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-folio-text-secondary text-sm font-medium">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-folio-text-primary">{user.name}</div>
                            <div className="text-sm text-folio-text-secondary">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn('px-2 py-1 rounded-full text-xs font-medium', roleColors[user.role] || 'bg-surface-ground text-folio-text-primary')}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn('px-2 py-1 rounded-full text-xs font-medium', statusColors[user.accountStatus] || 'bg-surface-ground text-folio-text-primary')}>
                          {user.accountStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-folio-text-secondary">
                        {formatRelativeTime(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-folio-text-secondary">
                        {formatRelativeTime(user.updatedAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-folio-text-secondary">
                        {user._count.ownedProjects}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 hover:bg-surface-ground rounded-lg transition-colors">
                              <svg
                                className="w-5 h-5 text-folio-text-secondary"
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
            <div className="px-6 py-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
              <div className="folio-meta">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ridge"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="ridge"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </RidgeCard>

        {/* Reject Modal */}
        {rejectModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <RidgeCard padding="lg" className="max-w-md w-full">
              <h2 className="folio-h2 mb-4">Reject Application</h2>
              <div className="space-y-4">
                <p className="folio-body">
                  You are about to reject <strong>{selectedUser?.name}</strong>&apos;s application.
                </p>
                <div>
                  <label className="block folio-meta mb-2">
                    Reason (optional, will be shared with applicant)
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter a reason for rejection..."
                    rows={4}
                    className="ridge-input w-full px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="ridge"
                  onClick={() => setRejectModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Rejecting...' : 'Reject Application'}
                </Button>
              </div>
            </RidgeCard>
          </div>
        )}

        {/* Note Modal */}
        {noteModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <RidgeCard padding="lg" className="max-w-md w-full">
              <h2 className="folio-h2 mb-4">Application Note</h2>
              <div className="space-y-4">
                <p className="folio-body">
                  Internal note for <strong>{selectedUser?.name}</strong>
                </p>
                <div>
                  <label className="block folio-meta mb-2">
                    Note (internal only)
                  </label>
                  <textarea
                    value={applicationNote}
                    onChange={(e) => setApplicationNote(e.target.value)}
                    placeholder="Add internal notes about this applicant..."
                    rows={4}
                    className="ridge-input w-full px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="ridge"
                  onClick={() => setNoteModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="accent"
                  onClick={handleUpdateNote}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving...' : 'Save Note'}
                </Button>
              </div>
            </RidgeCard>
          </div>
        )}
      </div>
    </div>
  );
}

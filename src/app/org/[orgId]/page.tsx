'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  GlassCard,
  EditorialHeadline,
  GlassInput,
  GlassButton,
} from "@/components/ui/glass";
import {
  Building2,
  Users,
  Settings,
  Shield,
  Crown,
  UserPlus,
  Mail,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  MapPin,
  Phone,
  Globe,
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  type: string;
  status: string;
  description?: string;
  website?: string;
  address?: string;
  phone?: string;
  logo?: string;
  users: Array<{
    id: string;
    userId: string;
    role: string;
    showOnProfile: boolean;
    user: {
      id: string;
      name: string;
      email: string;
      profileImage?: string;
      title?: string;
    };
  }>;
  _count: {
    users: number;
    vendorProjects: number;
    designerProjects: number;
  };
}

interface JoinRequest {
  id: string;
  userId: string;
  status: string;
  message?: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    profileImage?: string;
    title?: string;
  };
}

export default function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = use(params);
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [org, setOrg] = useState<Organization | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'settings'>('overview');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [message, setMessage] = useState('');

  const currentUserMembership = org?.users.find(u => u.userId === session?.user?.id);
  const isOwner = currentUserMembership?.role === 'OWNER';
  const isAdmin = isOwner || currentUserMembership?.role === 'ADMIN';

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [sessionStatus, router]);

  useEffect(() => {
    if (orgId) {
      fetchOrg();
    }
  }, [orgId]);

  useEffect(() => {
    if (isAdmin && orgId) {
      fetchJoinRequests();
    }
  }, [isAdmin, orgId]);

  const fetchOrg = async () => {
    try {
      const response = await fetch(`/api/orgs/${orgId}`);
      if (response.ok) {
        const data = await response.json();
        setOrg(data);
      } else if (response.status === 404) {
        router.push('/404');
      }
    } catch (error) {
      console.error('Error fetching org:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchJoinRequests = async () => {
    try {
      const response = await fetch(`/api/orgs/${orgId}/join?status=PENDING`);
      if (response.ok) {
        const data = await response.json();
        setJoinRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching join requests:', error);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    setMessage('');

    try {
      const response = await fetch(`/api/orgs/${orgId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Invitation sent successfully!');
        setInviteEmail('');
      } else {
        setMessage(data.error || 'Failed to send invitation');
      }
    } catch (error) {
      setMessage('Error sending invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleJoinRequestAction = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch(`/api/orgs/${orgId}/join/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        fetchJoinRequests();
        if (action === 'approve') {
          fetchOrg();
        }
      }
    } catch (error) {
      console.error('Error handling join request:', error);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'ADMIN':
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PROFESSIONAL':
        return (
          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
            Professional
          </span>
        );
      case 'CLAIMED':
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            Verified
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
            Unclaimed
          </span>
        );
    }
  };

  if (isLoading || sessionStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <p className="text-gray-600">Organization not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {org.logo ? (
                <img
                  src={org.logo}
                  alt={org.name}
                  className="w-16 h-16 rounded-xl object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
                  {getStatusBadge(org.status)}
                </div>
                <p className="text-gray-600">{org.type.replace('_', ' ')}</p>
              </div>
            </div>

            {isOwner && org.status !== 'PROFESSIONAL' && (
              <Link href={`/org/${orgId}/upgrade`}>
                <GlassButton variant="primary">
                  Upgrade to Professional
                </GlassButton>
              </Link>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {['overview', 'members', ...(isAdmin ? ['settings'] : [])].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 font-medium transition-colors capitalize ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid gap-6 md:grid-cols-2">
            <GlassCard variant="strong" padding="lg" rounded="xl">
              <h3 className="font-semibold text-gray-900 mb-4">Organization Info</h3>
              <div className="space-y-3">
                {org.description && (
                  <p className="text-gray-600">{org.description}</p>
                )}
                {org.address && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{org.address}</span>
                  </div>
                )}
                {org.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{org.phone}</span>
                  </div>
                )}
                {org.website && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Globe className="w-4 h-4" />
                    <a
                      href={org.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {org.website}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </GlassCard>

            <GlassCard variant="strong" padding="lg" rounded="xl">
              <h3 className="font-semibold text-gray-900 mb-4">Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-3xl font-bold text-gray-900">{org._count.users}</p>
                  <p className="text-sm text-gray-600">Members</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {org._count.designerProjects + org._count.vendorProjects}
                  </p>
                  <p className="text-sm text-gray-600">Projects</p>
                </div>
              </div>
            </GlassCard>

            {/* Pending Join Requests (for admins) */}
            {isAdmin && joinRequests.length > 0 && (
              <GlassCard variant="strong" padding="lg" rounded="xl" className="md:col-span-2">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Pending Join Requests ({joinRequests.length})
                </h3>
                <div className="space-y-3">
                  {joinRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {request.user?.name || 'Unknown'}
                        </p>
                        <p className="text-sm text-gray-600">{request.user?.email}</p>
                        {request.message && (
                          <p className="text-sm text-gray-500 mt-1 italic">
                            "{request.message}"
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleJoinRequestAction(request.id, 'approve')}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Approve"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleJoinRequestAction(request.id, 'reject')}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Reject"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            {/* Invite Form (for admins) */}
            {isAdmin && (
              <GlassCard variant="strong" padding="lg" rounded="xl">
                <h3 className="font-semibold text-gray-900 mb-4">Invite Member</h3>
                <form onSubmit={handleInvite} className="flex gap-3 flex-wrap">
                  <GlassInput
                    type="email"
                    placeholder="Email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 min-w-[200px]"
                    required
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="px-4 py-2 bg-white/50 border border-gray-200 rounded-lg"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <GlassButton type="submit" disabled={isInviting}>
                    {isInviting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-5 h-5 mr-2" />
                        Invite
                      </>
                    )}
                  </GlassButton>
                </form>
                {message && (
                  <p className={`mt-3 text-sm ${
                    message.includes('Error') || message.includes('Failed')
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}>
                    {message}
                  </p>
                )}
              </GlassCard>
            )}

            {/* Members List */}
            <GlassCard variant="strong" padding="lg" rounded="xl">
              <h3 className="font-semibold text-gray-900 mb-4">
                Members ({org.users.length})
              </h3>
              <div className="space-y-3">
                {org.users.map((membership) => (
                  <div
                    key={membership.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {membership.user.profileImage ? (
                        <img
                          src={membership.user.profileImage}
                          alt={membership.user.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 font-medium">
                            {membership.user.name?.charAt(0) || '?'}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">
                            {membership.user.name}
                          </p>
                          {getRoleIcon(membership.role)}
                        </div>
                        <p className="text-sm text-gray-600">
                          {membership.user.email}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500 capitalize">
                      {membership.role.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && isAdmin && (
          <div className="space-y-6">
            <GlassCard variant="strong" padding="lg" rounded="xl">
              <h3 className="font-semibold text-gray-900 mb-4">Organization Settings</h3>
              <p className="text-gray-600">
                Organization settings management coming soon.
              </p>
            </GlassCard>

            {org.status === 'UNCLAIMED' && isOwner && (
              <GlassCard variant="strong" padding="lg" rounded="xl" className="border-2 border-blue-200">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Shield className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Verify Your Organization
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Get a verified badge in the directory by completing business verification.
                    </p>
                    <GlassButton variant="primary">
                      Start Verification
                    </GlassButton>
                  </div>
                </div>
              </GlassCard>
            )}

            {org.status === 'CLAIMED' && isOwner && (
              <GlassCard variant="strong" padding="lg" rounded="xl" className="border-2 border-purple-200">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Crown className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Upgrade to Professional
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Unlock AI image generation, client connections, affiliate revenue, and more.
                    </p>
                    <Link href={`/org/${orgId}/upgrade`}>
                      <GlassButton variant="primary">
                        Upgrade Now
                      </GlassButton>
                    </Link>
                  </div>
                </div>
              </GlassCard>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

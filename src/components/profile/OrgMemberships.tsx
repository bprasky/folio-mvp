'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, Crown, Shield, Eye, EyeOff, ExternalLink } from 'lucide-react';

interface OrgMembership {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  showOnProfile: boolean;
  organization: {
    id: string;
    name: string;
    type: string;
    status: string;
    logo?: string;
  };
}

interface OrgMembershipsProps {
  userId: string;
}

export default function OrgMemberships({ userId }: OrgMembershipsProps) {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMemberships();
  }, [userId]);

  const fetchMemberships = async () => {
    try {
      const response = await fetch(`/api/orgs?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        // Transform the response to match our component's expected format
        const transformedMemberships = data.organizations?.map((org: any) => {
          const userMembership = org.users?.find((u: any) => u.userId === userId);
          return {
            id: userMembership?.id || org.id,
            userId,
            organizationId: org.id,
            role: userMembership?.role || 'MEMBER',
            showOnProfile: userMembership?.showOnProfile ?? true,
            organization: {
              id: org.id,
              name: org.name,
              type: org.type,
              status: org.status,
              logo: org.logo,
            },
          };
        }) || [];
        setMemberships(transformedMemberships);
      }
    } catch (error) {
      console.error('Error fetching memberships:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVisibility = async (membershipId: string, orgId: string, currentValue: boolean) => {
    try {
      const response = await fetch(`/api/orgs/${orgId}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showOnProfile: !currentValue }),
      });

      if (response.ok) {
        setMemberships(memberships.map(m =>
          m.id === membershipId ? { ...m, showOnProfile: !currentValue } : m
        ));
      }
    } catch (error) {
      console.error('Error toggling visibility:', error);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'ADMIN':
        return <Shield className="w-4 h-4 text-[var(--accent)]" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PROFESSIONAL':
        return (
          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
            Pro
          </span>
        );
      case 'CLAIMED':
        return (
          <span className="px-1.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent-hover)] text-xs rounded-full">
            Verified
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-[var(--bg-elevated)] rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-16 bg-[var(--bg-elevated)] rounded"></div>
          <div className="h-16 bg-[var(--bg-elevated)] rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-[var(--text-primary)]">Organizations</h3>
        <Link
          href="/professionals/join"
          className="text-sm text-[var(--accent)] hover:text-blue-800"
        >
          Join or create
        </Link>
      </div>

      {memberships.length === 0 ? (
        <div className="text-center py-8 bg-[var(--bg-elevated)] rounded-lg">
          <Building2 className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)] mb-2">No organizations yet</p>
          <Link
            href="/professionals"
            className="text-[var(--accent)] hover:text-blue-800 text-sm"
          >
            Join as a professional
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {memberships.map((membership) => (
            <div
              key={membership.id}
              className="flex items-center justify-between p-4 bg-[var(--bg-elevated)] rounded-lg"
            >
              <div className="flex items-center gap-3">
                {membership.organization.logo ? (
                  <img
                    src={membership.organization.logo}
                    alt={membership.organization.name}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 bg-[var(--bg-elevated)] rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[var(--text-tertiary)]" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/org/${membership.organization.id}`}
                      className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)] flex items-center gap-1"
                    >
                      {membership.organization.name}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                    {getRoleIcon(membership.role)}
                    {getStatusBadge(membership.organization.status)}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] capitalize">
                    {membership.role.toLowerCase()} · {membership.organization.type.replace('_', ' ').toLowerCase()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => toggleVisibility(membership.id, membership.organization.id, membership.showOnProfile)}
                className={`p-2 rounded-lg transition-colors ${
                  membership.showOnProfile
                    ? 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                    : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)]'
                }`}
                title={membership.showOnProfile ? 'Visible on profile' : 'Hidden from profile'}
              >
                {membership.showOnProfile ? (
                  <Eye className="w-5 h-5" />
                ) : (
                  <EyeOff className="w-5 h-5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

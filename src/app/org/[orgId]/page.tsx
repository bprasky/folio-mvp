'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  FaBuilding,
  FaUsers,
  FaGlobe,
  FaPhone,
  FaMapMarkerAlt,
  FaCog,
  FaCheck,
  FaSpinner,
  FaCrown,
  FaShieldAlt,
  FaStar,
} from 'react-icons/fa';
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  EditorialHeadline,
} from '@/components/ui/glass';

interface OrgMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  profileImage?: string;
  orgRole: string;
  joinedAt: string;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
  status: string;
  description?: string;
  website?: string;
  logo?: string;
  address?: string;
  phone?: string;
  verifiedAt?: string;
  createdAt: string;
  members: OrgMember[];
  projectCount: number;
}

const statusColors: Record<string, string> = {
  UNCLAIMED: 'bg-gray-100 text-gray-700',
  CLAIMED: 'bg-blue-100 text-blue-700',
  PROFESSIONAL: 'bg-purple-100 text-purple-700',
};

const statusLabels: Record<string, string> = {
  UNCLAIMED: 'Unclaimed',
  CLAIMED: 'Verified',
  PROFESSIONAL: 'Professional',
};

export default function OrgDashboardPage({
  params,
}: {
  params: { orgId: string };
}) {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userMembership, setUserMembership] = useState<OrgMember | null>(null);

  const showJoinedMessage = searchParams.get('joined') === 'pending';

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const response = await fetch(`/api/orgs/${params.orgId}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Organization not found');
          } else {
            throw new Error('Failed to fetch organization');
          }
          return;
        }

        const data = await response.json();
        setOrg(data);

        // Find current user's membership
        if (session?.user?.id) {
          const membership = data.members.find(
            (m: OrgMember) => m.userId === session.user.id
          );
          setUserMembership(membership || null);
        }
      } catch (err) {
        setError('Failed to load organization');
      } finally {
        setLoading(false);
      }
    };

    fetchOrg();
  }, [params.orgId, session?.user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <FaSpinner className="w-8 h-8 animate-spin text-folio-stone-400" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <GlassCard variant="strong" padding="xl" rounded="2xl">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-folio-ink mb-2">
              {error || 'Organization not found'}
            </h2>
            <Link href="/professionals">
              <GlassButton variant="secondary">
                Back to Professionals
              </GlassButton>
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  const isOwner = userMembership?.orgRole === 'OWNER';
  const isAdmin = ['OWNER', 'ADMIN'].includes(userMembership?.orgRole || '');

  return (
    <div className="min-h-screen bg-gradient-to-b from-folio-bg via-white to-folio-stone-100 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Join Request Pending Message */}
        {showJoinedMessage && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <FaCheck />
            Your join request has been submitted. An admin will review it shortly.
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 bg-folio-stone-100 rounded-xl flex items-center justify-center flex-shrink-0">
              {org.logo ? (
                <img
                  src={org.logo}
                  alt={org.name}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <FaBuilding className="w-10 h-10 text-folio-stone-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <EditorialHeadline size="lg">{org.name}</EditorialHeadline>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    statusColors[org.status]
                  }`}
                >
                  {statusLabels[org.status]}
                </span>
              </div>
              <p className="text-folio-stone-600 mb-2">
                {org.type.replace('_', ' ')}
              </p>
              {org.description && (
                <p className="text-folio-stone-700">{org.description}</p>
              )}
            </div>
          </div>

          {isAdmin && (
            <GlassButton variant="secondary" size="sm">
              <FaCog className="mr-2" />
              Settings
            </GlassButton>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Stats */}
            <div className="grid sm:grid-cols-3 gap-4">
              <GlassCard variant="subtle" padding="md" rounded="lg">
                <div className="text-center">
                  <p className="text-2xl font-bold text-folio-ink">
                    {org.members.length}
                  </p>
                  <p className="text-sm text-folio-stone-600">Members</p>
                </div>
              </GlassCard>
              <GlassCard variant="subtle" padding="md" rounded="lg">
                <div className="text-center">
                  <p className="text-2xl font-bold text-folio-ink">
                    {org.projectCount}
                  </p>
                  <p className="text-sm text-folio-stone-600">Projects</p>
                </div>
              </GlassCard>
              <GlassCard variant="subtle" padding="md" rounded="lg">
                <div className="text-center">
                  <p className="text-2xl font-bold text-folio-ink">
                    {org.status === 'PROFESSIONAL' ? 'Pro' : 'Free'}
                  </p>
                  <p className="text-sm text-folio-stone-600">Tier</p>
                </div>
              </GlassCard>
            </div>

            {/* Members */}
            <GlassCard variant="strong" padding="lg" rounded="xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-folio-ink">Members</h3>
                {isAdmin && (
                  <GlassButton variant="secondary" size="sm">
                    Invite Member
                  </GlassButton>
                )}
              </div>

              <div className="space-y-3">
                {org.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-folio-stone-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-folio-stone-200 rounded-full flex items-center justify-center">
                        {member.profileImage ? (
                          <img
                            src={member.profileImage}
                            alt={member.name}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <span className="text-folio-stone-500 font-medium">
                            {member.name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-folio-ink">
                          {member.name}
                        </p>
                        <p className="text-sm text-folio-stone-500">
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.orgRole === 'OWNER' && (
                        <FaCrown className="text-amber-500" title="Owner" />
                      )}
                      {member.orgRole === 'ADMIN' && (
                        <FaShieldAlt className="text-blue-500" title="Admin" />
                      )}
                      <span className="text-sm text-folio-stone-600 capitalize">
                        {member.orgRole.toLowerCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <GlassCard variant="strong" padding="lg" rounded="xl">
              <h3 className="text-lg font-semibold text-folio-ink mb-4">
                Contact
              </h3>
              <div className="space-y-3">
                {org.website && (
                  <a
                    href={org.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-folio-stone-700 hover:text-folio-ink"
                  >
                    <FaGlobe className="text-folio-stone-400" />
                    <span className="truncate">{org.website}</span>
                  </a>
                )}
                {org.phone && (
                  <div className="flex items-center gap-2 text-folio-stone-700">
                    <FaPhone className="text-folio-stone-400" />
                    <span>{org.phone}</span>
                  </div>
                )}
                {org.address && (
                  <div className="flex items-start gap-2 text-folio-stone-700">
                    <FaMapMarkerAlt className="text-folio-stone-400 mt-1" />
                    <span>{org.address}</span>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Upgrade CTA (if not professional) */}
            {org.status !== 'PROFESSIONAL' && isOwner && (
              <GlassCard
                variant="strong"
                padding="lg"
                rounded="xl"
                className="border-2 border-purple-200"
              >
                <div className="text-center">
                  <FaStar className="w-8 h-8 text-purple-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-folio-ink mb-2">
                    Upgrade to Professional
                  </h3>
                  <p className="text-sm text-folio-stone-600 mb-4">
                    Unlock affiliate tags, image generation, and more.
                  </p>
                  <GlassButton variant="primary" size="sm" className="w-full">
                    Upgrade Now
                  </GlassButton>
                </div>
              </GlassCard>
            )}

            {/* Claim CTA (if unclaimed and owner) */}
            {org.status === 'UNCLAIMED' && isOwner && (
              <GlassCard
                variant="strong"
                padding="lg"
                rounded="xl"
                className="border-2 border-blue-200"
              >
                <div className="text-center">
                  <FaShieldAlt className="w-8 h-8 text-blue-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-folio-ink mb-2">
                    Verify Your Organization
                  </h3>
                  <p className="text-sm text-folio-stone-600 mb-4">
                    Get a verified badge and claim ownership.
                  </p>
                  <GlassButton variant="secondary" size="sm" className="w-full">
                    Claim Organization
                  </GlassButton>
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
